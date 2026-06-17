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
  StreamableFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Readable } from 'stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { isSupportedImageFile } from '../../common/files/image-signature';
import { QuestionsService } from './questions.service';
import { QUESTION_METADATA_LOCALE_KEY } from '../../common/question-locale';
import { csvCell, csvHeader, toCsvRow } from '@bilimland/shared';
import {
  CreateAdminQuestionDto,
  UpdateAdminQuestionDto,
} from './dto/admin-question.dto';

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
    const fullPath = join(process.cwd(), 'uploads', QUESTION_IMAGE_SUBDIR, file.filename);
    if (!isSupportedImageFile(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        // Best effort cleanup; the request must still fail closed.
      }
      throw new BadRequestException('Файл не похож на допустимое изображение');
    }
    const url = `/uploads/${QUESTION_IMAGE_SUBDIR}/${file.filename}`;
    return { url };
  }

  @Post()
  async create(@Body() data: CreateAdminQuestionDto) {
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
      limit: Math.min(100, Math.max(1, limit ? parseInt(limit, 10) : 20)),
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateAdminQuestionDto,
  ) {
    if (
      data &&
      (data.content !== undefined ||
        Array.isArray(data.answerOptions) ||
        data.imageUrls !== undefined ||
        data.explanation !== undefined)
    ) {
      return this.questionsService.updateFull(id, data);
    }
    return this.questionsService.update(
      id,
      data as Parameters<QuestionsService['update']>[1],
    );
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
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

    const questionsStream = this.questionsService.exportQuestions({
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

    const csvGenerator = async function* () {
      yield csvHeader(header);

      for await (const q of questionsStream) {
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
        // `localizedText` output is not a formula risk on its own, but the
        // option suffix ` ✓` produces a cell that starts with whitespace; the
        // shared csvCell helper handles the `=`/`+`/`-`/`@`/TAB/CR case
        // defensively. We feed the whole options blob through it.
        const options = q.answerOptions
          .map((o: any) => `${csvCell(localizedText(o.content))}${o.isCorrect ? ' ✓' : ''}`)
          .join(' | ');
        const subjectName = localizedText(q.subject?.name || '');
        const examTypeName = localizedText(q.examType?.name || '');

        const row = toCsvRow([
          q.id,
          subjectName,
          examTypeName,
          lang,
          stem,
          options,
          q.answerOptions.filter((o: any) => o.isCorrect).length > 0
            ? q.answerOptions.find((o: any) => o.isCorrect)?.sortOrder
            : '',
          passage,
          explanation,
          q.scoreWeight ?? '',
          q.type,
          q.difficulty,
        ]);

        yield row + '\n';
      }
    };

    return new StreamableFile(Readable.from(csvGenerator()));
  }
}
