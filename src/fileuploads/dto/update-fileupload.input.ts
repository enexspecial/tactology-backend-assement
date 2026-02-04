import { CreateFileuploadInput } from './create-fileupload.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateFileuploadInput extends PartialType(CreateFileuploadInput) {
  @Field(() => Int)
  id: number;
}
