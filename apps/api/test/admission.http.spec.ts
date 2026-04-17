import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdmissionController } from '../src/modules/admission/admission.controller';
import { AdmissionService } from '../src/modules/admission/admission.service';
import { PrismaService } from '../src/database/prisma.service';

describe('Admission HTTP (mocked Prisma)', () => {
  let app: INestApplication;

  const makeCutoffRow = (input: {
    universityCode: number;
    programId: string;
    quotaType: 'GRANT' | 'RURAL';
    minScore: number | null;
    profileSubjects?: string;
  }) => ({
    universityCode: input.universityCode,
    programId: input.programId,
    quotaType: input.quotaType,
    minScore: input.minScore,
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
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdmissionController],
      providers: [AdmissionService, { provide: PrismaService, useValue: prismaMock }],
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
    prismaMock.grantCutoff.findFirst.mockResolvedValue(null);
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
});
