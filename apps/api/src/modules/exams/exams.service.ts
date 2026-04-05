import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  async getExamTypes() {
    return this.prisma.examType.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getSubjects(examTypeId: string) {
    return this.prisma.subject.findMany({
      where: { examTypeId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getTemplates(examTypeId: string) {
    return this.prisma.testTemplate.findMany({
      where: { examTypeId, isActive: true },
      include: {
        sections: {
          include: { subject: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }
}
