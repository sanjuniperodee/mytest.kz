import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminExamsService } from './admin-exams.service';
import {
  CreateExamTypeDto,
  CreateSubjectDto,
  CreateTestTemplateDto,
  CreateTopicDto,
  ReplaceTemplateSectionsDto,
  UpdateExamTypeDto,
  UpdateSubjectDto,
  UpdateTestTemplateDto,
  UpdateTopicDto,
} from './dto/admin-exams.dto';

@Controller('admin/exams')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminExamsController {
  constructor(private readonly adminExams: AdminExamsService) {}

  @Get('catalog')
  getCatalog(@Query('includeInactive') includeInactive?: string) {
    return this.adminExams.getCatalog(includeInactive === 'true' || includeInactive === '1');
  }

  @Post('types')
  createExamType(@Body() dto: CreateExamTypeDto) {
    return this.adminExams.createExamType(dto);
  }

  @Patch('types/:id')
  updateExamType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExamTypeDto) {
    return this.adminExams.updateExamType(id, dto);
  }

  @Delete('types/:id')
  deactivateExamType(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminExams.deactivateExamType(id);
  }

  @Post('types/:examTypeId/subjects')
  createSubject(
    @Param('examTypeId', ParseUUIDPipe) examTypeId: string,
    @Body() dto: CreateSubjectDto,
  ) {
    return this.adminExams.createSubject(examTypeId, dto);
  }

  @Patch('subjects/:id')
  updateSubject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubjectDto) {
    return this.adminExams.updateSubject(id, dto);
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminExams.deleteSubject(id);
  }

  @Post('subjects/:subjectId/topics')
  createTopic(@Param('subjectId', ParseUUIDPipe) subjectId: string, @Body() dto: CreateTopicDto) {
    return this.adminExams.createTopic(subjectId, dto);
  }

  @Patch('topics/:id')
  updateTopic(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTopicDto) {
    return this.adminExams.updateTopic(id, dto);
  }

  @Delete('topics/:id')
  deleteTopic(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminExams.deleteTopic(id);
  }

  @Get('types/:examTypeId/templates')
  listTemplates(
    @Param('examTypeId', ParseUUIDPipe) examTypeId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.adminExams.listTemplates(
      examTypeId,
      includeInactive === 'true' || includeInactive === '1',
    );
  }

  @Post('types/:examTypeId/templates')
  createTemplate(
    @Param('examTypeId', ParseUUIDPipe) examTypeId: string,
    @Body() dto: CreateTestTemplateDto,
  ) {
    return this.adminExams.createTemplate(examTypeId, dto);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTestTemplateDto) {
    return this.adminExams.updateTemplate(id, dto);
  }

  @Put('templates/:id/sections')
  replaceSections(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceTemplateSectionsDto,
  ) {
    return this.adminExams.replaceTemplateSections(id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminExams.deleteTemplate(id);
  }
}
