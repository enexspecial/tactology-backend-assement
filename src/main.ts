import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv, getConfig } from './config/appConfig';
import { join } from 'path';

async function bootstrap() {
  validateEnv();
  const config = getConfig();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const uploadPath = join(
    process.cwd(),
    'node_modules',
    'graphql-upload',
    'graphqlUploadExpress.mjs',
  );
  const graphqlUploadModule = await import(uploadPath);
  const graphqlUploadExpress = graphqlUploadModule.default;

  const tenMb = 10 * 1024 * 1024;
  app.use(
    graphqlUploadExpress({ maxFileSize: tenMb, maxFiles: 1 }),
  );

  await app.listen(config.port, '0.0.0.0');
}
bootstrap();
