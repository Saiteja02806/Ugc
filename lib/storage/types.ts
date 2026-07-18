export type StorageProviderName = "aws" | "gcp";

export type UploadBufferParams = {
  key: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
};

export type CreateSignedPutUrlParams = {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
  cacheControl?: string;
};

export type StorageObjectKeyParams = {
  key: string;
};

export type GetStorageObjectParams = StorageObjectKeyParams & {
  range?: string;
};

export type StorageHeadObjectResult = {
  ContentType?: string;
  ContentLength?: number;
};

export type StorageObjectBody = {
  transformToWebStream(): ReadableStream<Uint8Array>;
};

export type StorageGetObjectResult = {
  Body?: StorageObjectBody;
  ContentType?: string;
  ContentLength?: number;
  ContentRange?: string;
};

export type StorageUploadResult = {
  key: string;
  url: string;
};

export type ObjectStorageProvider = {
  name: StorageProviderName;
  getMissingEnvVars(): string[];
  isTrustedUrl(url: string): boolean;
  buildDirectUrl(key: string): string;
  buildPublicUrl(key: string): string;
  createSignedPutUrl(params: CreateSignedPutUrlParams): Promise<string>;
  headObject(params: StorageObjectKeyParams): Promise<StorageHeadObjectResult>;
  getObject(params: GetStorageObjectParams): Promise<StorageGetObjectResult>;
  deleteObject(params: StorageObjectKeyParams): Promise<void>;
  uploadBuffer(params: UploadBufferParams): Promise<StorageUploadResult>;
};
