import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FileuploadsResolver } from './fileuploads.resolver';
import { FileuploadsService } from './fileuploads.service';
import { Fileupload } from './entities/fileupload.entity';
import { MinioService } from './mino.service';
import { User } from '../auth/entities/user.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';

const noopGuard = { canActivate: () => true };

describe('FileuploadsResolver', () => {
  let resolver: FileuploadsResolver;
  let fileuploadsService: FileuploadsService;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      find: jest.fn().mockResolvedValue([]),
    };
    const mockMinio = { uploadFile: jest.fn(), getFileUrl: jest.fn(), deleteFile: jest.fn() };
    const mockPubSub = { publish: jest.fn(), asyncIterator: jest.fn(() => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ value: undefined, done: true }) }) })) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileuploadsResolver,
        FileuploadsService,
        { provide: getRepositoryToken(Fileupload), useValue: mockRepo },
        { provide: MinioService, useValue: mockMinio },
        { provide: 'PUB_SUB', useValue: mockPubSub },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(noopGuard)
      .overrideGuard(UserThrottlerGuard).useValue(noopGuard)
      .compile();

    resolver = module.get<FileuploadsResolver>(FileuploadsResolver);
    fileuploadsService = module.get<FileuploadsService>(FileuploadsService);
  });

  it('is defined', () => {
    expect(resolver).toBeDefined();
  });

  it('myFiles delegates to service with user id and pagination', async () => {
    const user = { id: 42, email: 'u@test.com' } as User;
    const pagination = { page: 2, limit: 5 };
    const result = { data: [], total: 0, page: 2, limit: 5, totalPages: 0, hasNextPage: false, hasPreviousPage: true };
    jest.spyOn(fileuploadsService, 'findUserFiles').mockResolvedValue(result);

    const out = await resolver.myFiles(user, pagination);

    expect(fileuploadsService.findUserFiles).toHaveBeenCalledWith(42, pagination);
    expect(out).toBe(result);
  });

  it('myUploadMetrics delegates to service with user id', async () => {
    const user = { id: 1, email: 'u@test.com' } as User;
    const result = { totalFiles: 0, totalStorage: 0, uploadsPerDay: [] };
    jest.spyOn(fileuploadsService, 'getUserMetrics').mockResolvedValue(result);

    const out = await resolver.myUploadMetrics(user);

    expect(fileuploadsService.getUserMetrics).toHaveBeenCalledWith(1);
    expect(out).toBe(result);
  });

  it('fileUploaded returns subscription iterator', () => {
    const it = {};
    jest.spyOn(fileuploadsService, 'fileUploadedSubscription').mockReturnValue(it as any);

    const out = resolver.fileUploaded();

    expect(fileuploadsService.fileUploadedSubscription).toHaveBeenCalled();
    expect(out).toBe(it);
  });
});
