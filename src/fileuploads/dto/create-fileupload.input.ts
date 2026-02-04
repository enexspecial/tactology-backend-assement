import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateFileuploadInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
