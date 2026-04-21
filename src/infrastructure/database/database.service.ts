import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import * as schema from './schema';

export type AppDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool | null;
  private readonly dbInstance: AppDatabase | null;

  constructor(private readonly configService: ConfigService<RuntimeEnv, true>) {
    const databaseUrl = this.configService.get('DATABASE_URL', { infer: true });

    if (!databaseUrl) {
      this.pool = null;
      this.dbInstance = null;
      return;
    }

    const shouldUseSsl = this.configService.get('DATABASE_SSL', {
      infer: true,
    });
    const maxConnections = this.configService.get('DATABASE_POOL_MAX', {
      infer: true,
    });

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: maxConnections,
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
    });

    this.dbInstance = drizzle(this.pool, { schema });
  }

  get db(): AppDatabase {
    if (!this.dbInstance) {
      throw new Error(
        'Database is not configured. Set DATABASE_URL before using Drizzle.',
      );
    }

    return this.dbInstance;
  }

  isConfigured(): boolean {
    return this.dbInstance !== null;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
