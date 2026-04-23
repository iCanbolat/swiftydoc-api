import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('SwiftyDoc API')
    .setDescription(
      'Foundation API for secure document collection, file workflows and webhook automation.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque',
        description: 'Opaque internal access token returned by the auth API.',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description:
          'Portal access token returned by POST /v1/portal/access. Format: Portal <token>.',
      },
      'portal',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
