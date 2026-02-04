import { Readable } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSub } from 'graphql-subscriptions';
import { FileuploadsService } from './fileuploads.service';
import { Fileupload } from './entities/fileupload.entity';
import { MinioService } from './mino.service';
import { User } from '../auth/entities/user.entity';

function user(id: number): User {
  const u = new User();
  u.id = id;
  u.email = 'u@test.com';
  u.password = 'x';
  u.createdAt = new Date();
  u.updatedAt = new Date();
  u.deletedAt = new Date();
  return u;
}

function fileRecord(overrides: Partial<Fileupload> = {}): Fileupload {
  const f = new Fileupload();
  f.id = 1;
  f.userId = 1;
  f.fileName = 'doc.pdf';
  f.objectKey = '123-doc.pdf';
  f.size = 100;
  f.mimeType = 'application/pdf';
  f.createdAt = new Date();
  f.updatedAt = new Date();
  f.deletedAt = new Date();
  return Object.assign(f, overrides);
}

describe('FileuploadsService', () => {
  let service: FileuploadsService;
  let fileRepo: Repository<Fileupload>;
  let minio: MinioService;
  let pubSub: PubSub;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn((dto) => ({ ...dto, id: 1, createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date() })),
      save: jest.fn((f) => Promise.resolve({ ...f, id: 1 })),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      find: jest.fn().mockResolvedValue([]),
    };
    const mockMinio = {
      uploadFile: jest.fn().mockResolvedValue('stored-key'),
    };
    const mockPubSub = {
      publish: jest.fn().mockResolvedValue(undefined),
      asyncIterator: jest.fn(() => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: undefined, done: true }) }) })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileuploadsService,
        { provide: getRepositoryToken(Fileupload), useValue: mockRepo },
        { provide: MinioService, useValue: mockMinio },
        { provide: 'PUB_SUB', useValue: mockPubSub },
      ],
    }).compile();

    service = module.get<FileuploadsService>(FileuploadsService);
    fileRepo = module.get(getRepositoryToken(Fileupload));
    minio = module.get<MinioService>(MinioService);
    pubSub = module.get('PUB_SUB');
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('uploads to minio, saves record, publishes event', async () => {
      const file = Promise.resolve({
        filename: 'a.txt',
        mimetype: 'text/plain',
        encoding: 'utf8',
        createReadStream: () => Readable.from([Buffer.from('hello')]),
      });
      (fileRepo.save as jest.Mock).mockImplementation((f) => Promise.resolve({ ...f, id: 1 }));

      const out = await service.uploadFile(user(1), file);

      expect(out.fileName).toBe('a.txt');
      expect(out.userId).toBe(1);
      expect(minio.uploadFile).toHaveBeenCalledWith('a.txt', expect.any(Buffer), 'text/plain');
      expect(fileRepo.save).toHaveBeenCalled();
      expect(pubSub.publish).toHaveBeenCalledWith('fileUploaded', expect.objectContaining({ userId: 1 }));
    });
  });

  describe('findUserFiles', () => {
    it('returns paginated list and totals', async () => {
      const list = [fileRecord({ id: 1 }), fileRecord({ id: 2 })];
      (fileRepo.findAndCount as jest.Mock).mockResolvedValue([list, 2]);

      const out = await service.findUserFiles(1, { page: 1, limit: 10 });

      expect(out.data).toHaveLength(2);
      expect(out.total).toBe(2);
      expect(out.page).toBe(1);
      expect(out.limit).toBe(10);
      expect(out.totalPages).toBe(1);
      expect(out.hasNextPage).toBe(false);
      expect(out.hasPreviousPage).toBe(false);
    });

    it('defaults page and limit when no pagination given', async () => {
      (fileRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const out = await service.findUserFiles(1);

      expect(out.page).toBe(1);
      expect(out.limit).toBe(10);
      expect(fileRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });
  });

  describe('getUserMetrics', () => {
    it('returns totals and per-day counts', async () => {
      const d = new Date();
      const sameDay = new Date(d);
      sameDay.setHours(0, 0, 0, 0);
      const files = [
        fileRecord({ id: 1, size: 100, createdAt: d }),
        fileRecord({ id: 2, size: 200, createdAt: d }),
      ];
      (fileRepo.find as jest.Mock).mockResolvedValue(files);

      const out = await service.getUserMetrics(1);

      expect(out.totalFiles).toBe(2);
      expect(out.totalStorage).toBe(300);
      expect(out.uploadsPerDay).toHaveLength(1);
      expect(out.uploadsPerDay[0].count).toBe(2);
    });

    it('returns zeros when no files', async () => {
      (fileRepo.find as jest.Mock).mockResolvedValue([]);

      const out = await service.getUserMetrics(1);

      expect(out.totalFiles).toBe(0);
      expect(out.totalStorage).toBe(0);
      expect(out.uploadsPerDay).toEqual([]);
    });
  });

  describe('fileUploadedSubscription', () => {
    it('returns iterator for fileUploaded', () => {
      service.fileUploadedSubscription();

      expect(pubSub.asyncIterator).toHaveBeenCalledWith('fileUploaded');
    });
  });
});
