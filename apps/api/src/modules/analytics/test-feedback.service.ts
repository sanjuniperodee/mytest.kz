import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TestFeedbackDto } from './test-feedback.dto';

@Injectable()
export class TestFeedbackService {
  constructor(private readonly db: PrismaService) {}

  private async authorize(userId: string, sessionId: string) {
    const session = await this.db.testSession.findFirst({
      where: { id: sessionId, userId }, select: { status: true },
    });
    if (!session) throw new NotFoundException();
    if (!['completed', 'timed_out'].includes(session.status))
      throw new BadRequestException('Отзыв доступен после завершения пробного');
  }

  async get(userId: string, sessionId: string) {
    await this.authorize(userId, sessionId);
    return this.db.testFeedback.findUnique({ where: { sessionId } });
  }

  async mark(userId: string, sessionId: string, event: 'shown' | 'skipped') {
    await this.authorize(userId, sessionId);
    const field = event === 'shown' ? 'shownAt' : 'skippedAt';
    await this.db.testFeedback.upsert({ where: { sessionId }, create: { sessionId }, update: {} });
    await this.db.testFeedback.updateMany({
      where: { sessionId, [field]: null, submittedAt: null }, data: { [field]: new Date() },
    });
    return { ok: true };
  }

  async submit(userId: string, sessionId: string, dto: TestFeedbackDto) {
    await this.authorize(userId, sessionId);
    // One response per test, including concurrent retries; later retries do not
    // change submission time and move the response into another reporting day.
    await this.db.testFeedback.upsert({ where: { sessionId }, create: { sessionId }, update: {} });
    await this.db.testFeedback.updateMany({
      where: { sessionId, submittedAt: null },
      data: { ...dto, submittedAt: new Date(), skippedAt: null },
    });
    return this.db.testFeedback.findUnique({ where: { sessionId } });
  }
}
