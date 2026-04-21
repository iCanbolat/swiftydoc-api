import { Injectable } from '@nestjs/common';
import { DatabaseService } from './infrastructure/database/database.service';
import { StorageService } from './infrastructure/storage/storage.service';

@Injectable()
export class AppService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  getStatus() {
    return {
      data: {
        name: 'swiftydoc-api',
        status: 'ok',
        phase: 'foundation',
        database: {
          driver: 'postgres',
          configured: this.databaseService.isConfigured(),
          orm: 'drizzle',
        },
        storage: {
          driver: this.storageService.driver,
        },
      },
    };
  }
}
