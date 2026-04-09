import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BulkImportGuard } from './guards/bulk-import.guard';
import { BulkImportService } from './bulk-import.service';
import {
  BatchQuestionsDto,
  CreateTestTemplateDto,
  CreateTopicDto,
  PatchBulkQuestionDto,
  UpsertExamTypeDto,
  UpsertSubjectDto,
} from './dto/bulk-import.dto';

/**
 * Временные открытые эндпоинты для массового наполнения контентом.
 * См. BULK_IMPORT_ENABLED и опционально BULK_IMPORT_SECRET.
 */
@Controller('bulk')
export class BulkImportController {
  constructor(private readonly bulk: BulkImportService) {}

  /** Публично: можно ли вызывать bulk (без раскрытия секрета) */
  @Get('status')
  status() {
    return this.bulk.status();
  }

  @Get('catalog')
  @UseGuards(BulkImportGuard)
  catalog() {
    return this.bulk.getCatalog();
  }

  @Post('exam-types')
  @UseGuards(BulkImportGuard)
  upsertExamType(@Body() body: UpsertExamTypeDto) {
    return this.bulk.upsertExamType(body);
  }

  @Post('subjects')
  @UseGuards(BulkImportGuard)
  upsertSubject(@Body() body: UpsertSubjectDto) {
    return this.bulk.upsertSubject(body);
  }

  @Post('topics')
  @UseGuards(BulkImportGuard)
  createTopic(@Body() body: CreateTopicDto) {
    return this.bulk.createTopic(body);
  }

  @Post('questions/batch')
  @UseGuards(BulkImportGuard)
  batchQuestions(@Body() body: BatchQuestionsDto) {
    return this.bulk.batchQuestions(body);
  }

  @Patch('questions/:id')
  @UseGuards(BulkImportGuard)
  patchQuestion(@Param('id') id: string, @Body() body: PatchBulkQuestionDto) {
    return this.bulk.patchQuestion(id, body);
  }

  @Get('questions')
  @UseGuards(BulkImportGuard)
  listQuestions(
    @Query('examTypeId') examTypeId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bulk.listQuestions({
      examTypeId,
      subjectId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 30,
    });
  }

  @Post('test-templates')
  @UseGuards(BulkImportGuard)
  createTemplate(@Body() body: CreateTestTemplateDto) {
    return this.bulk.createTestTemplate(body);
  }
}
