import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExamsService } from './exams.service';

@Controller('exams')
@UseGuards(AuthGuard('jwt'))
export class ExamsController {
  constructor(private examsService: ExamsService) {}

  @Get('types')
  async getExamTypes() {
    return this.examsService.getExamTypes();
  }

  @Get('types/:id/subjects')
  async getSubjects(@Param('id') id: string) {
    return this.examsService.getSubjects(id);
  }

  @Get('types/:id/templates')
  async getTemplates(@Param('id') id: string) {
    return this.examsService.getTemplates(id);
  }
}
