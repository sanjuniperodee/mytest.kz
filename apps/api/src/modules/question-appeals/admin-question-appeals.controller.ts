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
import { QuestionAppealReason, QuestionAppealStatus } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UpdateQuestionAppealDto } from './dto/update-question-appeal.dto';
import { QuestionAppealsService } from './question-appeals.service';

@Controller('admin/question-appeals')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminQuestionAppealsController {
  constructor(private readonly appeals: QuestionAppealsService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('reason') reason?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('search') search?: string,
  ) {
    return this.appeals.listAdmin({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status: this.parseStatus(status),
      reason: this.parseReason(reason),
      examTypeId,
      subjectId,
      search,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionAppealDto,
  ) {
    return this.appeals.updateAdmin(id, adminId, dto);
  }

  private parseStatus(value?: string): QuestionAppealStatus | undefined {
    return Object.values(QuestionAppealStatus).includes(value as QuestionAppealStatus)
      ? (value as QuestionAppealStatus)
      : undefined;
  }

  private parseReason(value?: string): QuestionAppealReason | undefined {
    return Object.values(QuestionAppealReason).includes(value as QuestionAppealReason)
      ? (value as QuestionAppealReason)
      : undefined;
  }
}
