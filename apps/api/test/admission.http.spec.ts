import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdmissionController } from '../src/modules/admission/admission.controller';
import { AdmissionService } from '../src/modules/admission/admission.service';
import { PrismaService } from '../src/database/prisma.service';

describe('Admission HTTP (mocked Prisma)', () => {
  let app: INestApplication;

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
});
