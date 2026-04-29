import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  PaginatedResult,
  paginateResult,
} from '../../common/http/pagination.dto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  clientContacts,
  clients,
  recipients,
  requests,
} from '../../infrastructure/database/schema';
import { RequestWorkflowService } from '../requests/request-workflow.service';
import type {
  ClientDetailInclude,
  ClientRecord,
  CreateClientInput,
  ListClientsInput,
  UpdateClientInput,
} from './clients.types';
import { CLIENT_DETAIL_INCLUDE_VALUES } from './clients.types';

@Injectable()
export class ClientsService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly databaseService: DatabaseService,
    private readonly requestWorkflowService: RequestWorkflowService,
  ) {}

  async listClients(
    input: ListClientsInput,
  ): Promise<PaginatedResult<ClientRecord>> {
    const db = this.getDatabase();
    const conditions = [
      eq(clients.organizationId, input.organizationId),
      eq(clients.workspaceId, input.workspaceId),
    ];

    if (input.status) {
      conditions.push(eq(clients.status, input.status));
    }

    const province = this.normalizeOptionalString(input.province);

    if (province) {
      conditions.push(eq(clients.province, province));
    }

    const search = this.normalizeOptionalString(input.search);

    if (search) {
      const pattern = `%${search}%`;
      const searchCondition = or(
        ilike(clients.displayName, pattern),
        ilike(clients.legalName, pattern),
        ilike(clients.externalRef, pattern),
        ilike(clients.province, pattern),
        ilike(clients.district, pattern),
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const [countRows, items] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(clients)
        .where(and(...conditions)),
      db
        .select()
        .from(clients)
        .where(and(...conditions))
        .orderBy(desc(clients.createdAt), desc(clients.id))
        .limit(input.pagination.pageSize)
        .offset(input.pagination.offset),
    ]);

    return paginateResult(items, countRows[0]?.count ?? 0, input.pagination);
  }

  async getClient(
    clientId: string,
    organizationId: string,
  ): Promise<ClientRecord> {
    const db = this.getDatabase();
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    return client;
  }

  async getClientResponse(
    clientId: string,
    organizationId: string,
    includeQuery?: string,
  ) {
    const client = await this.getClient(clientId, organizationId);
    const includes = this.parseClientDetailIncludes(includeQuery);
    const response: Record<string, unknown> = this.serializeClient(client);

    if (includes.size === 0) {
      return response;
    }

    const [summary, contactsPreview, requestHistoryResult] = await Promise.all([
      includes.has('summary')
        ? this.buildClientSummary(client.id, organizationId)
        : Promise.resolve(undefined),
      includes.has('contactsPreview')
        ? this.buildContactsPreview(client.id, organizationId)
        : Promise.resolve(undefined),
      includes.has('requestHistory')
        ? this.requestWorkflowService.listRequests({
            organizationId,
            workspaceId: client.workspaceId,
            clientId: client.id,
            pagination: {
              page: 1,
              pageSize: 5,
              offset: 0,
            },
          })
        : Promise.resolve(undefined),
    ]);

    if (summary) {
      response.summary = summary;
    }

    if (contactsPreview) {
      response.contactsPreview = contactsPreview;
    }

    if (requestHistoryResult) {
      response.requestHistory = requestHistoryResult.data;
    }

    return response;
  }

  async createClient(input: CreateClientInput): Promise<ClientRecord> {
    const db = this.getDatabase();
    const now = new Date();

    try {
      const [client] = await db
        .insert(clients)
        .values({
          id: randomUUID(),
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          displayName: input.displayName.trim(),
          legalName: this.normalizeOptionalString(input.legalName) ?? null,
          externalRef: this.normalizeOptionalString(input.externalRef) ?? null,
          province: this.normalizeOptionalString(input.province) ?? null,
          district: this.normalizeOptionalString(input.district) ?? null,
          status: 'active',
          metadata: input.metadata ?? {},
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        })
        .returning();

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.clientCreated,
        organizationId: client.organizationId,
        actorId: input.actorUserId,
        actorType: 'user',
        resourceType: RESOURCE_TYPES.documents.client,
        resourceId: client.id,
        metadata: {
          district: client.district,
          workspaceId: client.workspaceId,
          externalRef: client.externalRef,
          province: client.province,
        },
      });

      return client;
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'Invalid workspace reference for client creation.',
        );
      }

      if (this.isUniqueViolation(error, 'clients_workspace_external_ref_key')) {
        throw new BadRequestException(
          'Client externalRef must be unique within a workspace.',
        );
      }

      throw error;
    }
  }

  async updateClient(
    clientId: string,
    input: UpdateClientInput,
  ): Promise<ClientRecord> {
    const currentClient = await this.getClient(clientId, input.organizationId);
    const db = this.getDatabase();
    const now = new Date();

    try {
      const [client] = await db
        .update(clients)
        .set({
          displayName: input.displayName?.trim() ?? currentClient.displayName,
          legalName:
            input.legalName !== undefined
              ? (this.normalizeOptionalString(input.legalName) ?? null)
              : currentClient.legalName,
          externalRef:
            input.externalRef !== undefined
              ? (this.normalizeOptionalString(input.externalRef) ?? null)
              : currentClient.externalRef,
          province:
            input.province !== undefined
              ? (this.normalizeOptionalString(input.province) ?? null)
              : currentClient.province,
          district:
            input.district !== undefined
              ? (this.normalizeOptionalString(input.district) ?? null)
              : currentClient.district,
          status: input.status ?? currentClient.status,
          metadata: input.metadata ?? currentClient.metadata,
          updatedAt: now,
          archivedAt:
            input.status === 'archived'
              ? (currentClient.archivedAt ?? now)
              : input.status === 'active'
                ? null
                : currentClient.archivedAt,
        })
        .where(eq(clients.id, currentClient.id))
        .returning();

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.clientUpdated,
        organizationId: client.organizationId,
        actorId: input.actorUserId,
        actorType: 'user',
        resourceType: RESOURCE_TYPES.documents.client,
        resourceId: client.id,
        metadata: {
          district: client.district,
          status: client.status,
          workspaceId: client.workspaceId,
          province: client.province,
        },
      });

      return client;
    } catch (error) {
      if (this.isUniqueViolation(error, 'clients_workspace_external_ref_key')) {
        throw new BadRequestException(
          'Client externalRef must be unique within a workspace.',
        );
      }

      throw error;
    }
  }

  serializeClient(client: ClientRecord) {
    return {
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      archivedAt: client.archivedAt?.toISOString() ?? null,
    };
  }

  private normalizeOptionalString(
    value: string | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private async buildClientSummary(clientId: string, organizationId: string) {
    const db = this.getDatabase();
    const now = new Date();

    const [statusRows, overdueRow, signalsRow] = await Promise.all([
      db
        .select({
          status: requests.status,
          count: sql<number>`count(*)`,
        })
        .from(requests)
        .where(
          and(
            eq(requests.organizationId, organizationId),
            eq(requests.clientId, clientId),
          ),
        )
        .groupBy(requests.status),
      db
        .select({ count: sql<number>`count(*)` })
        .from(requests)
        .where(
          and(
            eq(requests.organizationId, organizationId),
            eq(requests.clientId, clientId),
            sql`${requests.status} in ('draft', 'sent', 'in_progress')`,
            sql`${requests.dueAt} < ${now}`,
          ),
        ),
      db
        .select({
          lastRequestActivityAt: sql<
            Date | string | null
          >`max(${requests.updatedAt})`,
          nextDueAt: sql<
            Date | string | null
          >`min(case when ${requests.status} in ('draft', 'sent', 'in_progress') then ${requests.dueAt} end)`,
        })
        .from(requests)
        .where(
          and(
            eq(requests.organizationId, organizationId),
            eq(requests.clientId, clientId),
          ),
        ),
    ]);

    const requestCounts = {
      draft: 0,
      sent: 0,
      inProgress: 0,
      completed: 0,
      closed: 0,
      cancelled: 0,
      total: 0,
    };

    for (const row of statusRows) {
      const count = Number(row.count ?? 0);

      switch (row.status) {
        case 'draft':
          requestCounts.draft = count;
          break;
        case 'sent':
          requestCounts.sent = count;
          break;
        case 'in_progress':
          requestCounts.inProgress = count;
          break;
        case 'completed':
          requestCounts.completed = count;
          break;
        case 'closed':
          requestCounts.closed = count;
          break;
        case 'cancelled':
          requestCounts.cancelled = count;
          break;
        default:
          break;
      }
    }

    requestCounts.total =
      requestCounts.draft +
      requestCounts.sent +
      requestCounts.inProgress +
      requestCounts.completed +
      requestCounts.closed +
      requestCounts.cancelled;

    return {
      requestCounts,
      openRequestCount:
        requestCounts.draft + requestCounts.sent + requestCounts.inProgress,
      overdueRequestCount: Number(overdueRow[0]?.count ?? 0),
      lastRequestActivityAt: this.toIsoString(
        signalsRow[0]?.lastRequestActivityAt ?? null,
      ),
      nextDueAt: this.toIsoString(signalsRow[0]?.nextDueAt ?? null),
    };
  }

  private async buildContactsPreview(clientId: string, organizationId: string) {
    const db = this.getDatabase();

    const [totalContactsRows, primaryContacts, recentRecipients] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(clientContacts)
          .where(
            and(
              eq(clientContacts.organizationId, organizationId),
              eq(clientContacts.clientId, clientId),
            ),
          ),
        db
          .select({
            id: clientContacts.id,
            fullName: clientContacts.fullName,
            email: clientContacts.email,
            phone: clientContacts.phone,
            status: clientContacts.status,
            createdAt: clientContacts.createdAt,
          })
          .from(clientContacts)
          .where(
            and(
              eq(clientContacts.organizationId, organizationId),
              eq(clientContacts.clientId, clientId),
            ),
          )
          .orderBy(asc(clientContacts.createdAt), asc(clientContacts.id))
          .limit(1),
        db
          .select({
            id: recipients.id,
            label: recipients.label,
            email: recipients.email,
            deliveryChannel: recipients.deliveryChannel,
            status: recipients.status,
            createdAt: recipients.createdAt,
          })
          .from(recipients)
          .where(
            and(
              eq(recipients.organizationId, organizationId),
              eq(recipients.clientId, clientId),
            ),
          )
          .orderBy(desc(recipients.createdAt), desc(recipients.id))
          .limit(3),
      ]);

    const primaryContact = primaryContacts[0];

    return {
      primaryContact: primaryContact
        ? {
            ...primaryContact,
            createdAt: primaryContact.createdAt.toISOString(),
          }
        : null,
      recentRecipients: recentRecipients.map((recipient) => ({
        ...recipient,
        createdAt: recipient.createdAt.toISOString(),
      })),
      totalContacts: Number(totalContactsRows[0]?.count ?? 0),
    };
  }

  private parseClientDetailIncludes(
    includeQuery?: string,
  ): Set<ClientDetailInclude> {
    if (!includeQuery) {
      return new Set();
    }

    const includes = includeQuery
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const invalidIncludes = includes.filter(
      (value) =>
        !CLIENT_DETAIL_INCLUDE_VALUES.includes(value as ClientDetailInclude),
    );

    if (invalidIncludes.length > 0) {
      throw new BadRequestException(
        `Unsupported include value(s): ${invalidIncludes.join(', ')}.`,
      );
    }

    return new Set(includes as ClientDetailInclude[]);
  }

  private toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for client operations.',
      );
    }

    return this.databaseService.db;
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23503'
    );
  }

  private isUniqueViolation(error: unknown, constraint: string): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === constraint
    );
  }
}
