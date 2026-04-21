import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  RetrievedFile,
  StorageAdapter,
  StoreFileInput,
  StoredFile,
} from '../storage.types';

export class LocalDiskStorageAdapter implements StorageAdapter {
  readonly driver = 'local' as const;

  constructor(private readonly rootPath: string) {}

  async putObject(input: StoreFileInput): Promise<StoredFile> {
    const filePath = this.resolveFilePath(input.storageKey);

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);

    return {
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      publicUrl: null,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    await rm(this.resolveFilePath(storageKey), { force: true });
  }

  async getObject(storageKey: string): Promise<RetrievedFile | null> {
    try {
      const body = await readFile(this.resolveFilePath(storageKey));

      return {
        body,
        contentType: null,
        sizeBytes: body.byteLength,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  getPublicUrl(): string | null {
    return null;
  }

  private resolveFilePath(storageKey: string): string {
    return path.join(this.rootPath, ...storageKey.split('/'));
  }
}
