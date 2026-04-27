import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { RuntimeEnv } from '../config/runtime-env';

export function configureHttpApp(app: INestApplication): void {
  const configService = app.get(ConfigService<RuntimeEnv, true>);

  if (configService.get('HTTP_TRUST_PROXY', { infer: true })) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
}
