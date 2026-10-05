import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { admissionChance } from '@bilimland/shared';
import { AdmissionController } from '../src/modules/admission/admission.controller';
import { AdmissionService } from '../src/modules/admission/admission.service';
import { AdmissionRepository } from '../src/modules/admission/infrastructure/admission.repository';
import { PrismaService } from '../src/database/prisma.service';
import { REDIS_CLIENT } from '../src/database/redis.module';

describe('Admission HTTP (mocked Prisma)', () => {
  let app: INestApplication;

  const makeCutoffRow = (input: {
    universityCode: number;
    programId: string;
    quotaType: 'GRANT' | 'RURAL';
    minScore: number | null;
    profileSubjects?: string;
    grantCount?: number | null;
  }) => ({
    universityCode: input.universityCode,
    programId: input.programId,
    quotaType: input.quotaType,
    minScore: input.minScore,
    maxScore: input.minScore == null ? null : input.minScore + 10,
    avgScore: input.minScore == null ? null : input.minScore + 5,
    grantCount: input.grantCount ?? null,
    university: { name: `University ${input.universityCode}`, shortName: `U${input.universityCode}` },
    program: {
      code: 'B009',
      name: 'Подготовка учителей математики',
      profileSubjects: input.profileSubjects ?? 'Физика-Математика',
      profileVariant: 0,
    },
  });

  const prismaMock = {
    grantAdmissionCycle: {
      findUnique: jest.fn().mockResolvedValue({ id: 'c1', slug: '2025-2026', sortOrder: 0 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'c1', slug: '2025-2026', sortOrder: 0 }]),
    },
    university: {
      findMany: jest.fn().mockResolvedValue([{ code: 7, name: 'Test University', shortName: 'TU' }]),
    },
    entEducationalProgram: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    grantCutoff: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const redisMock = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [AdmissionController],
      providers: [
        AdmissionService,
        AdmissionRepository,
        { provide: PrismaService, useValue: prismaMock },
        { provide: REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    prismaMock.grantAdmissionCycle.findUnique.mockResolvedValue({
      id: 'c1',
      slug: '2025-2026',
      sortOrder: 0,
    });
    prismaMock.grantAdmissionCycle.findMany.mockResolvedValue([
      { id: 'c1', slug: '2025-2026', sortOrder: 0 },
    ]);
    prismaMock.university.findMany.mockResolvedValue([
      { code: 7, name: 'Test University', shortName: 'TU' },
    ]);
    prismaMock.entEducationalProgram.findMany.mockResolvedValue([]);
    prismaMock.grantCutoff.findMany.mockResolvedValue([]);
  });

  it('GET /api/v1/admission/cycles', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admission/cycles').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/admission/universities', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admission/universities').expect(200);
    expect(res.body[0].code).toBe(7);
  });

  it('GET /api/v1/admission/cutoffs without university or program — 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admission/cutoffs')
      .query({ cycleSlug: '2025-2026' })
      .expect(400);
  });

  it('GET /api/v1/admission/compare — 200 with body', async () => {
    const programId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const res = await request(app.getHttpServer())
      .get('/api/v1/admission/compare')
      .query({
        cycleSlug: '2025-2026',
        universityCode: 7,
        programId,
        quotaType: 'GRANT',
        mathLit: 5,
        readingLit: 5,
        history: 10,
        profile1: 25,
        profile2: 25,
      })
      .expect(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body).toHaveProperty('passesEntThresholds');
    expect(res.body).toHaveProperty('hasCutoff');
  });

  it('GET /api/v1/admission/compare without query — 400', async () => {
    await request(app.getHttpServer()).get('/api/v1/admission/compare').expect(400);
  });

  it('GET /api/v1/admission/chance/profile-subjects — returns distinct values', async () => {
    prismaMock.grantCutoff.findMany.mockResolvedValue([
      makeCutoffRow({
        universityCode: 7,
        programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        quotaType: 'GRANT',
        minScore: 90,
      }),
      makeCutoffRow({
        universityCode: 8,
        programId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        quotaType: 'RURAL',
        minScore: 87,
        profileSubjects: 'Математика-География',
      }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admission/chance/profile-subjects')
      .query({ cycleSlug: '2025-2026', quotaType: 'RURAL' })
      .expect(200);

    expect(res.body).toEqual([
      { value: 'Математика-География', label: 'Математика-География' },
      { value: 'Физика-Математика', label: 'Физика-Математика' },
    ]);
  });

  it.each([
    {
      name: 'GRANT chosen, grant exists => show grant',
      quotaType: 'GRANT',
      rows: [makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'GRANT', minScore: 85 })],
      expectedCount: 1,
      expectedQuota: 'GRANT',
    },
    {
      name: 'GRANT chosen, only rural exists => hide',
      quotaType: 'GRANT',
      rows: [makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'RURAL', minScore: 70 })],
      expectedCount: 0,
    },
    {
      name: 'RURAL chosen, general competition lower than rural quota => show grant (rural applicants compete in both)',
      quotaType: 'RURAL',
      rows: [
        makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'RURAL', minScore: 95 }),
        makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'GRANT', minScore: 90 }),
      ],
      expectedCount: 1,
      expectedQuota: 'GRANT',
    },
    {
      name: 'RURAL chosen, both rural and grant exist => show rural',
      quotaType: 'RURAL',
      rows: [
        makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'RURAL', minScore: 72 }),
        makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'GRANT', minScore: 88 }),
      ],
      expectedCount: 1,
      expectedQuota: 'RURAL',
    },
    {
      name: 'RURAL chosen, rural missing, grant exists => fallback grant',
      quotaType: 'RURAL',
      rows: [makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'GRANT', minScore: 86 })],
      expectedCount: 1,
      expectedQuota: 'GRANT',
    },
    {
      name: 'RURAL chosen, only rural exists => show rural',
      quotaType: 'RURAL',
      rows: [makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'RURAL', minScore: 71 })],
      expectedCount: 1,
      expectedQuota: 'RURAL',
    },
    {
      name: 'RURAL chosen, no valid numeric cutoffs => hide',
      quotaType: 'RURAL',
      rows: [
        makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'RURAL', minScore: null }),
        makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'GRANT', minScore: null }),
      ],
      expectedCount: 0,
    },
  ])('GET /api/v1/admission/chance/programs quota resolver: $name', async ({ quotaType, rows, expectedCount, expectedQuota }) => {
    prismaMock.grantCutoff.findMany.mockResolvedValue(rows);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admission/chance/programs')
      .query({
        cycleSlug: '2025-2026',
        quotaType,
        profileSubjects: 'Физика-Математика',
        mathLit: 5,
        readingLit: 5,
        history: 10,
        profile1: 25,
        profile2: 25,
      })
      .expect(200);

    expect(res.body).toHaveLength(expectedCount);
    if (expectedCount > 0) {
      expect(res.body[0].displayedQuotaType).toBe(expectedQuota);
    }
  });

  it('GET /api/v1/admission/chance/programs with university filter -> only that university programs', async () => {
    prismaMock.grantCutoff.findMany.mockResolvedValue([
      makeCutoffRow({
        universityCode: 7,
        programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        quotaType: 'GRANT',
        minScore: 91,
      }),
    ]);

    await request(app.getHttpServer())
      .get('/api/v1/admission/chance/programs')
      .query({
        cycleSlug: '2025-2026',
        quotaType: 'GRANT',
        profileSubjects: 'Физика-Математика',
        universityCode: 7,
        mathLit: 5,
        readingLit: 5,
        history: 10,
        profile1: 25,
        profile2: 25,
      })
      .expect(200);

    expect(prismaMock.grantCutoff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          universityCode: 7,
        }),
      }),
    );
  });

  it('GET /api/v1/admission/universities?cycleSlug= filters by cycle cutoffs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admission/universities')
      .query({ cycleSlug: '2025-2026' })
      .expect(200);
    expect(prismaMock.university.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { cutoffs: { some: { minScore: { not: null }, cycleId: 'c1' } } },
      }),
    );
  });

  it('GET /api/v1/admission/compare RURAL uses the lower of rural / general cutoffs', async () => {
    const programId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    prismaMock.grantCutoff.findMany.mockResolvedValue([
      { quotaType: 'RURAL', minScore: 100, grantCount: 3 },
      { quotaType: 'GRANT', minScore: 92, grantCount: 40 },
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/v1/admission/compare')
      .query({
        cycleSlug: '2025-2026',
        universityCode: 7,
        programId,
        quotaType: 'RURAL',
        mathLit: 8,
        readingLit: 8,
        history: 16,
        profile1: 30,
        profile2: 30,
      })
      .expect(200);
    expect(res.body.cutoff).toBe(92);
    expect(res.body.displayedQuotaType).toBe('GRANT');
    expect(res.body.grantCount).toBe(40);
    expect(res.body.gapToCutoff).toBe(0);
  });

  it('GET /api/v1/admission/chance/universities exposes grant statistics', async () => {
    prismaMock.grantCutoff.findMany.mockResolvedValue([
      makeCutoffRow({
        universityCode: 7,
        programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        quotaType: 'GRANT',
        minScore: 91,
        grantCount: 25,
      }),
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/v1/admission/chance/universities')
      .query({
        cycleSlug: '2025-2026',
        quotaType: 'GRANT',
        programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        mathLit: 5,
        readingLit: 5,
        history: 10,
        profile1: 25,
        profile2: 25,
      })
      .expect(200);
    expect(res.body[0]).toMatchObject({ displayedMinScore: 91, maxScore: 101, avgScore: 96, grantCount: 25 });
  });

  it('admissionChance: HIGH at/above the average, MEDIUM between min and avg, LOW within 5 points', () => {
    expect(admissionChance(110, true, 100, 108)).toBe('HIGH');
    expect(admissionChance(104, true, 100, 108)).toBe('MEDIUM');
    expect(admissionChance(100, true, 100, 108)).toBe('MEDIUM');
    expect(admissionChance(96, true, 100, 108)).toBe('LOW');
    expect(admissionChance(94, true, 100, 108)).toBe('NONE');
    expect(admissionChance(130, false, 100, 108)).toBe('NONE');
    expect(admissionChance(105, true, 100, null)).toBe('HIGH');
  });

  it('GET /api/v1/admission/chance/programs reports passing universities and the best chance', async () => {
    prismaMock.grantCutoff.findMany.mockResolvedValue([
      makeCutoffRow({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'GRANT', minScore: 60 }),
      makeCutoffRow({ universityCode: 8, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'GRANT', minScore: 120 }),
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/v1/admission/chance/programs')
      .query({
        cycleSlug: '2025-2026',
        quotaType: 'GRANT',
        profileSubjects: 'Физика-Математика',
        mathLit: 5,
        readingLit: 5,
        history: 10,
        profile1: 25,
        profile2: 25,
      })
      .expect(200);
    // total 70: passes uni 7 (min 60, avg 65 -> HIGH), not uni 8 (min 120)
    expect(res.body[0]).toMatchObject({
      passingUniversityCount: 1,
      universityCount: 2,
      displayedMinScore: 60,
      maxDisplayedMinScore: 120,
      chance: 'HIGH',
    });
  });

  it('GET /api/v1/admission/history returns every year oldest first', async () => {
    prismaMock.grantAdmissionCycle.findMany.mockResolvedValue([
      { id: 'c2', slug: '2026-2027', sortOrder: 1, admissionYear: 2026 },
      { id: 'c1', slug: '2025-2026', sortOrder: 0, admissionYear: 2025 },
    ]);
    prismaMock.grantCutoff.findMany.mockResolvedValue([
      { cycleId: 'c1', quotaType: 'GRANT', minScore: 98, avgScore: 105, maxScore: 120, grantCount: 30 },
      { cycleId: 'c2', quotaType: 'GRANT', minScore: 101, avgScore: 107, maxScore: 125, grantCount: 28 },
      { cycleId: 'c2', quotaType: 'RURAL', minScore: 90, avgScore: 93, maxScore: 99, grantCount: 9 },
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/v1/admission/history')
      .query({ universityCode: 7, programId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quotaType: 'RURAL' })
      .expect(200);
    expect(res.body.map((p: { admissionYear: number; minScore: number; displayedQuotaType: string }) => [
      p.admissionYear,
      p.minScore,
      p.displayedQuotaType,
    ])).toEqual([
      [2025, 98, 'GRANT'],
      [2026, 90, 'RURAL'],
    ]);
  });
});
