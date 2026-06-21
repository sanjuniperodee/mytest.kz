import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiLessonNoteReason, AiLessonNoteStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UpdateLessonNoteDto } from './dto/lesson-note.dto';
import { StudyThemeService } from './study-theme.service';

@Controller('admin/ai/lesson-notes')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminAiController {
  constructor(private readonly studyTheme: StudyThemeService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('reason') reason?: string,
    @Query('subjectId') subjectId?: string,
    @Query('search') search?: string,
  ) {
    return this.studyTheme.listAdminLessonNotes({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status: this.parseStatus(status),
      reason: this.parseReason(reason),
      subjectId,
      search,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonNoteDto,
  ) {
    return this.studyTheme.updateAdminLessonNote(id, adminId, dto);
  }

  private parseStatus(value?: string): AiLessonNoteStatus | undefined {
    return Object.values(AiLessonNoteStatus).includes(value as AiLessonNoteStatus)
      ? (value as AiLessonNoteStatus)
      : undefined;
  }

  private parseReason(value?: string): AiLessonNoteReason | undefined {
    return Object.values(AiLessonNoteReason).includes(value as AiLessonNoteReason)
      ? (value as AiLessonNoteReason)
      : undefined;
  }
}
