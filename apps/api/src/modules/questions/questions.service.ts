import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    topicId: string;
    subjectId: string;
    examTypeId: string;
    difficulty: number;
    type: string;
    content: Prisma.InputJsonValue;
    explanation?: Prisma.InputJsonValue;
    imageUrls?: string[];
    answerOptions: { content: Prisma.InputJsonValue; isCorrect: boolean; sortOrder: number }[];
  }) {
    return this.prisma.question.create({
      data: {
        topicId: data.topicId,
        subjectId: data.subjectId,
        examTypeId: data.examTypeId,
        difficulty: data.difficulty,
        type: data.type,
        content: data.content,
        explanation: data.explanation ?? Prisma.DbNull,
        imageUrls: data.imageUrls ?? Prisma.DbNull,
        answerOptions: {
          create: data.answerOptions.map((opt) => ({
            content: opt.content,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder,
          })),
        },
      },
      include: { answerOptions: true },
    });
  }

  async findMany(filters: {
    examTypeId?: string;
    subjectId?: string;
    topicId?: string;
    difficulty?: number;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, ...where } = filters;
    const whereClause: Prisma.QuestionWhereInput = { isActive: true };

    if (where.examTypeId) whereClause.examTypeId = where.examTypeId;
    if (where.subjectId) whereClause.subjectId = where.subjectId;
    if (where.topicId) whereClause.topicId = where.topicId;
    if (where.difficulty) whereClause.difficulty = where.difficulty;

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where: whereClause,
        include: {
          answerOptions: { orderBy: { sortOrder: 'asc' } },
          subject: { select: { id: true, name: true, slug: true } },
          examType: { select: { id: true, name: true, slug: true } },
          topic: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.count({ where: whereClause }),
    ]);

    return { items, total, page, limit };
  }

  async update(id: string, data: Prisma.QuestionUpdateInput) {
    return this.prisma.question.update({
      where: { id },
      data,
      include: { answerOptions: true },
    });
  }

  async delete(id: string) {
    return this.prisma.question.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
