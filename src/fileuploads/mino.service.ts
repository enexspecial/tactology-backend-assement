import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly minioClient: Minio.Client;
  private bucketName = process.env.MINIO_BUCKET_NAME || 'fileuploads';
  private minioReady = false;

  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
      }
      this.minioReady = true;
    } catch (err) {
      this.logger.warn(`MinIO unreachable: ${(err as Error).message}`);
    }
  }

  private assertMinioReady() {
    if (!this.minioReady) {
      throw new ServiceUnavailableException('MinIO not available');
    }
  }

  async uploadFile(
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    this.assertMinioReady();
    const objectName = `${Date.now()}-${fileName}`;
    await this.minioClient.putObject(
      this.bucketName,
      objectName,
      fileBuffer,
      fileBuffer.length,
      { 'Content-Type': contentType },
    );
    return objectName;
  }

  async getFileUrl(objectName: string, expirySeconds = 3600): Promise<string> {
    this.assertMinioReady();
    return await this.minioClient.presignedGetObject(
      this.bucketName,
      objectName,
      expirySeconds,
    );
  }

  async deleteFile(objectName: string): Promise<void> {
    this.assertMinioReady();
    await this.minioClient.removeObject(this.bucketName, objectName);
  }
}
