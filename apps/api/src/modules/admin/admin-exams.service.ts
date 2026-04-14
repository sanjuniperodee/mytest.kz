import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateExamTypeDto,
  CreateSubjectDto,
  CreateTestTemplateDto,
  CreateTopicDto,
  NameI18nDto,
  ReplaceTemplateSectionsDto,
  UpdateExamTypeDto,
  UpdateSubjectDto,
  UpdateTestTemplateDto,
  UpdateTopicDto,
} from './dto/admin-exams.dto';

function nameJson(dto: NameI18nDto): Prisma.InputJsonValue {
  return { kk: dto.kk ?? '', ru: dto.ru, en: dto.en ?? '' };
}

@Injectable()
export class AdminExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(includeInactive: boolean) {
    return this.prisma.examType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        subjects: {
          orderBy: { sortOrder: 'asc' },
          include: {
            topics: { orderBy: { sortOrder: 'asc' } },
          },
        },
        _count: { select: { questions: true, testTemplates: true } },
      },
    });
  }

  async createExamType(dto: CreateExamTypeDto) {
    const exists = await this.prisma.examType.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new BadRequestException(`Exam slug already exists: ${dto.slug}`);
    return this.prisma.examType.create({
      data: {
        slug: dto.slug,
        name: nameJson(dto.name),
        description: dto.description ? nameJson(dto.description) : Prisma.DbNull,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateExamType(id: string, dto: UpdateExamTypeDto) {
    await this.ensureExamType(id);
    return this.prisma.examType.update({
      where: { id },
      data: {
        name: nameJson(dto.name),
        description:
          dto.description !== undefined
            ? dto.description
              ? nameJson(dto.description)
              : Prisma.DbNull
            : undefined,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deactivateExamType(id: string) {
    await this.ensureExamType(id);
    return this.prisma.examType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createSubject(examTypeId: string, dto: CreateSubjectDto) {
    await this.ensureExamType(examTypeId);
    const conflict = await this.prisma.subject.findUnique({
      where: { examTypeId_slug: { examTypeId, slug: dto.slug } },
    });
    if (conflict) throw new BadRequestException(`Subject slug already exists: ${dto.slug}`);
    return this.prisma.subject.create({
      data: {
        examTypeId,
        slug: dto.slug,
        name: nameJson(dto.name),
        isMandatory: dto.isMandatory ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    const sub = await this.ensureSubject(id);
    if (dto.slug !== undefined && dto.slug !== sub.slug) {
      const conflict = await this.prisma.subject.findUnique({
        where: { examTypeId_slug: { examTypeId: sub.examTypeId, slug: dto.slug } },
      });
      if (conflict && conflict.id !== id) {
        throw new BadRequestException(`Subject slug already exists: ${dto.slug}`);
      }
    }
    return this.prisma.subject.update({
      where: { id },
      data: {
        name: nameJson(dto.name),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.isMandatory !== undefined ? { isMandatory: dto.isMandatory } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deleteSubject(id: string) {
    await this.ensureSubject(id);
    const q = await this.prisma.question.count({ where: { subjectId: id } });
    if (q > 0) {
      throw new BadRequestException(`Нельзя удалить предмет: есть ${q} вопросов`);
    }
    await this.prisma.topic.deleteMany({ where: { subjectId: id } });
    await this.prisma.testTemplateSection.deleteMany({ where: { subjectId: id } });
    await this.prisma.subject.delete({ where: { id } });
    return { ok: true };
  }

  async createTopic(subjectId: string, dto: CreateTopicDto) {
    await this.ensureSubject(subjectId);
    const maxSort = await this.prisma.topic.aggregate({
      where: { subjectId },
      _max: { sortOrder: true },
    });
    return this.prisma.topic.create({
      data: {
        subjectId,
        name: nameJson(dto.name),
        sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateTopic(id: string, dto: UpdateTopicDto) {
    await this.ensureTopic(id);
    return this.prisma.topic.update({
      where: { id },
      data: {
        name: nameJson(dto.name),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deleteTopic(id: string) {
    await this.ensureTopic(id);
    const q = await this.prisma.question.count({ where: { topicId: id } });
    if (q > 0) {
      throw new BadRequestException(`Нельзя удалить тему: привязано ${q} вопросов`);
    }
    await this.prisma.topic.delete({ where: { id } });
    return { ok: true };
  }

  async listTemplates(examTypeId: string, includeInactive: boolean) {
    await this.ensureExamType(examTypeId);
    return this.prisma.testTemplate.findMany({
      where: { examTypeId, ...(includeInactive ? {} : { isActive: true }) },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: { subject: { select: { id: true, slug: true, name: true } } },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async createTemplate(examTypeId: string, dto: CreateTestTemplateDto) {
    await this.ensureExamType(examTypeId);
    return this.prisma.$transaction(async (tx) => {
      const tpl = await tx.testTemplate.create({
        data: {
          examTypeId,
          name: nameJson(dto.name),
          durationMins: dto.durationMins,
          isActive: dto.isActive ?? true,
        },
      });
      for (let i = 0; i < dto.sections.length; i++) {
        const s = dto.sections[i];
        await tx.testTemplateSection.create({
          data: {
            templateId: tpl.id,
            subjectId: s.subjectId,
            questionCount: s.questionCount,
            selectionMode: s.selectionMode ?? 'random',
            sortOrder: s.sortOrder ?? i,
            profileHeavyFrom:
              s.profileHeavyFrom !== undefined && s.profileHeavyFrom !== null
                ? s.profileHeavyFrom
                : null,
          },
        });
      }
      return tx.testTemplate.findUnique({
        where: { id: tpl.id },
        include: {
          sections: { orderBy: { sortOrder: 'asc' }, include: { subject: true } },
        },
      });
    });
  }

  async updateTemplate(id: string, dto: UpdateTestTemplateDto) {
    await this.ensureTemplate(id);
    return this.prisma.testTemplate.update({
      where: { id },
      data: {
        name: nameJson(dto.name),
        durationMins: dto.durationMins,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        sections: { orderBy: { sortOrder: 'asc' }, include: { subject: true } },
      },
    });
  }

  async replaceTemplateSections(templateId: string, dto: ReplaceTemplateSectionsDto) {
    await this.ensureTemplate(templateId);
    await this.prisma.$transaction(async (tx) => {
      await tx.testTemplateSection.deleteMany({ where: { templateId } });
      for (let i = 0; i < dto.sections.length; i++) {
        const s = dto.sections[i];
        await tx.testTemplateSection.create({
          data: {
            templateId,
            subjectId: s.subjectId,
            questionCount: s.questionCount,
            selectionMode: s.selectionMode ?? 'random',
            sortOrder: s.sortOrder ?? i,
            profileHeavyFrom:
              s.profileHeavyFrom !== undefined && s.profileHeavyFrom !== null
                ? s.profileHeavyFrom
                : null,
          },
        });
      }
    });
    return this.prisma.testTemplate.findUnique({
      where: { id: templateId },
      include: {
        sections: { orderBy: { sortOrder: 'asc' }, include: { subject: true } },
      },
    });
  }

  async deleteTemplate(id: string) {
    await this.ensureTemplate(id);
    const sessions = await this.prisma.testSession.count({ where: { templateId: id } });
    if (sessions > 0) {
      throw new BadRequestException(`Нельзя удалить шаблон: есть ${sessions} сессий`);
    }
    await this.prisma.testTemplateSection.deleteMany({ where: { templateId: id } });
    await this.prisma.testTemplate.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureExamType(id: string) {
    const e = await this.prisma.examType.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Exam type not found');
    return e;
  }

  private async ensureSubject(id: string) {
    const s = await this.prisma.subject.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Subject not found');
    return s;
  }

  private async ensureTopic(id: string) {
    const t = await this.prisma.topic.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Topic not found');
    return t;
  }

  private async ensureTemplate(id: string) {
    const t = await this.prisma.testTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }
}
