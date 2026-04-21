export type StorageDriver = 'local' | 'bunny';

export interface StoreFileInput {
  storageKey: string;
  body: Buffer;
  contentType: string;
}

export interface StoredFile {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  publicUrl: string | null;
}

export interface RetrievedFile {
  body: Buffer;
  contentType: string | null;
  sizeBytes: number;
}

export interface StorageAdapter {
  readonly driver: StorageDriver;
  deleteObject(storageKey: string): Promise<void>;
  getObject(storageKey: string): Promise<RetrievedFile | null>;
  getPublicUrl(storageKey: string): string | null;
  putObject(input: StoreFileInput): Promise<StoredFile>;
}
