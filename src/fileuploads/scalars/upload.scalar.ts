import { Scalar, CustomScalar } from '@nestjs/graphql';
import { ValueNode } from 'graphql';
import { FileUpload } from '../types/file-upload.interface';

@Scalar('Upload')
export class UploadScalar implements CustomScalar<FileUpload, FileUpload> {
  description = 'Upload';

  parseValue(value: FileUpload): FileUpload {
    return value;
  }

  serialize(value: FileUpload): FileUpload {
    return value;
  }

  parseLiteral(ast: ValueNode): FileUpload {
    throw new Error('Upload not parseable from literal');
  }
}
