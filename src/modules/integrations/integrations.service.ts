import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { AUDIT_ACTIONS } from '../../common/audit/audit-actions';
import {
  INTEGRATION_AUTH_TYPE_VALUES,
  INTEGRATION_CONNECTION_STATUS_VALUES,
  SYNC_JOB_STATUS_VALUES,
  type IntegrationAuthType,
  type IntegrationConnectionStatus,
  type IntegrationProviderKey,
  type SyncJobStatus,
} from '../../common/integrations/integration-types';
import { RESOURCE_TYPES } from '../../common/audit/resource-types';
import { WEBHOOK_EVENTS } from '../../common/webhooks/webhook-events';
import { AuditLogService } from '../../infrastructure/audit/audit-log.service';
import { DatabaseService } from '../../infrastructure/database/database.service';
import {
  integrationConnections,
  integrationExternalReferences,
  syncJobs,
} from '../../infrastructure/database/schema';
import type {
  IntegrationConnectionTestResult,
  IntegrationConnector,
  IntegrationSyncResult,
} from '../../infrastructure/integrations/integration-connector.types';
import { PlivoIntegrationConnector } from '../../infrastructure/integrations/plivo-integration.connector';
import { ResendIntegrationConnector } from '../../infrastructure/integrations/resend-integration.connector';
import { WhatsAppCloudIntegrationConnector } from '../../infrastructure/integrations/whatsapp-cloud-integration.connector';
import { ZohoBooksIntegrationConnector } from '../../infrastructure/integrations/zoho-books-integration.connector';
import type {
  IntegrationExternalReferenceLookup,
  IntegrationExternalReferenceRecord,
  IntegrationExternalReferenceSnapshot,
} from '../../common/integrations/integration-external-reference';
import { isAccountingErpSyncPayload } from '../../common/integrations/integration-sync-payload';
import { JobQueueService } from '../../infrastructure/queue/job-queue.service';
import { WebhookService } from '../../infrastructure/webhooks/webhook.service';
import {
  INTEGRATION_AUTH_TYPE_SET,
  INTEGRATION_PROVIDER_CATALOG,
  INTEGRATION_PROVIDER_KEY_SET,
} from './integrations.constants';
import type {
  CreateIntegrationConnectionInput,
  IntegrationConnectionRecord,
  IntegrationProviderListItem,
  IntegrationSyncQueuePayload,
  ListSyncJobsInput,
  ProcessedSyncJobResult,
  QueueIntegrationSyncInput,
  SyncJobRecord,
  TestedIntegrationConnectionResult,
  TestIntegrationConnectionInput,
  TriggeredSyncJobResult,
} from './integrations.types';

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly connectors = new Map<IntegrationProviderKey, IntegrationConnector>();

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly databaseService: DatabaseService,
    private readonly jobQueueService: JobQueueService,
    private readonly webhookService: WebhookService,
    private readonly whatsappCloudConnector: WhatsAppCloudIntegrationConnector,
    private readonly plivoConnector: PlivoIntegrationConnector,
    private readonly resendConnector: ResendIntegrationConnector,
    private readonly zohoBooksConnector: ZohoBooksIntegrationConnector,
  ) {
    for (const connector of [
      this.whatsappCloudConnector,
      this.plivoConnector,
      this.resendConnector,
      this.zohoBooksConnector,
    ]) {
      this.connectors.set(connector.providerKey, connector);
    }
  }

  onModuleInit(): void {
    this.jobQueueService.registerHandler<IntegrationSyncQueuePayload>(
      'integrations.sync',
      async (job) => {
        await this.processSyncJob(job.payload.syncJobId);
      },
    );
  }

  listProviders(): IntegrationProviderListItem[] {
    return [...INTEGRATION_PROVIDER_CATALOG];
  }

  async createConnection(
    input: CreateIntegrationConnectionInput,
  ): Promise<IntegrationConnectionRecord> {
    this.assertProviderSupported(input.providerKey);

    const authType = input.authType ?? this.getDefaultAuthType(input.providerKey);
    this.assertAuthTypeSupported(authType);

    const db = this.getDatabase();
    const now = new Date();
    const connectionId = randomUUID();

    try {
      const [connection] = await db
        .insert(integrationConnections)
        .values({
          id: connectionId,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          providerKey: input.providerKey,
          authType,
          credentialsRef: input.credentialsRef,
          settings: input.settings ?? {},
          metadata: input.metadata ?? {},
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.integrationConnectionCreated,
        organizationId: input.organizationId,
        actorId: input.actorUserId,
        actorType: input.actorUserId ? 'user' : undefined,
        resourceType: RESOURCE_TYPES.automation.integrationConnection,
        resourceId: connection.id,
        metadata: {
          providerKey: connection.providerKey,
          authType: connection.authType,
          workspaceId: connection.workspaceId,
        },
      });

      return connection;
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'Invalid organization or workspace reference for integration connection.',
        );
      }

      throw error;
    }
  }

  async getConnection(
    connectionId: string,
    organizationId: string,
  ): Promise<IntegrationConnectionRecord> {
    const db = this.getDatabase();
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, connectionId),
          eq(integrationConnections.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!connection) {
      throw new NotFoundException('Integration connection not found.');
    }

    return connection;
  }

  async testConnection(
    connectionId: string,
    input: TestIntegrationConnectionInput,
  ): Promise<TestedIntegrationConnectionResult> {
    const connection = await this.getConnection(connectionId, input.organizationId);
    const connector = this.resolveConnector(connection.providerKey);

    const result = await this.executeConnectorTest(connection, connector);
    const nextStatus: IntegrationConnectionStatus = result.status;
    const now = new Date();
    const db = this.getDatabase();

    const [updatedConnection] = await db
      .update(integrationConnections)
      .set({
        status: nextStatus,
        errorMessage: result.success ? null : result.message,
        lastTestedAt: now,
        updatedAt: now,
      })
      .where(eq(integrationConnections.id, connection.id))
      .returning();

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.integrationConnectionTested,
      organizationId: updatedConnection.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.automation.integrationConnection,
      resourceId: updatedConnection.id,
      metadata: {
        providerKey: updatedConnection.providerKey,
        status: updatedConnection.status,
        mode: result.mode,
      },
    });

    return {
      connection: updatedConnection,
      result,
    };
  }

  async queueSyncJob(
    connectionId: string,
    input: QueueIntegrationSyncInput,
  ): Promise<TriggeredSyncJobResult> {
    const connection = await this.getConnection(connectionId, input.organizationId);
    const connector = this.resolveConnector(connection.providerKey);
    const provider = this.getProviderCatalogEntry(connection.providerKey);

    if (!provider.supportsManualSync) {
      throw new BadRequestException(
        `Provider ${connection.providerKey} does not support manual sync jobs.`,
      );
    }

    if (!connector) {
      throw new ServiceUnavailableException(
        `Provider ${connection.providerKey} does not have an active connector implementation.`,
      );
    }

    const db = this.getDatabase();
    const now = new Date();
    const syncJobId = randomUUID();

    const [syncJob] = await db
      .insert(syncJobs)
      .values({
        id: syncJobId,
        organizationId: connection.organizationId,
        connectionId: connection.id,
        jobType: 'manual_sync',
        targetResourceType: input.targetResourceType,
        targetResourceId: input.targetResourceId,
        status: 'queued',
        attemptCount: 0,
        payload: input.payload ?? {},
        result: {},
        queuedAt: now,
      })
      .returning();

    const queueJobId = await this.jobQueueService.enqueue<IntegrationSyncQueuePayload>(
      'integrations.sync',
      {
        syncJobId: syncJob.id,
      },
    );

    await this.auditLogService.record({
      category: 'data_access',
      channel: 'api',
      action: AUDIT_ACTIONS.data_access.integrationSyncQueued,
      organizationId: connection.organizationId,
      actorId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : undefined,
      resourceType: RESOURCE_TYPES.automation.syncJob,
      resourceId: syncJob.id,
      metadata: {
        connectionId: connection.id,
        providerKey: connection.providerKey,
        queueJobId,
      },
    });

    return {
      syncJob,
      queueJobId,
    };
  }

  async listSyncJobs(input: ListSyncJobsInput): Promise<SyncJobRecord[]> {
    const db = this.getDatabase();
    const conditions = [eq(syncJobs.organizationId, input.organizationId)];

    if (input.connectionId) {
      conditions.push(eq(syncJobs.connectionId, input.connectionId));
    }

    if (input.status) {
      conditions.push(eq(syncJobs.status, input.status));
    }

    return db
      .select()
      .from(syncJobs)
      .where(and(...conditions))
      .orderBy(desc(syncJobs.queuedAt))
      .limit(50);
  }

  sanitizeConnection(connection: IntegrationConnectionRecord) {
    return {
      ...connection,
      settings: this.redactSecrets(connection.settings),
    };
  }

  private async processSyncJob(syncJobId: string): Promise<ProcessedSyncJobResult> {
    const db = this.getDatabase();
    const [syncJob] = await db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.id, syncJobId))
      .limit(1);

    if (!syncJob) {
      throw new NotFoundException('Sync job not found.');
    }

    const connection = await this.getConnection(syncJob.connectionId, syncJob.organizationId);
    const connector = this.resolveConnector(connection.providerKey);
    const existingExternalReference = await this.findExternalReference(
      connection,
      syncJob,
    );
    const startedAt = new Date();

    await db
      .update(syncJobs)
      .set({
        status: 'running',
        startedAt,
        attemptCount: syncJob.attemptCount + 1,
      })
      .where(eq(syncJobs.id, syncJob.id));

    try {
      const result = await connector.sync({
        connectionId: connection.id,
        organizationId: connection.organizationId,
        settings: connection.settings,
        metadata: connection.metadata,
        syncPayload: syncJob.payload,
        targetResourceType: syncJob.targetResourceType,
        targetResourceId: syncJob.targetResourceId,
        externalReference: existingExternalReference,
      });

      const finishedAt = new Date();
      const persistedExternalReference = result.externalReference
        ? await this.upsertExternalReference(
            connection,
            result.externalReference,
            finishedAt,
          )
        : null;

      const [updatedSyncJob] = await db
        .update(syncJobs)
        .set({
          status: result.status,
          result: {
            ...result.metadata,
            mode: result.mode,
            message: result.message,
            ...(persistedExternalReference
              ? {
                  externalReference: {
                    externalId: persistedExternalReference.externalId,
                    externalObjectType:
                      persistedExternalReference.externalObjectType,
                    externalReferenceKey:
                      persistedExternalReference.externalReferenceKey,
                    localResourceId: persistedExternalReference.localResourceId,
                    localResourceType:
                      persistedExternalReference.localResourceType,
                  },
                }
              : {}),
          },
          finishedAt,
          lastErrorCode: null,
          lastErrorMessage: null,
        })
        .where(eq(syncJobs.id, syncJob.id))
        .returning();

      await db
        .update(integrationConnections)
        .set({
          status: 'connected',
          errorMessage: null,
          lastSyncedAt: finishedAt,
          updatedAt: finishedAt,
        })
        .where(eq(integrationConnections.id, connection.id));

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.integrationSyncCompleted,
        organizationId: connection.organizationId,
        resourceType: RESOURCE_TYPES.automation.syncJob,
        resourceId: updatedSyncJob.id,
        metadata: {
          connectionId: connection.id,
          externalId: persistedExternalReference?.externalId,
          externalObjectType: persistedExternalReference?.externalObjectType,
          providerKey: connection.providerKey,
          mode: result.mode,
        },
      });

      await this.webhookService.emitEvent(
        WEBHOOK_EVENTS.integrations.syncCompleted,
        {
          connectionId: connection.id,
          externalId: persistedExternalReference?.externalId,
          externalObjectType: persistedExternalReference?.externalObjectType,
          providerKey: connection.providerKey,
          syncJobId: updatedSyncJob.id,
          status: updatedSyncJob.status,
          mode: result.mode,
        },
        connection.organizationId,
      );

      return {
        syncJob: updatedSyncJob,
        result,
      };
    } catch (error) {
      const finishedAt = new Date();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown integration sync error';

      const [failedSyncJob] = await db
        .update(syncJobs)
        .set({
          status: 'failed',
          finishedAt,
          lastErrorCode: 'sync_failed',
          lastErrorMessage: errorMessage,
          result: {
            error: errorMessage,
          },
        })
        .where(eq(syncJobs.id, syncJob.id))
        .returning();

      await db
        .update(integrationConnections)
        .set({
          status: 'degraded',
          errorMessage,
          updatedAt: finishedAt,
        })
        .where(eq(integrationConnections.id, connection.id));

      await this.auditLogService.record({
        category: 'data_access',
        channel: 'api',
        action: AUDIT_ACTIONS.data_access.integrationSyncFailed,
        organizationId: connection.organizationId,
        resourceType: RESOURCE_TYPES.automation.syncJob,
        resourceId: failedSyncJob.id,
        metadata: {
          connectionId: connection.id,
          providerKey: connection.providerKey,
          error: errorMessage,
        },
      });

      await this.webhookService.emitEvent(
        WEBHOOK_EVENTS.integrations.syncFailed,
        {
          connectionId: connection.id,
          providerKey: connection.providerKey,
          syncJobId: failedSyncJob.id,
          status: failedSyncJob.status,
          error: errorMessage,
        },
        connection.organizationId,
      );

      throw error;
    }
  }

  private async executeConnectorTest(
    connection: IntegrationConnectionRecord,
    connector: IntegrationConnector,
  ): Promise<IntegrationConnectionTestResult> {
    try {
      return await connector.testConnection({
        connectionId: connection.id,
        organizationId: connection.organizationId,
        settings: connection.settings,
        metadata: connection.metadata,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown integration test error';

      return {
        success: false,
        status: 'degraded',
        mode: 'live',
        message,
        metadata: {
          error: message,
        },
      };
    }
  }

  private resolveConnector(providerKey: IntegrationProviderKey): IntegrationConnector {
    const connector = this.connectors.get(providerKey);

    if (!connector) {
      throw new ServiceUnavailableException(
        `Provider ${providerKey} does not have an active connector implementation.`,
      );
    }

    return connector;
  }

  private getProviderCatalogEntry(providerKey: IntegrationProviderKey) {
    const provider = INTEGRATION_PROVIDER_CATALOG.find(
      (entry) => entry.key === providerKey,
    );

    if (!provider) {
      throw new BadRequestException(`Unsupported integration provider ${providerKey}.`);
    }

    return provider;
  }

  private async findExternalReference(
    connection: IntegrationConnectionRecord,
    syncJob: SyncJobRecord,
  ): Promise<IntegrationExternalReferenceRecord | null> {
    const lookup = this.resolveExternalReferenceLookup(syncJob.payload);

    if (!lookup) {
      return null;
    }

    const db = this.getDatabase();
    const [externalReference] = await db
      .select()
      .from(integrationExternalReferences)
      .where(
        and(
          eq(
            integrationExternalReferences.organizationId,
            connection.organizationId,
          ),
          eq(integrationExternalReferences.connectionId, connection.id),
          eq(integrationExternalReferences.providerKey, connection.providerKey),
          eq(
            integrationExternalReferences.localResourceType,
            lookup.localResourceType,
          ),
          eq(
            integrationExternalReferences.localResourceId,
            lookup.localResourceId,
          ),
          eq(
            integrationExternalReferences.externalObjectType,
            lookup.externalObjectType,
          ),
        ),
      )
      .limit(1);

    return externalReference ?? null;
  }

  private async upsertExternalReference(
    connection: IntegrationConnectionRecord,
    snapshot: IntegrationExternalReferenceSnapshot,
    syncedAt: Date,
  ): Promise<IntegrationExternalReferenceRecord | null> {
    const externalId = snapshot.externalId.trim();

    if (externalId.length === 0) {
      return null;
    }

    const externalReferenceKey = snapshot.externalReferenceKey?.trim();
    const db = this.getDatabase();
    const [externalReference] = await db
      .insert(integrationExternalReferences)
      .values({
        id: randomUUID(),
        organizationId: connection.organizationId,
        connectionId: connection.id,
        providerKey: connection.providerKey,
        localResourceType: snapshot.localResourceType,
        localResourceId: snapshot.localResourceId,
        externalObjectType: snapshot.externalObjectType,
        externalId,
        externalReferenceKey:
          externalReferenceKey && externalReferenceKey.length > 0
            ? externalReferenceKey
            : null,
        metadata: snapshot.metadata ?? {},
        lastSyncedAt: syncedAt,
        createdAt: syncedAt,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: [
          integrationExternalReferences.connectionId,
          integrationExternalReferences.localResourceType,
          integrationExternalReferences.localResourceId,
          integrationExternalReferences.externalObjectType,
        ],
        set: {
          externalId,
          externalReferenceKey:
            externalReferenceKey && externalReferenceKey.length > 0
              ? externalReferenceKey
              : null,
          metadata: snapshot.metadata ?? {},
          lastSyncedAt: syncedAt,
          updatedAt: syncedAt,
        },
      })
      .returning();

    return externalReference ?? null;
  }

  private resolveExternalReferenceLookup(
    payload: SyncJobRecord['payload'],
  ): IntegrationExternalReferenceLookup | null {
    if (!isAccountingErpSyncPayload(payload)) {
      return null;
    }

    return {
      localResourceType: payload.source.resourceType,
      localResourceId: payload.source.resourceId,
      externalObjectType: payload.entityType,
    };
  }

  private getDefaultAuthType(providerKey: IntegrationProviderKey): IntegrationAuthType {
    return this.getProviderCatalogEntry(providerKey).authType;
  }

  private assertProviderSupported(providerKey: string): void {
    if (!INTEGRATION_PROVIDER_KEY_SET.has(providerKey as IntegrationProviderKey)) {
      throw new BadRequestException(`Unsupported integration provider ${providerKey}.`);
    }
  }

  private assertAuthTypeSupported(authType: string): void {
    if (!INTEGRATION_AUTH_TYPE_SET.has(authType as IntegrationAuthType)) {
      throw new BadRequestException(`Unsupported integration auth type ${authType}.`);
    }
  }

  private redactSecrets(source: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(source).map(([key, value]) => {
      if (this.isSecretLikeKey(key)) {
        return [key, '[redacted]'];
      }

      return [key, value];
    });

    return Object.fromEntries(entries);
  }

  private isSecretLikeKey(key: string): boolean {
    return /(token|secret|password|apikey|api_key|auth)/i.test(key);
  }

  private getDatabase() {
    if (!this.databaseService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Database is not configured for integration workflow operations.',
      );
    }

    return this.databaseService.db;
  }

  private isForeignKeyViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    return (
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === '23503'
    );
  }
}