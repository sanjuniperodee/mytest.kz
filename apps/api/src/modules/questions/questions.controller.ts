import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { QuestionsService } from './questions.service';
import { QUESTION_METADATA_LOCALE_KEY } from '../../common/question-locale';

const QUESTION_IMAGE_SUBDIR = 'question-images';
const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp)$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Controller('admin/questions')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  /** Загрузка одного файла; в БД сохраняется путь `/uploads/question-images/...` */
  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !IMAGE_MIME.test(file.mimetype)) {
          cb(new BadRequestException('Допустимы только изображения: jpeg, png, gif, webp'), false);
          return;
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', QUESTION_IMAGE_SUBDIR);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const safe = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.png';
          cb(null, `${randomUUID()}${safe}`);
        },
      }),
    }),
  )
  async uploadQuestionImage(@UploadedFile() file: Express.Multer.File) {
    if (!file?.filename) {
      throw new BadRequestException('Файл не получен');
    }
    const url = `/uploads/${QUESTION_IMAGE_SUBDIR}/${file.filename}`;
    return { url };
  }

  @Post()
  async create(@Body() data: any) {
    return this.questionsService.create(data);
  }

  /** Похожие вопросы для админки (дубликаты / кривые совпадения). */
  @Get('similar')
  async similar(
    @Query('examTypeId') examTypeId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('locale') locale?: string,
    @Query('text') text?: string,
    @Query('excludeId') excludeId?: string,
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
    @Query('searchIn') searchInRaw?: string,
  ) {
    if (!examTypeId || !text?.trim()) {
      return { items: [] };
    }
    const loc = locale === 'kk' ? 'kk' : 'ru';
    const searchIn =
      searchInRaw === 'topic' || searchInRaw === 'stem' || searchInRaw === 'all'
        ? searchInRaw
        : undefined;
    return this.questionsService.findSimilar({
      examTypeId,
      subjectId: subjectId || undefined,
      locale: loc,
      text,
      excludeId: excludeId || undefined,
      threshold: threshold ? parseFloat(threshold) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      searchIn,
    });
  }

  @Get()
  async findMany(
    @Query('id') id?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('difficulty') difficulty?: string,
    @Query('hasExplanation') hasExplanation?: string,
    @Query('contentLocale') contentLocale?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const loc =
      contentLocale === 'kk' || contentLocale === 'ru' || contentLocale === 'unset'
        ? contentLocale
        : undefined;
    return this.questionsService.findMany({
      id,
      examTypeId,
      subjectId,
      topicId,
      difficulty: difficulty ? parseInt(difficulty, 10) : undefined,
      hasExplanation:
        hasExplanation === 'true' ? true : hasExplanation === 'false' ? false : undefined,
      contentLocale: loc,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    if (
      data &&
      (data.content !== undefined ||
        Array.isArray(data.answerOptions) ||
        data.imageUrls !== undefined ||
        data.explanation !== undefined)
    ) {
      return this.questionsService.updateFull(id, data);
    }
    return this.questionsService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.questionsService.delete(id);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="questions-export.csv"')
  async exportQuestions(
    @Query('examTypeId') examTypeId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('contentLocale') contentLocale?: string,
  ) {
    const loc =
      contentLocale === 'kk' || contentLocale === 'ru' || contentLocale === 'unset'
        ? contentLocale
        : undefined;

    const questions = await this.questionsService.exportQuestions({
      examTypeId,
      subjectId,
      contentLocale: loc as 'kk' | 'ru' | 'unset' | undefined,
    });

    const header = [
      'ID',
      'Предмет',
      'Тип экзамена',
      'Язык',
      'Текст вопроса',
      'Варианты ответов',
      'Правильный ответ',
      'Passage',
      'Explanation',
      'Баллы',
      'Тип',
      'Сложность',
    ];

    const localizedText = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object') {
        const o = val as Record<string, unknown>;
        return (o.ru as string) || (o.kk as string) || (o.en as string) || '';
      }
      return '';
    };

    const csvCell = (v: unknown): string => {
      const raw = v == null ? '' : String(v);
      return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const lines: string[] = [
      header.join(','),
      ...questions.map((q) => {
        const lang =
          (q.metadata && typeof q.metadata === 'object'
            ? (q.metadata as Record<string, unknown>)[QUESTION_METADATA_LOCALE_KEY]
            : null) || '';
        const content = q.content as Record<string, unknown>;
        const passage = localizedText(content?.passage || '');
        const stem = localizedText(content?.text || '');
        const explanation = q.explanation
          ? localizedText((q.explanation as Record<string, unknown>)[lang as string] || (q.explanation as Record<string, unknown>)?.ru || '')
          : '';
        const options = q.answerOptions
          .map((o) => `${csvCell(localizedText(o.content))}${o.isCorrect ? ' ✓' : ''}`)
          .join(' | ');
        const subjectName = localizedText(q.subject?.name || '');
        const examTypeName = localizedText(q.examType?.name || '');

        return [
          csvCell(q.id),
          csvCell(subjectName),
          csvCell(examTypeName),
          csvCell(lang),
          csvCell(stem),
          csvCell(options),
          csvCell(q.answerOptions.filter((o) => o.isCorrect).length > 0 ? q.answerOptions.find((o) => o.isCorrect)?.sortOrder : ''),
          csvCell(passage),
          csvCell(explanation),
          csvCell(q.scoreWeight ?? ''),
          csvCell(q.type),
          csvCell(q.difficulty),
        ].join(',');
      }),
    ];

    const csv = '\ufeff' + lines.join('\n');

    return `\ufeff${csv}`;
  }
}
