import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`\n🚀 OneYield Backend running on http://localhost:${port}`);
  console.log(`📦 Chain Adapter: ${process.env.CHAIN_ADAPTER || 'stub'}`);
  console.log(`🎬 Demo Mode: ${process.env.DEMO_MODE || 'false'}\n`);
}
bootstrap();
