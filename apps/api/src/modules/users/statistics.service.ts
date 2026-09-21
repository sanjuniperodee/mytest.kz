import { Injectable } from '@nestjs/common';
import { buildStatistics, StatisticsFilter } from './domain/statistics';
import { StatisticsRepository } from './infrastructure/statistics.repository';

@Injectable()
export class StatisticsService {
  constructor(private readonly repository: StatisticsRepository) {}
  async get(userId: string, query: StatisticsFilter) {
    const now = new Date();
    const [rows, exams] = await Promise.all([
      this.repository.sessions(userId, query, now),
      this.repository.exams(userId),
    ]);
    const { sessionIds, report } = buildStatistics(rows, query);
    const subjects = await this.repository.subjects(userId, sessionIds);
    return {
      ...report,
      subjects,
      exams,
      filters: { ...query, page: report.page },
      generatedAt: now.toISOString(),
    };
  }
}
