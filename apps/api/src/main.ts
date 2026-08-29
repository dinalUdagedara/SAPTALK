import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/**
 * Origins allowed to call this API.
 *
 * CORS_ORIGIN takes a comma-separated list so the deployed frontend and local
 * development can both be permitted without redeploying between them.
 */
function allowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured?.length ? configured : ['http://localhost:3000'];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind Vercel's proxy the socket address is the proxy's. Trusting one hop
  // lets the throttle guard see the caller rather than counting every visitor
  // as the same client.
  app.set('trust proxy', 1);

  app.enableCors({ origin: allowedOrigins() });
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  new Logger('Bootstrap').log(`SAPTalk API listening on http://localhost:${port}/api`);
}

void bootstrap();
