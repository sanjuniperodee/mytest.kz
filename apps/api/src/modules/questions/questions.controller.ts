import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { QuestionsService } from './questions.service';

@Controller('admin/questions')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

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
  ) {
    if (!examTypeId || !text?.trim()) {
      return { items: [] };
    }
    const loc = locale === 'kk' ? 'kk' : 'ru';
    return this.questionsService.findSimilar({
      examTypeId,
      subjectId: subjectId || undefined,
      locale: loc,
      text,
      excludeId: excludeId || undefined,
      threshold: threshold ? parseFloat(threshold) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
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
    if (data && (data.content !== undefined || Array.isArray(data.answerOptions))) {
      return this.questionsService.updateFull(id, data);
    }
    return this.questionsService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.questionsService.delete(id);
  }
}
