import { Controller, Get, Put, Post, Body, Param, ParseUUIDPipe, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TestFeedbackDto } from './test-feedback.dto';
import { TestFeedbackService } from './test-feedback.service';

@Controller('tests/sessions/:sessionId/feedback')
@UseGuards(AuthGuard('jwt'))
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
export class TestFeedbackController {
  constructor(private readonly service: TestFeedbackService) {}
  @Get() get(@CurrentUser('id') user: string, @Param('sessionId', ParseUUIDPipe) id: string) {
    return this.service.get(user, id);
  }
  @Post('shown') shown(@CurrentUser('id') user: string, @Param('sessionId', ParseUUIDPipe) id: string) {
    return this.service.mark(user, id, 'shown');
  }
  @Post('skip') skip(@CurrentUser('id') user: string, @Param('sessionId', ParseUUIDPipe) id: string) {
    return this.service.mark(user, id, 'skipped');
  }
  @Put() submit(@CurrentUser('id') user: string, @Param('sessionId', ParseUUIDPipe) id: string, @Body() dto: TestFeedbackDto) {
    return this.service.submit(user, id, dto);
  }
}
