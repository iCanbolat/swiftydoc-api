import type {
  RetrievedFile,
  StorageAdapter,
  StoreFileInput,
  StoredFile,
} from '../storage.types';

interface BunnyStorageConfig {
  apiKey: string;
  pullZoneBaseUrl: string;
  region: string;
  storageZone: string;
}

export class BunnyStorageAdapter implements StorageAdapter {
  readonly driver = 'bunny' as const;

  constructor(private readonly config: BunnyStorageConfig) {}

  async putObject(input: StoreFileInput): Promise<StoredFile> {
    const response = await fetch(this.getStorageUrl(input.storageKey), {
      method: 'PUT',
      headers: {
        AccessKey: this.config.apiKey,
        'Content-Type': input.contentType,
      },
      body: new Uint8Array(input.body),
    });

    if (!response.ok) {
      throw new Error(`Bunny upload failed with status ${response.status}.`);
    }

    return {
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      publicUrl: this.getPublicUrl(input.storageKey),
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const response = await fetch(this.getStorageUrl(storageKey), {
      method: 'DELETE',
      headers: {
        AccessKey: this.config.apiKey,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Bunny delete failed with status ${response.status}.`);
    }
  }

  async getObject(storageKey: string): Promise<RetrievedFile | null> {
    const response = await fetch(this.getStorageUrl(storageKey), {
      method: 'GET',
      headers: {
        AccessKey: this.config.apiKey,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Bunny read failed with status ${response.status}.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    return {
      body,
      contentType: response.headers.get('content-type'),
      sizeBytes: body.byteLength,
    };
  }

  getPublicUrl(storageKey: string): string {
    const baseUrl = this.config.pullZoneBaseUrl.replace(/\/$/, '');

    return `${baseUrl}/${this.normalizeStorageKey(storageKey)}`;
  }

  private getStorageUrl(storageKey: string): string {
    const regionPrefix =
      this.config.region === 'de' ? '' : `${this.config.region}.`;

    return `https://${regionPrefix}storage.bunnycdn.com/${this.config.storageZone}/${this.normalizeStorageKey(storageKey)}`;
  }

  private normalizeStorageKey(storageKey: string): string {
    return storageKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }
}
