import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FileuploadsModule } from './fileuploads/fileuploads.module';
import { typeOrmConfig } from './config/typeormConfig';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 10 },
    ]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      debug: true,

      context: ({ req }) => ({ req }),
      subscriptions: {
        'graphql-ws': {
          onConnect: (context: any) => {
            const { connectionParams } = context;
            return { req: { headers: connectionParams } };
          },
        },
      },
    }),
    AuthModule,
    FileuploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
