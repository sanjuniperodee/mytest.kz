import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { TestFeedbackController } from '../src/modules/analytics/test-feedback.controller';
import { TestFeedbackService } from '../src/modules/analytics/test-feedback.service';
import { GrowthAnalyticsService, growthPeriod } from '../src/modules/analytics/growth-analytics.service';
import { AdminAnalyticsController } from '../src/modules/admin/admin-analytics.controller';
import { AdminAnalyticsService } from '../src/modules/admin/services/admin-analytics.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AdminGuard } from '../src/common/guards/admin.guard';

describe('growth reporting dates', () => {
  it('includes the whole final Almaty day and rejects malformed/reversed dates', () => {
    expect(growthPeriod('2026-09-14','2026-09-14').end.toISOString()).toBe('2026-09-14T19:00:00.000Z');
    expect(() => growthPeriod(undefined,'bad')).toThrow();
    expect(() => growthPeriod('2026-02-30','2026-03-01')).toThrow();
    expect(() => growthPeriod('2026-09-15','2026-09-14')).toThrow();
  });
});

const url = process.env.SALES_TEST_DATABASE_URL;
(url ? describe : describe.skip)('feedback HTTP and PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  const user = randomUUID(), outsider = randomUUID(), admin = randomUUID(), exam = randomUUID();
  const finished = randomUUID(), active = randomUUID();
  const body = { rating: 3, blocker:'payment', intent:'maybe', comment:'  Оплата не открылась  ', locale:'ru' };
  const path = `/tests/sessions/${finished}/feedback`;
  beforeAll(async () => {
    if (!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Isolated local database only');
    process.env.DATABASE_URL = url;
    const module = await Test.createTestingModule({
      controllers: [TestFeedbackController, AdminAnalyticsController],
      providers: [PrismaService, TestFeedbackService, GrowthAnalyticsService, AdminGuard,
        { provide: AdminAnalyticsService, useValue:{} }, { provide: AnalyticsService, useValue:{} }],
    }).overrideGuard(AuthGuard('jwt')).useValue({ canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      if (!req.headers['x-test-user']) throw new UnauthorizedException();
      req.user = { id:req.headers['x-test-user'], isAdmin:true }; return true;
    } }).compile();
    app = module.createNestApplication(); await app.init(); db = module.get(PrismaService);
    await db.user.createMany({ data:[{id:user}, {id:outsider}, {id:admin,isAdmin:true}] });
    await db.examType.create({ data:{ id:exam, slug:exam.slice(0,20), name:{ru:'Test'} } });
    await db.testSession.createMany({ data:[
      { id:finished, userId:user, examTypeId:exam, language:'ru', totalQuestions:1, status:'completed', finishedAt:new Date() },
      { id:active, userId:user, examTypeId:exam, language:'ru', totalQuestions:1 },
    ] });
  });
  afterAll(async () => {
    if (db) {
      await db.testSession.deleteMany({ where:{ id:{in:[finished,active]} } });
      await db.visitEvent.deleteMany({ where:{ userId:{in:[user,outsider,admin]} } });
      await db.examType.deleteMany({where:{id:exam}});
      await db.user.deleteMany({where:{id:{in:[user,outsider,admin]}}});
    }
    await app?.close();
  });
  it('enforces ownership, completion and DTO validation', async () => {
    await request(app.getHttpServer()).put(path).send(body).expect(401);
    await request(app.getHttpServer()).put(path).set('x-test-user', outsider).send(body).expect(404);
    await request(app.getHttpServer()).put(`/tests/sessions/${active}/feedback`).set('x-test-user',user).send(body).expect(400);
    for (const invalid of [{...body,rating:6},{...body,blocker:'bogus'},{...body,userId:outsider},{...body,comment:'x'.repeat(1001)}])
      await request(app.getHttpServer()).put(path).set('x-test-user',user).send(invalid).expect(400);
  });
  it('preserves one submission during retries and cannot skip a submitted response', async () => {
    await request(app.getHttpServer()).post(`${path}/shown`).set('x-test-user',user).expect(201);
    const results = await Promise.all([1,2,3].map(() => request(app.getHttpServer()).put(path).set('x-test-user',user).send(body).expect(200)));
    expect(new Set(results.map(r => r.body.submittedAt)).size).toBe(1);
    expect(results[0].body.comment).toBe('Оплата не открылась');
    await request(app.getHttpServer()).post(`${path}/skip`).set('x-test-user',user).expect(201);
    expect((await db.testFeedback.findUniqueOrThrow({where:{sessionId:finished}})).skippedAt).toBeNull();
    expect(await db.testFeedback.count({where:{sessionId:finished}})).toBe(1);
  });
  it('retains different checkout errors while suppressing identical retry noise', async () => {
    const analytics = new AnalyticsService(db);
    const event = { userId:user, sessionId:finished, step:'checkout_error', metadata:{provider:'kaspi',reason:'invalid_phone',planCode:'starter'} };
    expect((await analytics.recordEvent(event)).recorded).toBe(true);
    expect((await analytics.recordEvent(event)).recorded).toBe(false);
    expect((await analytics.recordEvent({...event, metadata:{...event.metadata,reason:'request_failed'}})).recorded).toBe(true);
  });
  it('admin report uses database role and returns real persisted feedback', async () => {
    await request(app.getHttpServer()).get('/admin/analytics/growth').set('x-test-user',user).expect(403);
    const result = await request(app.getHttpServer()).get('/admin/analytics/growth').set('x-test-user',admin).expect(200);
    expect(result.body.responses.some((r: {sessionId:string}) => r.sessionId === finished)).toBe(true);
    expect(result.body.checkoutErrors.some((r: {reason:string}) => r.reason === 'request_failed')).toBe(true);
    expect(result.body.cohort.finished).toBeLessThanOrEqual(result.body.cohort.started);
    expect(result.body.cohort.paid).toBeLessThanOrEqual(result.body.cohort.finished);
    await request(app.getHttpServer()).get('/admin/analytics/growth?to=bad').set('x-test-user',admin).expect(400);
  });
});
