import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RuntimeEnv } from '../../common/config/runtime-env';
import { BunnyStorageAdapter } from './drivers/bunny-storage.adapter';
import { LocalDiskStorageAdapter } from './drivers/local-disk-storage.adapter';
import type {
  RetrievedFile,
  StorageAdapter,
  StoreFileInput,
  StoredFile,
} from './storage.types';

@Injectable()
export class StorageService {
  private readonly adapter: StorageAdapter;

  constructor(private readonly configService: ConfigService<RuntimeEnv, true>) {
    const storageDriver = this.configService.get('STORAGE_DRIVER', {
      infer: true,
    });

    this.adapter =
      storageDriver === 'bunny'
        ? new BunnyStorageAdapter({
            apiKey: this.configService.get('BUNNY_STORAGE_API_KEY', {
              infer: true,
            })!,
            pullZoneBaseUrl: this.configService.get(
              'BUNNY_PULL_ZONE_BASE_URL',
              {
                infer: true,
              },
            )!,
            region: this.configService.get('BUNNY_STORAGE_REGION', {
              infer: true,
            })!,
            storageZone: this.configService.get('BUNNY_STORAGE_ZONE', {
              infer: true,
            })!,
          })
        : new LocalDiskStorageAdapter(
            this.configService.get('LOCAL_STORAGE_PATH', { infer: true }),
          );
  }

  get driver() {
    return this.adapter.driver;
  }

  async putObject(input: StoreFileInput): Promise<StoredFile> {
    return this.adapter.putObject(input);
  }

  async getObject(storageKey: string): Promise<RetrievedFile | null> {
    return this.adapter.getObject(storageKey);
  }

  getPublicUrl(storageKey: string): string | null {
    return this.adapter.getPublicUrl(storageKey);
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.adapter.deleteObject(storageKey);
  }

  getAdapter(): StorageAdapter {
    return this.adapter;
  }
}
