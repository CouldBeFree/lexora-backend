import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { User } from './users/entities/user.entity';
import { VocabCard } from './cards/entities/vocab-card.entity';
import { CardSentenceEntity } from './cards/entities/card-sentence.entity';
import { WordProgress } from './practice/entities/word-progress.entity';
import { PracticeError } from './practice/entities/practice-error.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { PracticeModule } from './practice/practice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5434),
        database: config.get<string>('POSTGRES_DB', 'lexora'),
        username: config.get<string>('POSTGRES_USER', 'lexora'),
        password: config.get<string>(
          'POSTGRES_PASSWORD',
          'lexora_dev_password',
        ),
        entities: [User, VocabCard, CardSentenceEntity, WordProgress, PracticeError],
        synchronize: true,
      }),
    }),

    UsersModule,
    AuthModule,
    CardsModule,
    PracticeModule,
  ],
})
export class AppModule {}
