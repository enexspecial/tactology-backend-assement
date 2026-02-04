import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Fileupload } from '../entities/fileupload.entity';

@ObjectType()
export class PaginatedFiles {
  @Field(() => [Fileupload])
  data: Fileupload[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}
