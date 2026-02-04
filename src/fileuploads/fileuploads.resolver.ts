import { UseGuards } from '@nestjs/common';
import {
  Resolver,
  Query,
  Mutation,
  Args,
  Subscription,
} from '@nestjs/graphql';
import { FileuploadsService } from './fileuploads.service';
import { Fileupload } from './entities/fileupload.entity';
import { FileUploadInput } from './dto/file-upload.input';
import { UploadMetrics } from './dto/upload-metrics.type';
import { PaginatedFiles } from './dto/paginated-files.type';
import { PaginationInput } from './dto/pagination.input';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Resolver(() => Fileupload)
export class FileuploadsResolver {
  constructor(
    private readonly fileuploadsService: FileuploadsService,
  ) {}

  @Mutation(() => Fileupload)
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  async uploadFile(
    @Args('input') input: FileUploadInput,
    @CurrentUser() user: User,
  ): Promise<Fileupload> {
    return this.fileuploadsService.uploadFile(user, input.file);
  }

  @Query(() => PaginatedFiles, { name: 'myFiles' })
  @UseGuards(JwtAuthGuard)
  async myFiles(
    @CurrentUser() user: User,
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination?: PaginationInput,
  ): Promise<PaginatedFiles> {
    return this.fileuploadsService.findUserFiles(user.id, pagination);
  }

  @Query(() => UploadMetrics, { name: 'myUploadMetrics' })
  @UseGuards(JwtAuthGuard)
  async myUploadMetrics(
    @CurrentUser() user: User,
  ): Promise<UploadMetrics> {
    return this.fileuploadsService.getUserMetrics(user.id);
  }

  @Subscription(() => Fileupload, {
    name: 'fileUploaded',
    filter: (payload, variables, context) =>
      payload.fileUploaded.userId === context.req.user.id,
  })
  @UseGuards(JwtAuthGuard)
  fileUploaded() {
    return this.fileuploadsService.fileUploadedSubscription();
  }
}
