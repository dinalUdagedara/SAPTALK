import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  new Logger('Bootstrap').log(`SAPTalk API listening on http://localhost:${port}/api`);
}

void bootstrap();
