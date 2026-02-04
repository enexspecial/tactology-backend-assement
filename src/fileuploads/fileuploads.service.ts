import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSub } from 'graphql-subscriptions';
import { MinioService } from './mino.service';
import { Fileupload } from './entities/fileupload.entity';
import { User } from '../auth/entities/user.entity';
import { UploadMetrics, UploadsPerDay } from './dto/upload-metrics.type';
import { FileUpload } from './types/file-upload.interface';
import { PaginatedFiles } from './dto/paginated-files.type';
import { PaginationInput } from './dto/pagination.input';

@Injectable()
export class FileuploadsService {
  constructor(
    @InjectRepository(Fileupload)
    private readonly fileRepository: Repository<Fileupload>,
    private readonly minioService: MinioService,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  async uploadFile(
    user: User,
    file: Promise<FileUpload>,
  ): Promise<Fileupload> {
    const { createReadStream, filename, mimetype } = await file;
    const stream = createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(chunks);
    const fileSize = fileBuffer.length;
    const objectKey = await this.minioService.uploadFile(
      filename,
      fileBuffer,
      mimetype,
    );
    const fileRecord = this.fileRepository.create({
      userId: user.id,
      fileName: filename,
      objectKey,
      size: fileSize,
      mimeType: mimetype,
    });

    const savedFile = await this.fileRepository.save(fileRecord);
    await this.pubSub.publish('fileUploaded', {
      fileUploaded: savedFile,
      userId: user.id,
    });

    return savedFile;
  }

  async findUserFiles(
    userId: number,
    pagination?: PaginationInput,
  ): Promise<PaginatedFiles> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.fileRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async getUserMetrics(userId: number): Promise<UploadMetrics> {
    const files = await this.fileRepository.find({
      where: { userId },
    });

    const totalFiles = files.length;
    const totalStorage = files.reduce((sum, file) => sum + Number(file.size), 0);
    const uploadsByDay = new Map<string, number>();
    files.forEach((file) => {
      const date = file.createdAt.toISOString().split('T')[0];
      uploadsByDay.set(date, (uploadsByDay.get(date) || 0) + 1);
    });

    const uploadsPerDay: UploadsPerDay[] = Array.from(uploadsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalFiles,
      totalStorage,
      uploadsPerDay,
    };
  }

  fileUploadedSubscription() {
    return this.pubSub.asyncIterator('fileUploaded');
  }
}
