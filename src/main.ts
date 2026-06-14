import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Parse cookies (needed for lx_session JWT)
  app.use(cookieParser());

  // CORS — allow the frontend origin with cookies
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Global validation: strip unknown fields, return { message } on failure
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip fields not in DTO
      transform: true, // auto-transform types (e.g. string → number)
      exceptionFactory: (errors) => {
        const message = errors
          .flatMap((e) => Object.values(e.constraints ?? {}))
          .join('; ');
        return new BadRequestException({
          message: message || 'Validation failed',
        });
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `🚀 Server running on http://localhost:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
