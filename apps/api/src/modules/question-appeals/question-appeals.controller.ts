import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChannelMemberGuard } from '../../common/guards/channel-member.guard';
import { CreateQuestionAppealDto } from './dto/create-question-appeal.dto';
import { QuestionAppealsService } from './question-appeals.service';

@Controller('tests/sessions')
@UseGuards(AuthGuard('jwt'), ChannelMemberGuard)
export class QuestionAppealsController {
  constructor(private readonly appeals: QuestionAppealsService) {}

  @Get(':sessionId/appeals')
  async listForActiveOrFinishedSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.appeals.listForSession(userId, sessionId);
  }

  @Get(':sessionId/review/appeals')
  async listForSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.appeals.listForSession(userId, sessionId);
  }

  @Post(':sessionId/questions/:questionId/appeal')
  async submitFromExam(
    @CurrentUser('id') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: CreateQuestionAppealDto,
  ) {
    return this.appeals.submit(userId, sessionId, questionId, dto);
  }

  @Post(':sessionId/review/:questionId/appeal')
  async submit(
    @CurrentUser('id') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: CreateQuestionAppealDto,
  ) {
    return this.appeals.submit(userId, sessionId, questionId, dto);
  }
}
