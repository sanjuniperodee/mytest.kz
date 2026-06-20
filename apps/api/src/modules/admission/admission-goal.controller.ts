import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GrantQuotaType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdmissionGoalService } from './admission-goal.service';

class SetGoalDto {
  @IsInt()
  universityCode!: number;

  @IsUUID()
  programId!: string;

  @IsOptional()
  @IsString()
  cycleSlug?: string;

  @IsOptional()
  @IsEnum(GrantQuotaType)
  quotaType?: GrantQuotaType;
}

@Controller('admission/goal')
@UseGuards(AuthGuard('jwt'))
export class AdmissionGoalController {
  constructor(private readonly goalService: AdmissionGoalService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.goalService.getGoal(userId);
  }

  @Put()
  set(@CurrentUser('id') userId: string, @Body() dto: SetGoalDto) {
    return this.goalService.setGoal(userId, {
      universityCode: dto.universityCode,
      programId: dto.programId,
      cycleSlug: dto.cycleSlug,
      quotaType: dto.quotaType,
    });
  }

  @Delete()
  clear(@CurrentUser('id') userId: string) {
    return this.goalService.clearGoal(userId);
  }
}
