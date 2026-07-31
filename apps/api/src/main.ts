import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.enableShutdownHooks();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  const additionalOrigins = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [
      config.get<string>('WEB_URL', 'http://localhost:3000'),
      config.get<string>('ADMIN_URL', 'http://localhost:8848'),
      ...additionalOrigins,
    ],
    credentials: true,
    exposedHeaders: ['Content-Type', 'X-Request-Id'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Feedback Agent API')
    .setDescription('多应用用户反馈智能体平台 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(config.get<number>('API_PORT', 4100), '0.0.0.0');
}
void bootstrap();
