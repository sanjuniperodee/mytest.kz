import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { ParentReportDto, ParentReportLinkDto } from '@bilimland/shared';
import { AdmissionGoalService } from '../admission/admission-goal.service';
import { TestScorerService } from '../tests/test-scorer.service';
import {
  buildParentReport,
  normalizeParentReportLang,
  pickWeakSubjectsSession,
  type ParentReportGoalInput,
  type ParentReportSection,
} from './domain/parent-report';
import {
  signParentReportToken,
  verifyParentReportToken,
} from './domain/parent-report-token';
import { ParentReportRepository } from './infrastructure/parent-report.repository';

/** Ссылка живёт год с последней отправки; ученик может отозвать её в любой момент. */
const LINK_TTL_SECS = 365 * 24 * 60 * 60;
/** Короткий кэш: родитель обновляет страницу, мессенджеры строят превью. */
const REPORT_CACHE_SECS = 60;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const PARENT_REPORT_NOT_FOUND = 'PARENT_REPORT_NOT_FOUND';

@Injectable()
export class ParentReportService {
  private readonly logger = new Logger(ParentReportService.name);

  constructor(
    private readonly repository: ParentReportRepository,
    private readonly scorer: TestScorerService,
    private readonly goals: AdmissionGoalService,
    private readonly config: ConfigService,
  ) {}

  async getLink(userId: string): Promise<ParentReportLinkDto> {
    const version = await this.repository.getLinkVersion(userId);
    return { url: version ? this.url(userId, version) : null };
  }

  /** Повторная отправка возвращает ту же ссылку (закладка у родителя не ломается). */
  async createLink(userId: string): Promise<{ url: string }> {
    let version = await this.repository.getLinkVersion(userId);
    if (!version) {
      await this.repository.createLinkVersionIfAbsent(userId, this.randomVersion(), LINK_TTL_SECS);
      version = await this.repository.getLinkVersion(userId);
      if (!version) throw new Error('Parent report link was not stored');
    } else {
      await this.repository.touchLink(userId, LINK_TTL_SECS);
    }
    return { url: this.url(userId, version) };
  }

  /** Старая ссылка перестаёт открываться сразу; следующая отправка создаст новую. */
  async revokeLink(userId: string): Promise<{ revoked: true }> {
    await this.repository.deleteLink(userId);
    return { revoked: true };
  }

  async getPublicReport(token: string, langRaw?: unknown): Promise<ParentReportDto> {
    const payload = verifyParentReportToken(token, this.secret());
    // Подделка, отзыв и удалённый аккаунт неотличимы снаружи — один и тот же 404.
    if (!payload) throw this.notFound();
    const current = await this.repository.getLinkVersion(payload.userId);
    if (current !== payload.version) throw this.notFound();

    const lang = normalizeParentReportLang(langRaw);
    const cached = await this.repository
      .getCachedReport(payload.userId, payload.version, lang)
      .catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as ParentReportDto;
      } catch {
        // битый кэш — пересчитаем
      }
    }

    const report = await this.buildReport(payload.userId, lang);
    if (!report) throw this.notFound();
    await this.repository
      .cacheReport(payload.userId, payload.version, lang, JSON.stringify(report), REPORT_CACHE_SECS)
      .catch(() => undefined);
    return report;
  }

  /** null — пользователя нет (аккаунт удалён). */
  async buildReport(userId: string, lang: 'ru' | 'kk', now = new Date()): Promise<ParentReportDto | null> {
    const student = await this.repository.findStudent(userId);
    if (!student) return null;

    const [sessions, testsLast7Days, plan, goal] = await Promise.all([
      this.repository.entSessions(userId),
      this.repository.countFinishedSince(userId, new Date(now.getTime() - WEEK_MS)),
      this.repository.activePlan(userId, now),
      this.loadGoal(userId),
    ]);

    const weakSession = pickWeakSubjectsSession(sessions);
    let weakSections: ParentReportSection[] | null = null;
    if (weakSession) {
      try {
        const scored = await this.scorer.calculateScore(weakSession.id, undefined, { readOnly: true });
        weakSections = scored.sections;
      } catch (error) {
        this.logger.warn(`Parent report: cannot score ${weakSession.id}: ${String(error)}`);
      }
    }

    return buildParentReport({
      lang,
      now,
      firstName: student.firstName,
      sessions,
      testsLast7Days,
      weakSession,
      weakSections,
      goal,
      plan,
    });
  }

  private async loadGoal(userId: string): Promise<ParentReportGoalInput | null> {
    try {
      const { goal } = await this.goals.getGoal(userId);
      return goal;
    } catch (error) {
      this.logger.warn(`Parent report: goal unavailable: ${String(error)}`);
      return null;
    }
  }

  private url(userId: string, version: number): string {
    const site = (this.config.get<string>('PUBLIC_SITE_URL') || 'https://my-test.kz').replace(/\/+$/, '');
    return `${site}/progress/${signParentReportToken({ userId, version }, this.secret())}`;
  }

  private secret(): string {
    const secret =
      this.config.get<string>('PARENT_REPORT_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim();
    if (!secret) throw new Error('PARENT_REPORT_SECRET or JWT_SECRET is required');
    return secret;
  }

  private randomVersion(): number {
    // 1…2^32−1: после отзыва новая версия случайна, старые токены не оживают даже при потере Redis.
    return (randomBytes(4).readUInt32BE(0) % 0xfffffffe) + 1;
  }

  private notFound() {
    return new NotFoundException({
      code: PARENT_REPORT_NOT_FOUND,
      message: 'Ссылка на отчёт недействительна или отозвана',
    });
  }
}
