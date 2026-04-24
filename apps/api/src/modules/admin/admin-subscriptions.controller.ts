import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Get,
  Patch,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import {
  EntitlementSourceType,
  EntitlementStatus,
  EntitlementTier,
} from '@prisma/client';

@Controller('admin/subscriptions')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminSubscriptionsController {
  constructor(private adminService: AdminService) {}

  @Post()
  async grantSubscription(
    @CurrentUser('id') adminId: string,
    @Body() data: {
      userId: string;
      planType: string;
      examTypeId?: string;
      startsAt: string;
      expiresAt: string;
      paymentNote?: string;
    },
  ) {
    return this.adminService.grantSubscription(adminId, data);
  }

  @Post('apply-plan-template')
  async applyPlanTemplateToUser(
    @CurrentUser('id') adminId: string,
    @Body()
    data: {
      userId: string;
      planTemplateId: string;
      windowStartsAt: string;
      windowEndsAt?: string | null;
      paymentNote?: string | null;
    },
  ) {
    return this.adminService.applyPlanTemplateToUser(adminId, data);
  }

  @Delete(':id')
  async revokeSubscription(@Param('id') id: string) {
    return this.adminService.revokeSubscription(id);
  }

  @Get('plan-templates')
  async listPlanTemplates() {
    return this.adminService.listPlanTemplates();
  }

  @Post('plan-templates')
  async createPlanTemplate(
    @CurrentUser('id') adminId: string,
    @Body()
    data: {
      code: string;
      name: string;
      description?: string | null;
      isPremium?: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezoneMode?: string;
      metadata?: unknown;
      rules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    },
  ) {
    return this.adminService.createPlanTemplate(adminId, data);
  }

  @Patch('plan-templates/:id')
  async updatePlanTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      isPremium?: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezoneMode?: string;
      metadata?: unknown;
      replaceRules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    },
  ) {
    return this.adminService.updatePlanTemplate(id, data);
  }

  @Get('users/:userId/entitlements')
  async listUserEntitlements(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.listUserEntitlements(userId);
  }

  @Post('entitlements')
  async grantEntitlement(
    @CurrentUser('id') adminId: string,
    @Body()
    data: {
      userId: string;
      examTypeId: string;
      tier: EntitlementTier;
      status?: EntitlementStatus;
      sourceType?: EntitlementSourceType;
      sourceRef?: string;
      planTemplateId?: string | null;
      subscriptionId?: string | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      usedAttemptsTotal?: number;
      timezone?: string;
      windowStartsAt: string;
      windowEndsAt?: string | null;
      metadata?: unknown;
    },
  ) {
    return this.adminService.grantEntitlement(adminId, data);
  }

  @Patch('entitlements/:id')
  async updateEntitlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      status?: EntitlementStatus;
      tier?: EntitlementTier;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezone?: string;
      windowStartsAt?: string;
      windowEndsAt?: string | null;
      nextAllowedAt?: string | null;
      metadata?: unknown;
    },
  ) {
    return this.adminService.updateEntitlement(id, data);
  }

  @Post('entitlements/:id/adjust-attempts')
  async adjustEntitlementAttempts(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { delta: number; reasonCode?: string },
  ) {
    return this.adminService.adjustEntitlementAttempts(adminId, id, data);
  }
}
