import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import type {
  BatchQuestionsDto,
  CreateTestTemplateDto,
  CreateTopicDto,
  PatchBulkQuestionDto,
  UpsertExamTypeDto,
  UpsertSubjectDto,
} from './dto/bulk-import.dto';

function nameJson(ru: string, kk?: string, en?: string): Prisma.InputJsonValue {
  return { kk: kk ?? '', ru, en: en ?? '' };
}

@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
  ) {}

  status() {
    const enabled = process.env.BULK_IMPORT_ENABLED === 'true';
    const tokenRequired = Boolean(
      process.env.BULK_IMPORT_SECRET && process.env.BULK_IMPORT_SECRET.length > 0,
    );
    return { bulkImportEnabled: enabled, tokenRequired };
  }

  async getCatalog() {
    return this.prisma.examType.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        subjects: {
          orderBy: { sortOrder: 'asc' },
          include: {
            topics: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  async upsertExamType(dto: UpsertExamTypeDto) {
    const name = nameJson(dto.nameRu, dto.nameKk, dto.nameEn);
    const description =
      dto.descriptionRu != null
        ? nameJson(dto.descriptionRu, dto.descriptionKk, dto.descriptionEn)
        : undefined;

    const existing = await this.prisma.examType.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      return this.prisma.examType.update({
        where: { id: existing.id },
        data: {
          name,
          ...(description !== undefined ? { description } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    }
    return this.prisma.examType.create({
      data: {
        slug: dto.slug,
        name,
        description: description ?? Prisma.DbNull,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async upsertSubject(dto: UpsertSubjectDto) {
    const exam = await this.prisma.examType.findUnique({
      where: { slug: dto.examTypeSlug },
    });
    if (!exam) {
      throw new BadRequestException(`examType not found: ${dto.examTypeSlug}`);
    }
    const name = nameJson(dto.nameRu, dto.nameKk, dto.nameEn);
    const existing = await this.prisma.subject.findUnique({
      where: {
        examTypeId_slug: { examTypeId: exam.id, slug: dto.slug },
      },
    });
    if (existing) {
      return this.prisma.subject.update({
        where: { id: existing.id },
        data: {
          name,
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isMandatory !== undefined ? { isMandatory: dto.isMandatory } : {}),
        },
      });
    }
    return this.prisma.subject.create({
      data: {
        examTypeId: exam.id,
        slug: dto.slug,
        name,
        sortOrder: dto.sortOrder ?? 0,
        isMandatory: dto.isMandatory ?? false,
      },
    });
  }

  async createTopic(dto: CreateTopicDto) {
    let subjectId = dto.subjectId;
    if (!subjectId) {
      if (!dto.examTypeSlug || !dto.subjectSlug) {
        throw new BadRequestException('Provide subjectId or examTypeSlug + subjectSlug');
      }
      const { subject } = await this.resolveSubject(dto.examTypeSlug, dto.subjectSlug);
      subjectId = subject.id;
    }
    const name = nameJson(dto.topicNameRu, dto.topicNameKk, dto.topicNameEn);
    const maxSort = await this.prisma.topic.aggregate({
      where: { subjectId },
      _max: { sortOrder: true },
    });
    return this.prisma.topic.create({
      data: {
        subjectId,
        name,
        sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  private async resolveSubject(examTypeSlug: string, subjectSlug: string) {
    const exam = await this.prisma.examType.findUnique({
      where: { slug: examTypeSlug },
    });
    if (!exam) {
      throw new BadRequestException(`examType not found: ${examTypeSlug}`);
    }
    const subject = await this.prisma.subject.findUnique({
      where: {
        examTypeId_slug: { examTypeId: exam.id, slug: subjectSlug },
      },
    });
    if (!subject) {
      throw new BadRequestException(
        `subject not found: ${subjectSlug} for exam ${examTypeSlug}`,
      );
    }
    return { exam, subject };
  }

  private async findOrCreateTopic(subjectId: string, topicNameRu: string) {
    const normalized = topicNameRu.trim();
    const topics = await this.prisma.topic.findMany({ where: { subjectId } });
    const existing = topics.find((t) => {
      const n = t.name as Record<string, string>;
      const ru = typeof n?.ru === 'string' ? n.ru.trim().toLowerCase() : '';
      return ru === normalized.toLowerCase();
    });
    if (existing) return existing;
    const maxSort = await this.prisma.topic.aggregate({
      where: { subjectId },
      _max: { sortOrder: true },
    });
    return this.prisma.topic.create({
      data: {
        subjectId,
        name: nameJson(normalized),
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async batchQuestions(dto: BatchQuestionsDto) {
    const created: { id: string; index: number }[] = [];
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < dto.questions.length; i++) {
      const q = dto.questions[i];
      try {
        const { exam, subject } = await this.resolveSubject(q.examTypeSlug, q.subjectSlug);
        const topic = await this.findOrCreateTopic(subject.id, q.topicNameRu);

        const content: Prisma.InputJsonValue = {
          kk: { text: q.contentKk ?? '' },
          ru: { text: q.contentRu },
          en: { text: q.contentEn ?? '' },
        };

        let explanation: Prisma.InputJsonValue | undefined;
        if (q.explanationRu != null && q.explanationRu !== '') {
          explanation = {
            kk: q.explanationKk ?? '',
            ru: q.explanationRu,
            en: q.explanationEn ?? '',
          };
        }

        const answerOptions = q.answers.map((a, idx) => ({
          content: {
            kk: a.textKk ?? '',
            ru: a.textRu,
            en: a.textEn ?? '',
          } as Prisma.InputJsonValue,
          isCorrect: a.isCorrect,
          sortOrder: idx,
        }));

        const row = await this.questionsService.create({
          topicId: topic.id,
          subjectId: subject.id,
          examTypeId: exam.id,
          difficulty: q.difficulty,
          type: q.type,
          content,
          explanation,
          contentLocale: q.contentLocale ?? 'ru',
          answerOptions,
        });
        created.push({ id: row.id, index: i });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ index: i, message });
      }
    }

    return {
      created: created.length,
      failed: errors.length,
      items: created,
      errors,
    };
  }

  async createTestTemplate(dto: CreateTestTemplateDto) {
    const exam = await this.prisma.examType.findUnique({
      where: { slug: dto.examTypeSlug },
    });
    if (!exam) {
      throw new BadRequestException(`examType not found: ${dto.examTypeSlug}`);
    }
    const name = nameJson(dto.nameRu, dto.nameKk, dto.nameEn);

    const sectionsData: {
      subjectId: string;
      questionCount: number;
      selectionMode: string;
      sortOrder: number;
    }[] = [];
    for (let i = 0; i < dto.sections.length; i++) {
      const s = dto.sections[i];
      const subject = await this.prisma.subject.findUnique({
        where: {
          examTypeId_slug: { examTypeId: exam.id, slug: s.subjectSlug },
        },
      });
      if (!subject) {
        throw new BadRequestException(
          `subject ${s.subjectSlug} not found for exam ${dto.examTypeSlug}`,
        );
      }
      sectionsData.push({
        subjectId: subject.id,
        questionCount: s.questionCount,
        selectionMode: s.selectionMode ?? 'random',
        sortOrder: s.sortOrder ?? i,
      });
    }

    return this.prisma.testTemplate.create({
      data: {
        examTypeId: exam.id,
        name,
        durationMins: dto.durationMins,
        isActive: true,
        sections: {
          create: sectionsData.map((sec) => ({
            subject: { connect: { id: sec.subjectId } },
            questionCount: sec.questionCount,
            selectionMode: sec.selectionMode,
            sortOrder: sec.sortOrder,
          })),
        },
      },
      include: { sections: { include: { subject: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async patchQuestion(id: string, dto: PatchBulkQuestionDto) {
    const exists = await this.prisma.question.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`question ${id}`);
    }
    const data: Prisma.QuestionUpdateInput = {};
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.content !== undefined) data.content = dto.content as Prisma.InputJsonValue;
    if (dto.explanation === undefined) {
      // skip
    } else if (dto.explanation === null) {
      data.explanation = Prisma.DbNull;
    } else {
      data.explanation = dto.explanation as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    return this.questionsService.update(id, data);
  }

  async listQuestions(params: {
    examTypeId?: string;
    subjectId?: string;
    page?: number;
    limit?: number;
  }) {
    return this.questionsService.findMany({
      examTypeId: params.examTypeId,
      subjectId: params.subjectId,
      page: params.page ?? 1,
      limit: Math.min(params.limit ?? 30, 100),
    });
  }
}
