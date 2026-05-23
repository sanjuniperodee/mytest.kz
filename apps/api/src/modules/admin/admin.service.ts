import { Injectable } from '@nestjs/common';
import { AdminUserService } from './services/admin-user.service';
import { AdminSubscriptionService } from './services/admin-subscription.service';
import { AdminPlanTemplateService } from './services/admin-plan-template.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminFinanceService } from './services/admin-finance.service';

@Injectable()
export class AdminService {
  constructor(
    private userService: AdminUserService,
    private subscriptionService: AdminSubscriptionService,
    private planTemplateService: AdminPlanTemplateService,
    private analyticsService: AdminAnalyticsService,
    private financeService: AdminFinanceService,
  ) {}

  // User management
  async getUsers(
    search?: string,
    page = 1,
    limit = 20,
    options?: { compact?: boolean },
  ) {
    return this.userService.getUsers(search, page, limit, options);
  }

  async getUserDetail(id: string) {
    return this.userService.getUserDetail(id);
  }

  async updateUser(id: string, data: { isAdmin?: boolean }) {
    return this.userService.updateUser(id, data);
  }

  async deleteUser(adminId: string, id: string) {
    return this.userService.deleteUser(adminId, id);
  }

  // Subscription management
  async grantSubscription(adminId: string, data: Parameters<AdminSubscriptionService['grantSubscription']>[1]) {
    return this.subscriptionService.grantSubscription(adminId, data);
  }

  async revokeSubscription(subscriptionId: string) {
    return this.subscriptionService.revokeSubscription(subscriptionId);
  }

  async listUserEntitlements(userId: string) {
    return this.subscriptionService.listUserEntitlements(userId);
  }

  async grantEntitlement(adminId: string, data: Parameters<AdminSubscriptionService['grantEntitlement']>[1]) {
    return this.subscriptionService.grantEntitlement(adminId, data);
  }

  async updateEntitlement(entitlementId: string, data: Parameters<AdminSubscriptionService['updateEntitlement']>[1]) {
    return this.subscriptionService.updateEntitlement(entitlementId, data);
  }

  async adjustEntitlementAttempts(adminId: string, entitlementId: string, data: Parameters<AdminSubscriptionService['adjustEntitlementAttempts']>[2]) {
    return this.subscriptionService.adjustEntitlementAttempts(adminId, entitlementId, data);
  }

  // Plan template management
  async listPlanTemplates() {
    return this.planTemplateService.listPlanTemplates();
  }

  async createPlanTemplate(adminId: string, data: Parameters<AdminPlanTemplateService['createPlanTemplate']>[1]) {
    return this.planTemplateService.createPlanTemplate(adminId, data);
  }

  async updatePlanTemplate(id: string, data: Parameters<AdminPlanTemplateService['updatePlanTemplate']>[1]) {
    return this.planTemplateService.updatePlanTemplate(id, data);
  }

  async applyPlanTemplateToUser(adminId: string, data: Parameters<AdminPlanTemplateService['applyPlanTemplateToUser']>[1]) {
    return this.planTemplateService.applyPlanTemplateToUser(adminId, data);
  }

  // Analytics
  async getAnalyticsOverview() {
    return this.analyticsService.getAnalyticsOverview();
  }

  async getEntTrialAnalytics() {
    return this.analyticsService.getEntTrialAnalytics();
  }

  async exportEntTrialAnalytics() {
    return this.analyticsService.exportEntTrialAnalytics();
  }

  async getEntProfilePairsAnalytics() {
    return this.analyticsService.getEntProfilePairsAnalytics();
  }

  // Finance
  async getFinanceOrders(
    params: Parameters<AdminFinanceService['getFinanceOrders']>[0],
  ) {
    return this.financeService.getFinanceOrders(params);
  }

  async refundKaspiOrder(
    adminId: string,
    orderId: string,
  ) {
    return this.financeService.refundKaspiOrder(adminId, orderId);
  }
}
