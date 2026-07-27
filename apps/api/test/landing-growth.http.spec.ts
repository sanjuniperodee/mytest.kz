import { LeadStatus } from '@prisma/client';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { LeadsService } from '../src/modules/leads/leads.service';
import { SettingsService } from '../src/modules/settings/settings.service';

describe('landing growth contracts', () => {
  it('records only whitelisted anonymous funnel events with bounded metadata', async () => {
    const prismaMock = {
      visitEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'visit-1' }),
      },
      funnelStep: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'step-1' }),
      },
    } as any;
    const service = new AnalyticsService(prismaMock);

    const result = await service.recordPublicEvent({
      visitorId: 'visitor-1',
      step: 'diagnostic_completed',
      landingPath: '/',
      metadata: {
        currentScore: 78,
        targetScore: 105,
        plan: 'Системный маршрут',
        ignored: { nested: 'payload' },
      },
    });

    expect(result).toEqual({ recorded: true });
    expect(prismaMock.funnelStep.create).toHaveBeenCalledWith({
      data: {
        visitId: 'visit-1',
        step: 'diagnostic_completed',
        metadata: {
          currentScore: 78,
          targetScore: 105,
          plan: 'Системный маршрут',
          path: '/',
        },
      },
    });

    await expect(
      service.recordPublicEvent({
        visitorId: 'visitor-1',
        step: 'arbitrary_event',
      }),
    ).resolves.toEqual({ recorded: false, reason: 'UNKNOWN_STEP' });
  });

  it('builds public proof from real platform counts and caches it briefly', async () => {
    const prismaMock = {
      user: { count: jest.fn().mockResolvedValue(120) },
      testSession: {
        count: jest.fn().mockResolvedValueOnce(640).mockResolvedValueOnce(88),
      },
      question: { count: jest.fn().mockResolvedValue(3200) },
    } as any;
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    } as any;
    const service = new SettingsService(prismaMock, redisMock);

    const result = await service.getLandingProof();

    expect(result).toMatchObject({
      registeredStudents: 120,
      completedTrials: 640,
      completedTrials30d: 88,
      activeQuestions: 3200,
    });
    expect(redisMock.set).toHaveBeenCalledWith(
      'settings:landing-proof:v1',
      expect.any(String),
      'EX',
      300,
    );
  });

  it('returns lead CRM counts for every status, including empty columns', async () => {
    const prismaMock = {
      lead: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([
          { status: LeadStatus.new, _count: { _all: 3 } },
          { status: LeadStatus.converted, _count: { _all: 1 } },
        ]),
      },
    } as any;
    const service = new LeadsService(prismaMock, {} as any);

    const result = await service.getAdminList({ page: 1, limit: 25 });

    expect(result.counts).toEqual({
      new: 3,
      contacted: 0,
      qualified: 0,
      converted: 1,
      closed: 0,
    });
  });
});
