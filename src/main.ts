import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureHttpApp } from './common/http/configure-http-app';
import { configureOpenApi } from './common/http/configure-openapi';
import { parseOriginList, type RuntimeEnv } from './common/config/runtime-env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<RuntimeEnv, true>);

  app.enableCors({
    credentials: true,
    origin: parseOriginList(
      configService.get('INTERNAL_AUTH_ALLOWED_ORIGINS', { infer: true }),
    ),
  });
  app.enableShutdownHooks();
  configureHttpApp(app);
  configureOpenApi(app);

  const port = configService.get('PORT', { infer: true });

  await app.listen(port);
}
bootstrap();
