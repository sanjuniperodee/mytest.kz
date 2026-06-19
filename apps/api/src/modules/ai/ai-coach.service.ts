import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../database/redis.module';
import { MistakesService } from '../tests/mistakes.service';
import { DeepseekClient } from './infrastructure/deepseek.client';
import {
  extractPassage,
  extractQuestionText,
  localizeFlat,
  truncate,
} from './ai-content.util';
import {
  AiLanguage,
  PromptLessonQuestion,
  PromptMistake,
  PromptSubject,
  explainSystemPrompt,
  explainUserPrompt,
  topicLessonSystemPrompt,
  topicLessonUserPrompt,
  weakZoneSystemPrompt,
  weakZoneUserPrompt,
} from './ai.prompts';

// Bump when prompt/schema changes so cached analyses regenerate.
const PROMPT_VERSION = 'v1';
const LESSON_VERSION = 'v1';
const MAX_SUBJECTS = 6;
const MAX_QUESTIONS_PER_SUBJECT = 6;
const MAX_TOTAL_QUESTIONS = 30;
const MAX_LESSON_SAMPLE_QUESTIONS = 8;
const QUESTION_CHAR_CAP = 320;
const OPTION_CHAR_CAP = 160;
const PASSAGE_CHAR_CAP = 600;
const EXPLANATION_CHAR_CAP = 500;
const EXPLAIN_CACHE_TTL_SECS = 30 * 24 * 60 * 60; // 30 days

type Severity = 'high' | 'medium' | 'low';
type VisualizationType = 'line' | 'bar' | 'table';

export interface WeakZone {
  subjectId: string | null;
  subjectName: string;
  topicId: string | null;
  topicName: string;
  title: string;
  severity: Severity;
  rootCause: string;
  recommendations: string[];
  examples: {
    questionId: string;
    topicId: string | null;
    topic: string;
    passage: string;
    question: string;
    imageUrls: string[];
  }[];
}

export interface StudyPlanStep {
  order: number;
  focus: string;
  why: string;
  days: number;
}

export interface WeakZoneAnalysis {
  generatedAt: string;
  model: string;
  cached: boolean;
  totalOpen: number;
  overview: string;
  weakZones: WeakZone[];
  studyPlan: StudyPlanStep[];
  motivation: string;
}

export interface MistakeExplanation {
  questionId: string;
  diagnosis: string;
  correctApproach: string;
  keyConcept: string;
  tip: string;
}

export interface LessonSection {
  title: string;
  content: string;
}

export interface LessonFormula {
  latex: string;
  note: string;
}

export interface LessonVisualization {
  type: VisualizationType;
  title: string;
  xLabel: string;
  yLabel: string;
  data: { label: string; value: number; secondValue: number | null }[];
}

export interface LessonWorkedExample {
  title: string;
  question: string;
  steps: string[];
  answer: string;
  trap: string;
}

