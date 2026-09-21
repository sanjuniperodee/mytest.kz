import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StatisticsService } from './statistics.service';

export class StatisticsQuery {
  @IsIn(['30', '90', 'all']) period: '30' | '90' | 'all' = '90';
  @IsIn(['exam', 'practice']) format: 'exam' | 'practice' = 'exam';
  @IsOptional() @IsUUID() examTypeId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
}

@Controller('users/me/statistics')
@UseGuards(AuthGuard('jwt'))
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}
  @Get()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  get(@CurrentUser('id') userId: string, @Query() query: StatisticsQuery) {
    return this.statistics.get(userId, query);
  }
}
