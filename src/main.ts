import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureHttpApp } from './common/http/configure-http-app';
import { configureOpenApi } from './common/http/configure-openapi';
import type { RuntimeEnv } from './common/config/runtime-env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  configureHttpApp(app);
  configureOpenApi(app);

  const configService = app.get(ConfigService<RuntimeEnv, true>);
  const port = configService.get('PORT', { infer: true });

  await app.listen(port);
}
bootstrap();