export interface LessonPracticeTask {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface TopicLesson {
  generatedAt: string;
  model: string;
  cached: boolean;
  lessonVersion: string;
  examTypeId: string;
  subjectId: string;
  topicId: string;
  subjectName: string;
  topicName: string;
  title: string;
  studentGoal: string;
  whyItMatters: string;
  sections: LessonSection[];
  formulas: LessonFormula[];
  visualizations: LessonVisualization[];
  workedExamples: LessonWorkedExample[];
  practice: LessonPracticeTask[];
  commonTraps: string[];
  checklist: string[];
  miniTest: LessonPracticeTask[];
}

// Raw shapes coming back from the model (untrusted — sanitized before use).
interface RawWeakZone {
  subjectId?: unknown;
  title?: unknown;
  severity?: unknown;
  rootCause?: unknown;
  recommendations?: unknown;
  mistakeRefs?: unknown;
}
interface RawAnalysis {
  overview?: unknown;
  weakZones?: unknown;
  studyPlan?: unknown;
  motivation?: unknown;
}
interface RawExplanation {
  diagnosis?: unknown;
  correctApproach?: unknown;
  keyConcept?: unknown;
  tip?: unknown;
}
interface RawTopicLesson {
  title?: unknown;
  studentGoal?: unknown;
  whyItMatters?: unknown;
  sections?: unknown;
  formulas?: unknown;
  visualizations?: unknown;
  workedExamples?: unknown;
  practice?: unknown;
  commonTraps?: unknown;
  checklist?: unknown;
  miniTest?: unknown;
}

@Injectable()
export class AiCoachService {
  private readonly logger = new Logger(AiCoachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mistakes: MistakesService,
    private readonly deepseek: DeepseekClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  isEnabled(): boolean {
    return this.deepseek.isEnabled();
  }

  /** Return the most recent stored analysis without calling the model (instant load). */
  async getStoredAnalysis(
    userId: string,
    examTypeId?: string,
  ): Promise<WeakZoneAnalysis | null> {
    const row = await this.prisma.aiCoachAnalysis.findFirst({
      where: { userId, examTypeId: examTypeId ?? null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return this.hydrateAnalysisExamples(
      { ...(row.result as unknown as WeakZoneAnalysis), cached: true },
      row.language === 'kk' ? 'kk' : 'ru',
    );
  }

  async analyzeWeakZones(
    userId: string,
    opts: { language: string; examTypeId?: string; force?: boolean },
  ): Promise<WeakZoneAnalysis> {
    if (!this.isEnabled()) throw new BadRequestException('AI_DISABLED');
    const language: AiLanguage = opts.language === 'kk' ? 'kk' : 'ru';

    const latest = await this.mistakes.getLatestOutcomes(userId);
    let open = latest.filter((r) => r.isCorrect === false);
    if (opts.examTypeId) open = open.filter((r) => r.examTypeId === opts.examTypeId);
    if (open.length === 0) throw new BadRequestException('NO_OPEN_MISTAKES');

    // Stable scope hash over the FULL open-mistake set → cache invalidates when it changes.
    const scopeHash = createHash('sha256')
      .update(
        [
          PROMPT_VERSION,
          this.deepseek.getModel(),
          language,
          opts.examTypeId ?? 'all',
          open
            .map((r) => r.questionId)
            .sort()
            .join(','),
        ].join('|'),
      )
      .digest('hex')
      .slice(0, 64);

    if (!opts.force) {
      const existing = await this.prisma.aiCoachAnalysis.findUnique({
        where: { userId_scopeHash: { userId, scopeHash } },
      });
      if (existing) {
        return this.hydrateAnalysisExamples(
          { ...(existing.result as unknown as WeakZoneAnalysis), cached: true },
          language,
        );
      }
    }

    // Pick top subjects by open-mistake count, sample questions within each.
    const bySubject = new Map<string, string[]>();
    for (const r of open) {
      const arr = bySubject.get(r.subjectId) ?? [];
      arr.push(r.questionId);
      bySubject.set(r.subjectId, arr);
    }
    const topSubjectIds = [...bySubject.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, MAX_SUBJECTS)
      .map(([sid]) => sid);

    const selectedQuestionIds: string[] = [];
    for (const sid of topSubjectIds) {
      const ids = (bySubject.get(sid) ?? []).slice(0, MAX_QUESTIONS_PER_SUBJECT);
      for (const id of ids) {
        if (selectedQuestionIds.length >= MAX_TOTAL_QUESTIONS) break;
        selectedQuestionIds.push(id);
      }
    }

    const [questions, answers] = await Promise.all([
      this.prisma.question.findMany({
        where: { id: { in: selectedQuestionIds }, isActive: true },
        include: {
          answerOptions: { orderBy: { sortOrder: 'asc' } },
          subject: { select: { id: true, name: true, slug: true, isMandatory: true } },
          topic: { select: { id: true, name: true } },
        },
      }),
      this.mistakes.getLatestAnswersForQuestions(userId, selectedQuestionIds),
    ]);
    const answerByQ = new Map(answers.map((a) => [a.questionId, a]));

    // Build the prompt's mistakes list + a ref→question map for sanitizing output.
    const promptMistakes: PromptMistake[] = [];
    const refToQuestion = new Map<
      number,
      {
        questionId: string;
        subjectId: string;
        subject: string;
        topicId: string | null;
        topic: string;
        passage: string;
        question: string;
        imageUrls: string[];
      }
    >();
    const subjectMeta = new Map<string, { name: string; isMandatory: boolean; slug: string }>();

    let ref = 0;
    for (const q of questions) {
      const ans = answerByQ.get(q.id);
      const selected = new Set(ans?.selectedIds ?? []);
      const subjectName = localizeFlat(q.subject.name, language, q.subject.slug);
      const topicName = localizeFlat(q.topic?.name, language, '');
      const questionText = truncate(extractQuestionText(q.content, language), QUESTION_CHAR_CAP);
      const correct = q.answerOptions
        .filter((o) => o.isCorrect)
        .map((o) => truncate(localizeFlat(o.content, language), OPTION_CHAR_CAP))
        .filter(Boolean);
      const chosen = q.answerOptions
        .filter((o) => selected.has(o.id))
        .map((o) => truncate(localizeFlat(o.content, language), OPTION_CHAR_CAP))
        .filter(Boolean);

      subjectMeta.set(q.subject.id, {
        name: subjectName,
        isMandatory: q.subject.isMandatory ?? true,
        slug: q.subject.slug,
      });
      refToQuestion.set(ref, {
        questionId: q.id,
        subjectId: q.subject.id,
        subject: subjectName,
        topicId: q.topic?.id ?? q.topicId ?? null,
        topic: topicName,
        passage: extractPassage(q.content, language),
        question: questionText,
        imageUrls: normalizeImageUrls(q.imageUrls),
      });
      promptMistakes.push({
        ref,
        questionId: q.id,
        subjectId: q.subject.id,
        subject: subjectName,
        topic: topicName,
        difficulty: q.difficulty,
        question: questionText,
        studentAnswer: chosen.join(' | ') || '(не отвечал)',
        correctAnswer: correct.join(' | '),
        timeSpentSecs: ans?.timeSpentSecs ?? null,
      });
      ref++;
    }

    if (promptMistakes.length === 0) throw new BadRequestException('NO_OPEN_MISTAKES');

    const promptSubjects: PromptSubject[] = topSubjectIds
      .filter((sid) => subjectMeta.has(sid))
      .map((sid) => {
        const meta = subjectMeta.get(sid)!;
        return {
          subjectId: sid,
          subject: meta.name,
          openCount: bySubject.get(sid)?.length ?? 0,
          maxScore: this.subjectMaxScore(meta.slug, meta.isMandatory),
        };
      });

    const raw = await this.deepseek.chatJson<RawAnalysis>({
      system: weakZoneSystemPrompt(language),
      user: weakZoneUserPrompt({
        language,
        subjects: promptSubjects,
        mistakes: promptMistakes,
        totalOpen: open.length,
      }),
      temperature: 0.4,
      maxTokens: 2600,
    });

    const analysis = await this.hydrateAnalysisExamples(
      this.sanitizeAnalysis(raw, refToQuestion, subjectMeta, open.length),
      language,
    );

    await this.prisma.aiCoachAnalysis
      .upsert({
        where: { userId_scopeHash: { userId, scopeHash } },
        create: {
          userId,
          examTypeId: opts.examTypeId ?? null,
          scopeHash,
          language,
          model: this.deepseek.getModel(),
          result: analysis as unknown as object,
        },
        update: {
          language,
          model: this.deepseek.getModel(),
          result: analysis as unknown as object,
        },
      })
      .catch((err) => this.logger.warn(`Failed to persist analysis: ${err?.message ?? err}`));

    return analysis;
  }

  async explainMistake(
    userId: string,
    opts: { questionId: string; language: string },
  ): Promise<MistakeExplanation> {
    if (!this.isEnabled()) throw new BadRequestException('AI_DISABLED');
    const language: AiLanguage = opts.language === 'kk' ? 'kk' : 'ru';

    // Privacy: only explain a question the user actually answered.
    const [ans] = await this.mistakes.getLatestAnswersForQuestions(userId, [opts.questionId]);
    if (!ans) throw new NotFoundException('NO_ANSWER_FOR_QUESTION');

    const selectedHash = createHash('sha256')
      .update([...(ans.selectedIds ?? [])].sort().join(','))
      .digest('hex')
      .slice(0, 16);
    const cacheKey = `ai:explain:${PROMPT_VERSION}:${opts.questionId}:${selectedHash}:${language}`;

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as MistakeExplanation;
      } catch {
        /* regenerate below */
      }
    }

    const question = await this.prisma.question.findUnique({
      where: { id: opts.questionId },
      include: {
        answerOptions: { orderBy: { sortOrder: 'asc' } },
        subject: { select: { name: true, slug: true } },
        topic: { select: { name: true } },
      },
    });
    if (!question) throw new NotFoundException('QUESTION_NOT_FOUND');

    const selected = new Set(ans.selectedIds ?? []);
    const options = question.answerOptions.map((o) => ({
      text: truncate(localizeFlat(o.content, language), OPTION_CHAR_CAP),
      isCorrect: o.isCorrect,
      chosen: selected.has(o.id),
    }));

    const raw = await this.deepseek.chatJson<RawExplanation>({
      system: explainSystemPrompt(language),
      user: explainUserPrompt({
        subject: localizeFlat(question.subject.name, language, question.subject.slug),
        topic: localizeFlat(question.topic?.name, language, ''),
        question: truncate(extractQuestionText(question.content, language), QUESTION_CHAR_CAP),
        passage: truncate(extractPassage(question.content, language), PASSAGE_CHAR_CAP),
        options,
      }),
      temperature: 0.3,
      maxTokens: 1200,
    });

    const explanation: MistakeExplanation = {
      questionId: opts.questionId,
      diagnosis: asText(raw.diagnosis),
      correctApproach: asText(raw.correctApproach),
      keyConcept: asText(raw.keyConcept),
      tip: asText(raw.tip),
    };

    await this.redis
      .set(cacheKey, JSON.stringify(explanation), 'EX', EXPLAIN_CACHE_TTL_SECS)
      .catch(() => undefined);

    return explanation;
  }

  async getTopicLesson(
    userId: string,
    opts: { topicId: string; language: string; force?: boolean },
  ): Promise<TopicLesson> {
    if (!this.isEnabled()) throw new BadRequestException('AI_DISABLED');
    const language: AiLanguage = opts.language === 'kk' ? 'kk' : 'ru';

    const latest = await this.mistakes.getLatestOutcomes(userId);
    const hasOpenMistakeInTopic = latest.some(
      (r) => r.isCorrect === false && r.topicId === opts.topicId,
    );
    if (!hasOpenMistakeInTopic) {
      throw new BadRequestException('NO_OPEN_MISTAKES_FOR_TOPIC');
    }

    const topic = await this.prisma.topic.findUnique({
      where: { id: opts.topicId },
      include: {
        subject: {
          include: {
            examType: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!topic) throw new NotFoundException('TOPIC_NOT_FOUND');

    if (!opts.force) {
      const existing = await this.prisma.aiTopicLesson.findUnique({
        where: {
          topicId_language_lessonVersion: {
            topicId: opts.topicId,
            language,
            lessonVersion: LESSON_VERSION,
          },
        },
      });
      if (existing) {
        return { ...(existing.result as unknown as TopicLesson), cached: true };
      }
    }

    const sourceQuestions = await this.prisma.question.findMany({
      where: { topicId: opts.topicId, isActive: true },
      include: {
        answerOptions: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
      take: MAX_LESSON_SAMPLE_QUESTIONS,
    });
    if (sourceQuestions.length === 0) throw new BadRequestException('NO_TOPIC_QUESTIONS');

    const subjectName = localizeFlat(topic.subject.name, language, topic.subject.slug);
    const topicName = localizeFlat(topic.name, language, '');
    const examName = localizeFlat(
      topic.subject.examType.name,
      language,
      topic.subject.examType.slug,
    );

    const promptQuestions: PromptLessonQuestion[] = sourceQuestions.map((q, i) => ({
      ref: i,
      difficulty: q.difficulty,
      question: truncate(extractQuestionText(q.content, language), QUESTION_CHAR_CAP),
      correctAnswer: q.answerOptions
        .filter((o) => o.isCorrect)
        .map((o) => truncate(localizeFlat(o.content, language), OPTION_CHAR_CAP))
        .filter(Boolean)
        .join(' | '),
      explanation: truncate(localizeFlat(q.explanation, language), EXPLANATION_CHAR_CAP),
    }));

    const sourceHash = createHash('sha256')
      .update(
        [
          LESSON_VERSION,
          this.deepseek.getModel(),
          language,
          opts.topicId,
          sourceQuestions.map((q) => `${q.id}:${q.updatedAt.toISOString()}`).join(','),
        ].join('|'),
      )
      .digest('hex')
      .slice(0, 64);

    const raw = await this.deepseek.chatJson<RawTopicLesson>({
      system: topicLessonSystemPrompt(language),
      user: topicLessonUserPrompt({
        language,
        exam: examName,
        subject: subjectName,
        topic: topicName,
        questions: promptQuestions,
      }),
      temperature: 0.35,
      maxTokens: 4200,
      timeoutMs: 90_000,
    });

    const lesson = this.sanitizeTopicLesson(raw, {
      examTypeId: topic.subject.examType.id,
      subjectId: topic.subject.id,
      topicId: topic.id,
      subjectName,
      topicName,
    });

    await this.prisma.aiTopicLesson
      .upsert({
        where: {
          topicId_language_lessonVersion: {
            topicId: opts.topicId,
            language,
            lessonVersion: LESSON_VERSION,
          },
        },
        create: {
          examTypeId: topic.subject.examType.id,
          subjectId: topic.subject.id,
          topicId: topic.id,
          language,
          lessonVersion: LESSON_VERSION,
          model: this.deepseek.getModel(),
          title: truncate(lesson.title, 180),
          sourceHash,
          result: lesson as unknown as object,
        },
        update: {
          model: this.deepseek.getModel(),
          title: truncate(lesson.title, 180),
          sourceHash,
          result: lesson as unknown as object,
        },
      })
      .catch((err) => this.logger.warn(`Failed to persist topic lesson: ${err?.message ?? err}`));

    return lesson;
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  /** Rough ENT scoring weight hint for the prompt. */
  private subjectMaxScore(slug: string, isMandatory: boolean): number {
    const s = slug.toLowerCase();
    if (s.includes('hist') || s.includes('tarih') || s.includes('istor')) return 20;
    if (!isMandatory) return 50; // profile subjects
    return 10; // math/reading literacy
  }

  private sanitizeAnalysis(
    raw: RawAnalysis,
    refToQuestion: Map<
      number,
      {
        questionId: string;
        subjectId: string;
        subject: string;
        topicId: string | null;
        topic: string;
        passage: string;
        question: string;
        imageUrls: string[];
      }
    >,
    subjectMeta: Map<string, { name: string; isMandatory: boolean; slug: string }>,
    totalOpen: number,
  ): WeakZoneAnalysis {
    const rawZones = Array.isArray(raw.weakZones) ? raw.weakZones : [];
    const weakZones: WeakZone[] = [];
    for (const z of rawZones as RawWeakZone[]) {
      const subjectId =
        typeof z.subjectId === 'string' && subjectMeta.has(z.subjectId) ? z.subjectId : null;
      const refs = Array.isArray(z.mistakeRefs)
        ? (z.mistakeRefs as unknown[])
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && refToQuestion.has(n))
        : [];
      const examples = refs
        .map((n) => refToQuestion.get(n)!)
        .map((q) => ({
          questionId: q.questionId,
          topicId: q.topicId,
          topic: q.topic,
          passage: q.passage,
          question: q.question,
          imageUrls: q.imageUrls,
        }))
        // de-dupe by questionId
        .filter((q, i, arr) => arr.findIndex((x) => x.questionId === q.questionId) === i)
        .slice(0, 5);
      const topicCounts = new Map<string, { count: number; name: string }>();
      for (const ex of examples) {
        if (!ex.topicId) continue;
        const current = topicCounts.get(ex.topicId) ?? { count: 0, name: ex.topic };
        current.count++;
        if (ex.topic) current.name = ex.topic;
        topicCounts.set(ex.topicId, current);
      }
      const primaryTopic = [...topicCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
      const recommendations = Array.isArray(z.recommendations)
        ? (z.recommendations as unknown[]).map(asText).filter(Boolean).slice(0, 5)
        : [];
      const title = asText(z.title);
      if (!title && !asText(z.rootCause)) continue; // skip empty zones
      weakZones.push({
        subjectId,
        subjectName: subjectId ? subjectMeta.get(subjectId)!.name : '',
        topicId: primaryTopic?.[0] ?? null,
        topicName: primaryTopic?.[1].name ?? '',
        title: title || 'Слабая зона',
        severity: normalizeSeverity(z.severity),
        rootCause: asText(z.rootCause),
        recommendations,
        examples,
      });
    }

    const rawPlan = Array.isArray(raw.studyPlan) ? raw.studyPlan : [];
    const studyPlan: StudyPlanStep[] = (rawPlan as Record<string, unknown>[])
      .map((s, i) => ({
        order: Number.isInteger(Number(s.order)) ? Number(s.order) : i + 1,
        focus: asText(s.focus),
        why: asText(s.why),
        days: Math.max(1, Math.min(60, Number(s.days) || 3)),
      }))
      .filter((s) => s.focus)
      .slice(0, 7);

    return {
      generatedAt: new Date().toISOString(),
      model: this.deepseek.getModel(),
      cached: false,
      totalOpen,
      overview: asText(raw.overview),
      weakZones,
      studyPlan,
      motivation: asText(raw.motivation),
    };
  }

  private sanitizeTopicLesson(
    raw: RawTopicLesson,
    meta: {
      examTypeId: string;
      subjectId: string;
      topicId: string;
      subjectName: string;
      topicName: string;
    },
  ): TopicLesson {
    const sections = asRecordList(raw.sections)
      .map((s) => ({
        title: asText(s.title).slice(0, 140),
        content: asText(s.content),
      }))
      .filter((s) => s.title || s.content)
      .slice(0, 6);

    const formulas = asRecordList(raw.formulas)
      .map((f) => ({
        latex: asText(f.latex).replace(/^\$+|\$+$/g, '').trim(),
        note: asText(f.note),
      }))
      .filter((f) => f.latex || f.note)
      .slice(0, 6);

    const visualizations = asRecordList(raw.visualizations)
      .map((v) => ({
        type: normalizeVisualizationType(v.type),
        title: asText(v.title).slice(0, 140),
        xLabel: asText(v.xLabel).slice(0, 80),
        yLabel: asText(v.yLabel).slice(0, 80),
        data: asRecordList(v.data)
          .map((p) => ({
            label: asText(p.label).slice(0, 60),
            value: toFiniteNumber(p.value),
            secondValue: toNullableFiniteNumber(p.secondValue),
          }))
          .filter((p) => p.label && p.value !== null)
          .map((p) => ({ ...p, value: p.value ?? 0 }))
          .slice(0, 12),
      }))
      .filter((v) => v.title && v.data.length > 0)
      .slice(0, 3);

    const workedExamples = asRecordList(raw.workedExamples)
      .map((ex) => ({
        title: asText(ex.title).slice(0, 140),
        question: asText(ex.question),
        steps: asTextList(ex.steps, 8),
        answer: asText(ex.answer),
        trap: asText(ex.trap),
      }))
      .filter((ex) => ex.question || ex.steps.length > 0)
      .slice(0, 4);

    const practice = sanitizePractice(raw.practice, 6);
    const miniTest = sanitizePractice(raw.miniTest, 5);
    const title = asText(raw.title) || `Урок: ${meta.topicName || 'тема'}`;

    return {
      generatedAt: new Date().toISOString(),
      model: this.deepseek.getModel(),
      cached: false,
      lessonVersion: LESSON_VERSION,
      examTypeId: meta.examTypeId,
      subjectId: meta.subjectId,
      topicId: meta.topicId,
      subjectName: meta.subjectName,
      topicName: meta.topicName,
      title,
      studentGoal: asText(raw.studentGoal),
      whyItMatters: asText(raw.whyItMatters),
      sections,
      formulas,
      visualizations,
      workedExamples,
      practice,
      commonTraps: asTextList(raw.commonTraps, 8),
      checklist: asTextList(raw.checklist, 8),
      miniTest,
    };
  }

  private async hydrateAnalysisExamples(
    analysis: WeakZoneAnalysis,
    language: AiLanguage,
  ): Promise<WeakZoneAnalysis> {
    const ids = [
      ...new Set(
        analysis.weakZones.flatMap((zone) =>
          zone.examples.map((example) => example.questionId).filter(Boolean),
        ),
      ),
    ];
    if (ids.length === 0) return analysis;

    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        content: true,
        imageUrls: true,
        topicId: true,
        topic: { select: { name: true } },
      },
    });
    const byId = new Map(
      questions.map((q) => [
        q.id,
        {
          topicId: q.topicId,
          topic: localizeFlat(q.topic?.name, language, ''),
          passage: extractPassage(q.content, language),
          question: extractQuestionText(q.content, language),
          imageUrls: normalizeImageUrls(q.imageUrls),
        },
      ]),
    );

    return {
      ...analysis,
      weakZones: analysis.weakZones.map((zone) => ({
        ...zone,
        examples: zone.examples.map((example) => {
          const hydrated = byId.get(example.questionId);
          if (!hydrated) {
            return {
              ...example,
              passage: example.passage ?? '',
              imageUrls: normalizeImageUrls(example.imageUrls),
            };
          }
          return {
            ...example,
            topicId: example.topicId ?? hydrated.topicId,
            topic: hydrated.topic || example.topic,
            passage: hydrated.passage,
            question: hydrated.question || example.question,
            imageUrls: hydrated.imageUrls,
          };
        }),
      })),
    };
  }
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function normalizeSeverity(value: unknown): Severity {
  const s = typeof value === 'string' ? value.toLowerCase() : '';
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'medium';
}

function normalizeVisualizationType(value: unknown): VisualizationType {
  const s = typeof value === 'string' ? value.toLowerCase() : '';
  if (s === 'line' || s === 'bar' || s === 'table') return s;
  return 'table';
}

function asRecordList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

function asTextList(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.map(asText).filter(Boolean).slice(0, limit) : [];
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toNullableFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  return toFiniteNumber(value);
}

function sanitizePractice(value: unknown, limit: number): LessonPracticeTask[] {
  return asRecordList(value)
    .map((task) => ({
      prompt: asText(task.prompt),
      options: asTextList(task.options, 6),
      answer: asText(task.answer),
      explanation: asText(task.explanation),
    }))
    .filter((task) => task.prompt && (task.answer || task.explanation))
    .slice(0, limit);
}

function normalizeImageUrls(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
}
