import { Field, InputType } from '@nestjs/graphql';
import { FileUpload } from '../types/file-upload.interface';
import { UploadScalar } from '../scalars/upload.scalar';

@InputType()
export class FileUploadInput {
  @Field(() => UploadScalar)
  file: Promise<FileUpload>;
}
