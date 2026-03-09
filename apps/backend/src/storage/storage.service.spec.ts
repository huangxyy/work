import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { RuntimeConfigService } from '../system-config/runtime-config.service';

const mockSend = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  HeadBucketCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  DeleteObjectsCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned-url.example.com/key'),
}));

describe('StorageService', () => {
  let service: StorageService;
  let runtimeConfig: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({});

    runtimeConfig = {
      getStorageRuntimeConfig: jest.fn().mockResolvedValue({
        endpoint: 'http://localhost:9000',
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: RuntimeConfigService, useValue: runtimeConfig },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  // ─── putObject ───

  describe('putObject', () => {
    it('should upload object to S3', async () => {
      await service.putObject('key.jpg', Buffer.from('data'), 'image/jpeg');

      expect(mockSend).toHaveBeenCalled();
    });
  });

  // ─── getObject ───

  describe('getObject', () => {
    it('should return buffer from readable body', async () => {
      const { Readable } = await import('stream');
      const body = Readable.from([Buffer.from('hello')]);
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockResolvedValueOnce({ Body: body }); // GetObject

      // Force bucket re-check by changing config
      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://other:9000',
        bucket: 'other-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.getObject('key.txt');

      expect(result.toString()).toBe('hello');
    });

    it('should throw on empty body', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockResolvedValueOnce({ Body: null }); // GetObject

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://empty:9000',
        bucket: 'empty-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      await expect(service.getObject('key.txt')).rejects.toThrow('Empty object body');
    });
  });

  // ─── objectExists ───

  describe('objectExists', () => {
    it('should return true when object exists', async () => {
      const result = await service.objectExists('key.jpg');

      expect(result).toBe(true);
    });

    it('should return false when object does not exist', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket (ensureBucket)
        .mockRejectedValueOnce(new Error('Not found')); // HeadObject

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://exists:9000',
        bucket: 'exists-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.objectExists('missing.jpg');

      expect(result).toBe(false);
    });
  });

  // ─── deleteObject ───

  describe('deleteObject', () => {
    it('should delete an object', async () => {
      await service.deleteObject('key.jpg');

      expect(mockSend).toHaveBeenCalled();
    });

    it('should ignore NoSuchKey errors', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockRejectedValueOnce(new Error('NoSuchKey'));

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://del:9000',
        bucket: 'del-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      await expect(service.deleteObject('missing.jpg')).resolves.toBeUndefined();
    });

    it('should throw on other delete errors', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockRejectedValueOnce(new Error('Permission denied'));

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://perm:9000',
        bucket: 'perm-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      await expect(service.deleteObject('key.jpg')).rejects.toThrow('Permission denied');
    });
  });

  // ─── deleteObjects ───

  describe('deleteObjects', () => {
    it('should return empty result for empty keys', async () => {
      const result = await service.deleteObjects([]);

      expect(result).toEqual({ ok: 0, failed: [] });
    });

    it('should delete multiple objects', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockResolvedValueOnce({ Errors: [] }); // DeleteObjects

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://multi:9000',
        bucket: 'multi-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.deleteObjects(['a.jpg', 'b.jpg']);

      expect(result.ok).toBe(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle partial failures', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockResolvedValueOnce({
          Errors: [{ Key: 'b.jpg', Code: 'InternalError', Message: 'fail' }],
        });

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://partial:9000',
        bucket: 'partial-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.deleteObjects(['a.jpg', 'b.jpg']);

      expect(result.ok).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].key).toBe('b.jpg');
    });

    it('should ignore NoSuchKey errors in batch delete', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockResolvedValueOnce({
          Errors: [{ Key: 'b.jpg', Code: 'NoSuchKey' }],
        });

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://nosuch:9000',
        bucket: 'nosuch-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.deleteObjects(['a.jpg', 'b.jpg']);

      expect(result.ok).toBe(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle send exception for entire batch', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockRejectedValueOnce(new Error('Network error'));

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://net:9000',
        bucket: 'net-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.deleteObjects(['a.jpg']);

      expect(result.ok).toBe(0);
      expect(result.failed).toHaveLength(1);
    });
  });

  // ─── listObjectKeys ───

  describe('listObjectKeys', () => {
    it('should list object keys with prefix', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockResolvedValueOnce({
          Contents: [{ Key: 'prefix/a.jpg' }, { Key: 'prefix/b.jpg' }],
        });

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://list:9000',
        bucket: 'list-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.listObjectKeys('prefix/');

      expect(result).toEqual(['prefix/a.jpg', 'prefix/b.jpg']);
    });

    it('should return empty array when no contents', async () => {
      mockSend
        .mockResolvedValueOnce({}) // HeadBucket
        .mockResolvedValueOnce({ Contents: undefined });

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://empty2:9000',
        bucket: 'empty2-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      const result = await service.listObjectKeys('prefix/');

      expect(result).toEqual([]);
    });
  });

  // ─── getPresignedUrl ───

  describe('getPresignedUrl', () => {
    it('should return a presigned URL', async () => {
      const url = await service.getPresignedUrl('key.jpg', 3600);

      expect(url).toBe('https://presigned-url.example.com/key');
    });
  });

  // ─── ensureBucket ───

  describe('ensureBucket', () => {
    it('should create bucket when it does not exist', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('Not found')) // HeadBucket fails
        .mockResolvedValueOnce({}); // CreateBucket succeeds

      runtimeConfig.getStorageRuntimeConfig.mockResolvedValue({
        endpoint: 'http://create:9000',
        bucket: 'new-bucket',
        region: 'us-east-1',
        accessKeyId: 'k',
        secretAccessKey: 's',
      });

      await service.putObject('test.jpg', Buffer.from('data'));

      // HeadBucket (fail) + CreateBucket + PutObject = 3 calls
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });
});
