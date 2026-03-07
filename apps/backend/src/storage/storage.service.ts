import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import type { ReadableStream } from 'stream/web';
import { RuntimeConfigService } from '../system-config/runtime-config.service';

type PresignClientCompat = Parameters<typeof getSignedUrl>[0];
type PresignCommandCompat = Parameters<typeof getSignedUrl>[1];

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket = 'submissions';
  private region = 'us-east-1';
  private bucketReady = false;
  private bucketEnsurePromise: Promise<{ client: S3Client; bucket: string }> | null = null;
  private bucketEnsureSignature = '';
  private clientSignature = '';

  constructor(private readonly runtimeConfigService: RuntimeConfigService) {}

  private async getClientContext(): Promise<{ client: S3Client; bucket: string }> {
    const cfg = await this.runtimeConfigService.getStorageRuntimeConfig();
    const nextSignature = JSON.stringify({
      endpoint: cfg.endpoint || '',
      bucket: cfg.bucket || 'submissions',
      region: cfg.region || 'us-east-1',
      accessKeySet: Boolean(cfg.accessKeyId),
      secretKeySet: Boolean(cfg.secretAccessKey),
    });
    if (!this.client || this.clientSignature !== nextSignature) {
      this.bucket = cfg.bucket || 'submissions';
      this.region = cfg.region || 'us-east-1';
      this.bucketReady = false;
      this.bucketEnsurePromise = null;
      this.bucketEnsureSignature = '';
      this.clientSignature = nextSignature;
      this.client = new S3Client({
        region: this.region,
        endpoint: cfg.endpoint || undefined,
        forcePathStyle: true,
        credentials:
          cfg.accessKeyId && cfg.secretAccessKey
            ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
            : undefined,
      });
    }
    return { client: this.client, bucket: this.bucket };
  }

  private async ensureBucket(): Promise<{ client: S3Client; bucket: string }> {
    const startedAt = Date.now();
    const context = await this.getClientContext();
    const { client, bucket } = context;
    if (this.bucketReady) {
      return context;
    }

    if (this.bucketEnsurePromise && this.bucketEnsureSignature === this.clientSignature) {
      return this.bucketEnsurePromise;
    }

    const ensureSignature = this.clientSignature;
    const ensurePromise = (async () => {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        if (this.clientSignature === ensureSignature) {
          this.bucketReady = true;
        }
        this.logger.debug(`Storage bucket ready bucket=${bucket} durationMs=${Date.now() - startedAt}`);
        return context;
      } catch (error) {
        this.logger.warn(`Bucket ${bucket} not found, creating...`);
      }

      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      if (this.clientSignature === ensureSignature) {
        this.bucketReady = true;
      }
      this.logger.log(`Storage bucket created bucket=${bucket} durationMs=${Date.now() - startedAt}`);
      return context;
    })().finally(() => {
      if (this.bucketEnsureSignature === ensureSignature) {
        this.bucketEnsurePromise = null;
        this.bucketEnsureSignature = '';
      }
    });

    this.bucketEnsurePromise = ensurePromise;
    this.bucketEnsureSignature = ensureSignature;
    return ensurePromise;
  }

  async putObject(key: string, body: Buffer, contentType?: string) {
    const startedAt = Date.now();
    const { client, bucket } = await this.ensureBucket();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.debug(
      `Storage object uploaded bucket=${bucket} key=${key} bytes=${body.length} durationMs=${Date.now() - startedAt}`,
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const startedAt = Date.now();
    const { client, bucket } = await this.ensureBucket();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Empty object body for key ${key}`);
    }

    const body = response.Body as unknown;

    let buffer: Buffer;
    if (body instanceof Readable) {
      buffer = await this.streamToBuffer(body);
    } else if (typeof (body as { getReader?: () => unknown }).getReader === 'function') {
      const readable = Readable.fromWeb(body as ReadableStream<Uint8Array>);
      buffer = await this.streamToBuffer(readable);
    } else {
      throw new Error(`Unsupported body type for key ${key}`);
    }

    if (buffer.length === 0) {
      this.logger.warn(`Object ${this.bucket}/${key} has zero bytes`);
    }

    this.logger.debug(
      `Storage object fetched bucket=${bucket} key=${key} bytes=${buffer.length} durationMs=${Date.now() - startedAt}`,
    );

    return buffer;
  }

  /**
   * Check if an object exists without downloading it.
   */
  async objectExists(key: string): Promise<boolean> {
    const { client, bucket } = await this.ensureBucket();
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const startedAt = Date.now();
    const { client, bucket } = await this.ensureBucket();
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      this.logger.debug(`Deleted object ${bucket}/${key} durationMs=${Date.now() - startedAt}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('NoSuchKey') || message.includes('NotFound')) {
        this.logger.debug(`Object already missing ${bucket}/${key} durationMs=${Date.now() - startedAt}`);
        return;
      }
      throw error;
    }
  }

  async deleteObjects(objectKeys: string[]): Promise<{
    ok: number;
    failed: { key: string; err: string }[];
  }> {
    const startedAt = Date.now();
    const { client, bucket } = await this.ensureBucket();
    if (!objectKeys.length) {
      return { ok: 0, failed: [] };
    }

    const failed: { key: string; err: string }[] = [];
    let ok = 0;
    const batchSize = 100;

    for (let i = 0; i < objectKeys.length; i += batchSize) {
      const batch = objectKeys.slice(i, i + batchSize);
      try {
        const response = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: batch.map((key) => ({ Key: key })),
              Quiet: true,
            },
          }),
        );

        const errorKeys = new Set<string>();
        (response.Errors || []).forEach((error) => {
          const key = error.Key || 'unknown';
          const code = error.Code || 'UnknownError';
          if (code === 'NoSuchKey' || code === 'NotFound') {
            return;
          }
          errorKeys.add(key);
          failed.push({ key, err: `${code}: ${error.Message || 'delete failed'}` });
        });

        ok += batch.length - errorKeys.size;
        this.logger.debug(
          `Storage delete batch bucket=${bucket} requested=${batch.length} deleted=${batch.length - errorKeys.size} failed=${errorKeys.size}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        batch.forEach((key) => failed.push({ key, err: message }));
      }
    }

    this.logger.debug(
      `Storage delete objects completed bucket=${bucket} requested=${objectKeys.length} ok=${ok} failed=${failed.length} durationMs=${Date.now() - startedAt}`,
    );

    return { ok, failed };
  }

  async listObjectKeys(prefix: string, maxKeys = 1000): Promise<string[]> {
    const startedAt = Date.now();
    const { client, bucket } = await this.ensureBucket();
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      }),
    );
    const keys = (result.Contents || []).map((obj) => obj.Key).filter((k): k is string => !!k);

    this.logger.debug(
      `Storage objects listed bucket=${bucket} prefix=${prefix} returned=${keys.length} maxKeys=${maxKeys} durationMs=${Date.now() - startedAt}`,
    );

    return keys;
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const startedAt = Date.now();
    const { client, bucket } = await this.ensureBucket();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    // @aws-sdk version mismatch between client-s3 and s3-request-presigner - safe to cast
    const url = await getSignedUrl(
      client as unknown as PresignClientCompat,
      command as unknown as PresignCommandCompat,
      { expiresIn },
    );

    this.logger.debug(
      `Storage presigned url generated bucket=${bucket} key=${key} expiresIn=${expiresIn} durationMs=${Date.now() - startedAt}`,
    );

    return url;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
