import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class UploadsPerDay {
  @Field()
  date: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class UploadMetrics {
  @Field(() => Int)
  totalFiles: number;

  @Field(() => Int)
  totalStorage: number;

  @Field(() => [UploadsPerDay])
  uploadsPerDay: UploadsPerDay[];
}
