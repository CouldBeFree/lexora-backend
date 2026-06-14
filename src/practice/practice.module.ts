import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WordProgress } from './entities/word-progress.entity';
import { PracticeError } from './entities/practice-error.entity';
import { VocabCard } from '../cards/entities/vocab-card.entity';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { PracticeAiService } from './practice-ai.service';
import { PracticeErrorsService } from './practice-errors.service';

@Module({
  imports: [TypeOrmModule.forFeature([WordProgress, PracticeError, VocabCard])],
  controllers: [PracticeController],
  providers: [PracticeService, PracticeAiService, PracticeErrorsService],
})
export class PracticeModule {}
