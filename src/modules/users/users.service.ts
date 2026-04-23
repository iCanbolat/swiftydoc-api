import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { AuthService } from '../auth/auth.service';
import {
  authIdentities,
  roles,
  users,
  workspaceMemberships,
  workspaces,
} from '../../infrastructure/database/schema';
import type {
  CreateManagedUserInput,
  ManagedMembershipStatus,
  ManagedUserStatus,
  ManagedUserView,
  UpdateManagedUserInput,
  UserWorkspaceAssignmentInput,
} from './users.types';

interface UserRow {
  createdAt: Date;
  email: string;
  emailVerifiedAt: Date | null;
  fullName: string;
  lastLoginAt: Date | null;
  locale: string;
  membershipCreatedAt: Date;
  membershipId: string;
  membershipStatus: string;
  phone: string | null;
  roleId: string;
  roleName: string;
  status: string;
  userId: string;
  workspaceCode: string;
  workspaceId: string;
  workspaceName: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
  ) {}

  async listUsers(organizationId: string): Promise<ManagedUserView[]> {
    const rows = await this.listUserRows(organizationId);
    return this.serializeUsers(rows);
  }

  async getUser(
    userId: string,
    organizationId: string,
  ): Promise<ManagedUserView> {
    const rows = await this.listUserRows(organizationId, userId);

    if (rows.length === 0) {
      throw new NotFoundException('User not found.');
    }

    return this.serializeUsers(rows)[0];
  }

  async createUser(input: CreateManagedUserInput): Promise<ManagedUserView> {
    this.assertOwnerRoleManagementAllowed(
      input.memberships.map((membership) => membership.roleName),
      input.actorRoleNames,
    );

    const assignments = await this.resolveAssignments(
      input.organizationId,
      input.memberships,
    );
    const db = this.getDatabase();
    const now = new Date();
    const normalizedEmail = this.normalizeEmail(input.email);
    const membershipStatus = this.mapUserStatusToMembershipStatus('invited');
    const userId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        const [existingUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (existingUser) {
          throw new ConflictException('User with this email already exists.');
        }

        await tx.insert(users).values({
          id: userId,
          email: normalizedEmail,
          fullName: input.fullName.trim(),
          locale: this.normalizeOptionalString(input.locale) ?? 'en',
          phone: this.normalizeOptionalString(input.phone) ?? null,
          status: 'invited',
          lastLoginAt: null,
          createdAt: now,
        });

        await tx.insert(workspaceMemberships).values(
          assignments.map((assignment) => ({
            id: randomUUID(),
            organizationId: input.organizationId,
            workspaceId: assignment.workspaceId,
            userId,
            roleId: assignment.roleId,
            status: membershipStatus,
            createdAt: now,
          })),
        );
      });

      const created = await this.getUser(userId, input.organizationId);

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.userCreated,
        organizationId: input.organizationId,
        actorId: input.actorUserId,
        actorType: input.actorUserId ? 'user' : undefined,
        resourceType: RESOURCE_TYPES.identity.user,
        resourceId: created.id,
        metadata: {
          email: created.email,
          membershipCount: created.memberships.length,
          roleNames: created.memberships.map(
            (membership) => membership.roleName,
          ),
          status: created.status,
        },
      });

      await this.authService.issueInternalUserInvite({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        userId: created.id,
      });

      return created;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (this.isUniqueViolation(error)) {
        throw new ConflictException('User with this email already exists.');
      }

      throw error;
    }
  }

  async updateUser(
    userId: string,
    input: UpdateManagedUserInput,
  ): Promise<ManagedUserView> {
    const current = await this.getUser(userId, input.organizationId);
    this.assertOwnerRoleManagementAllowed(
      current.memberships.map((membership) => membership.roleName),
      input.actorRoleNames,
    );

    if (input.memberships) {
      this.assertOwnerRoleManagementAllowed(
        input.memberships.map((membership) => membership.roleName),
        input.actorRoleNames,
      );
    }

    const nextStatus = input.status ?? current.status;
    const membershipStatus = this.mapUserStatusToMembershipStatus(nextStatus);
    const assignments = input.memberships
      ? await this.resolveAssignments(input.organizationId, input.memberships)
      : null;
    const db = this.getDatabase();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          fullName: input.fullName?.trim() ?? current.fullName,
          locale: this.normalizeOptionalString(input.locale) ?? current.locale,
          phone:
            input.phone !== undefined
              ? (this.normalizeOptionalString(input.phone) ?? null)
              : current.phone,
          status: nextStatus,
        })
        .where(eq(users.id, userId));

      if (assignments) {
        await tx
          .delete(workspaceMemberships)
          .where(
            and(
              eq(workspaceMemberships.organizationId, input.organizationId),
              eq(workspaceMemberships.userId, userId),
            ),
          );

        await tx.insert(workspaceMemberships).values(
          assignments.map((assignment) => ({
            id: randomUUID(),
            organizationId: input.organizationId,
            workspaceId: assignment.workspaceId,
            userId,
            roleId: assignment.roleId,
            status: membershipStatus,
            createdAt: now,
          })),
        );
      } else if (input.status) {
        await tx
          .update(workspaceMemberships)
          .set({ status: membershipStatus })
          .where(
            and(
              eq(workspaceMemberships.organizationId, input.organizationId),
              eq(workspaceMemberships.userId, userId),
            ),
          );
      }
    });

    const updated = await this.getUser(userId, input.organizationId);

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.userUpdated,
      organizationId: input.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.identity.user,
      resourceId: updated.id,
      metadata: {
        membershipCount: updated.memberships.length,
        roleNames: updated.memberships.map((membership) => membership.roleName),
        status: updated.status,
      },
    });

    return updated;
  }

  async resendInvite(
    userId: string,
    input: {
      actorUserId?: string;
      organizationId: string;
    },
  ): Promise<{ emailDispatched: boolean; expiresAt: string }> {
    const user = await this.getUser(userId, input.organizationId);

    if (user.status !== 'invited') {
      throw new ConflictException(
        'Only invited users can receive onboarding invite emails.',
      );
    }

    const result = await this.authService.issueInternalUserInvite({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      userId,
    });

    return {
      emailDispatched: true,
      expiresAt: result.expiresAt,
    };
  }

  async revokeInvite(
    userId: string,
    input: {
      actorUserId?: string;
      organizationId: string;
    },
  ): Promise<{ revoked: boolean; revokedTokenCount: number }> {
    const user = await this.getUser(userId, input.organizationId);

    if (user.status !== 'invited') {
      throw new ConflictException(
        'Only invited users can have onboarding invites revoked.',
      );
    }

    return this.authService.revokeInternalUserInvite({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      userId,
    });
  }

  private async listUserRows(
    organizationId: string,
    userId?: string,
  ): Promise<UserRow[]> {
    const db = this.getDatabase();
    const condition = userId
      ? and(
          eq(workspaceMemberships.organizationId, organizationId),
          eq(users.id, userId),
        )
      : eq(workspaceMemberships.organizationId, organizationId);

    return db
      .select({
        userId: users.id,
        email: users.email,
        emailVerifiedAt: authIdentities.emailVerifiedAt,
        fullName: users.fullName,
        locale: users.locale,
        phone: users.phone,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        membershipId: workspaceMemberships.id,
        membershipStatus: workspaceMemberships.status,
        membershipCreatedAt: workspaceMemberships.createdAt,
        roleId: roles.id,
        roleName: roles.name,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        workspaceCode: workspaces.code,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(users.id, workspaceMemberships.userId))
      .innerJoin(roles, eq(roles.id, workspaceMemberships.roleId))
      .innerJoin(
        workspaces,
        eq(workspaces.id, workspaceMemberships.workspaceId),
      )
      .leftJoin(
        authIdentities,
        and(
          eq(authIdentities.userId, users.id),
          eq(authIdentities.provider, 'password'),
        ),
      )
      .where(condition)
      .orderBy(asc(users.fullName), asc(workspaces.name));
  }

  private serializeUsers(rows: UserRow[]): ManagedUserView[] {
    const byUserId = new Map<string, ManagedUserView>();

    for (const row of rows) {
      const existing = byUserId.get(row.userId);

      if (!existing) {
        byUserId.set(row.userId, {
          id: row.userId,
          email: row.email,
          emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
          fullName: row.fullName,
          locale: row.locale,
          phone: row.phone,
          status: row.status as ManagedUserStatus,
          lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          memberships: [
            {
              membershipId: row.membershipId,
              workspaceId: row.workspaceId,
              workspaceName: row.workspaceName,
              workspaceCode: row.workspaceCode,
              roleId: row.roleId,
              roleName: row.roleName,
              status: row.membershipStatus as ManagedMembershipStatus,
              createdAt: row.membershipCreatedAt.toISOString(),
            },
          ],
        });
        continue;
      }

      existing.memberships.push({
        membershipId: row.membershipId,
        workspaceId: row.workspaceId,
        workspaceName: row.workspaceName,
        workspaceCode: row.workspaceCode,
        roleId: row.roleId,
        roleName: row.roleName,
        status: row.membershipStatus as ManagedMembershipStatus,
        createdAt: row.membershipCreatedAt.toISOString(),
      });
    }

    return [...byUserId.values()];
  }

  private async resolveAssignments(
    organizationId: string,
    assignments: UserWorkspaceAssignmentInput[],
  ): Promise<Array<{ roleId: string; workspaceId: string }>> {
    if (assignments.length === 0) {
      throw new BadRequestException(
        'At least one workspace membership is required.',
      );
    }

    const workspaceIds = assignments.map(
      (assignment) => assignment.workspaceId,
    );
    const duplicateWorkspaceIds = workspaceIds.filter(
      (workspaceId, index) => workspaceIds.indexOf(workspaceId) !== index,
    );

    if (duplicateWorkspaceIds.length > 0) {
      throw new BadRequestException(
        'Membership assignments must target unique workspace ids.',
      );
    }

    const roleNames = [
      ...new Set(assignments.map((assignment) => assignment.roleName)),
    ];
    const uniqueWorkspaceIds = [...new Set(workspaceIds)];
    const db = this.getDatabase();
    const [roleRows, workspaceRows] = await Promise.all([
      db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, organizationId),
            inArray(roles.name, roleNames),
          ),
        ),
      db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.organizationId, organizationId),
            inArray(workspaces.id, uniqueWorkspaceIds),
          ),
        ),
    ]);

    if (roleRows.length !== roleNames.length) {
      throw new BadRequestException(
        'One or more role assignments are invalid for this organization.',
      );
    }

    if (workspaceRows.length !== uniqueWorkspaceIds.length) {
      throw new BadRequestException(
        'One or more workspace assignments are invalid for this organization.',
      );
    }

    const roleIdByName = new Map(roleRows.map((role) => [role.name, role.id]));

    return assignments.map((assignment) => ({
      workspaceId: assignment.workspaceId,
      roleId: roleIdByName.get(assignment.roleName)!,
    }));
  }

  private assertOwnerRoleManagementAllowed(
    roleNames: string[],
    actorRoleNames: string[],
  ): void {
    if (
      roleNames.includes('organization_owner') &&
      !actorRoleNames.includes('organization_owner')
    ) {
      throw new ForbiddenException(
        'Only organization owners can assign or manage organization owner memberships.',
      );
    }
  }

  private mapUserStatusToMembershipStatus(
    status: ManagedUserStatus,
  ): ManagedMembershipStatus {
    if (status === 'active') {
      return 'active';
    }

    if (status === 'disabled') {
      return 'revoked';
    }

    return 'invited';
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeOptionalString(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for user management operations.',
      );
    }

    return this.databaseService.db;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23505'
    );
  }
}
