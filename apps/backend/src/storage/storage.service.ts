import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import type { ReadableStream } from 'stream/web';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private bucketReady = false;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>('MINIO_ENDPOINT');
    const accessKeyId = configService.get<string>('MINIO_ACCESS_KEY');
    const secretAccessKey = configService.get<string>('MINIO_SECRET_KEY');
    this.bucket = configService.get<string>('MINIO_BUCKET') || 'submissions';
    this.region = configService.get<string>('MINIO_REGION') || 'us-east-1';

    this.client = new S3Client({
      region: this.region,
      endpoint,
      forcePathStyle: true,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  private async ensureBucket() {
    if (this.bucketReady) {
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
      return;
    } catch (error) {
      this.logger.warn(`Bucket ${this.bucket} not found, creating...`);
    }

    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    this.bucketReady = true;
  }

  async putObject(key: string, body: Buffer, contentType?: string) {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    await this.ensureBucket();
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Empty object body for key ${key}`);
    }

    const body = response.Body as unknown;

    if (body instanceof Readable) {
      return this.streamToBuffer(body);
    }

    if (typeof (body as { getReader?: () => unknown }).getReader === 'function') {
      const readable = Readable.fromWeb(body as ReadableStream<Uint8Array>);
      return this.streamToBuffer(readable);
    }

    throw new Error(`Unsupported body type for key ${key}`);
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureBucket();
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.debug(`Deleted object ${this.bucket}/${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('NoSuchKey') || message.includes('NotFound')) {
        this.logger.debug(`Object already missing ${this.bucket}/${key}`);
        return;
      }
      throw error;
    }
  }

  async deleteObjects(objectKeys: string[]): Promise<{
    ok: number;
    failed: { key: string; err: string }[];
  }> {
    await this.ensureBucket();
    if (!objectKeys.length) {
      return { ok: 0, failed: [] };
    }

    const failed: { key: string; err: string }[] = [];
    let ok = 0;
    const batchSize = 100;

    for (let i = 0; i < objectKeys.length; i += batchSize) {
      const batch = objectKeys.slice(i, i + batchSize);
      try {
        const response = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
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
        this.logger.debug(`Deleted ${batch.length - errorKeys.size} objects in batch`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        batch.forEach((key) => failed.push({ key, err: message }));
      }
    }

    return { ok, failed };
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
