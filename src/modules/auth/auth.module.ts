import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { OrganizationEntitlementsService } from './organization-entitlements.service';
import { AuthService } from './auth.service';
import { InternalAuthGuard } from './internal-auth.guard';
import { OrganizationOwnerGuard } from './organization-owner.guard';
import { OrganizationPolicyGuard } from './organization-policy.guard';
import { PortalAuthGuard } from './portal-auth.guard';
import { WorkspaceMembershipGuard } from './workspace-membership.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OrganizationEntitlementsService,
    InternalAuthGuard,
    OrganizationOwnerGuard,
    OrganizationPolicyGuard,
    PortalAuthGuard,
    WorkspaceMembershipGuard,
  ],
  exports: [
    AuthService,
    OrganizationEntitlementsService,
    InternalAuthGuard,
    OrganizationOwnerGuard,
    OrganizationPolicyGuard,
    PortalAuthGuard,
    WorkspaceMembershipGuard,
  ],
})
export class AuthModule {}
