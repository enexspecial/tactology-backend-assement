import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileuploadsService } from './fileuploads.service';
import { FileuploadsResolver } from './fileuploads.resolver';
import { Fileupload } from './entities/fileupload.entity';
import { MinioService } from './mino.service';
import { PubSub } from 'graphql-subscriptions';
import { UploadScalar } from './scalars/upload.scalar';

@Module({
  imports: [TypeOrmModule.forFeature([Fileupload])],
  providers: [
    FileuploadsResolver,
    FileuploadsService,
    MinioService,
    UploadScalar,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: [FileuploadsService],
})
export class FileuploadsModule {}
