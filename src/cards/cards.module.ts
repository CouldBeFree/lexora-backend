import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabCard } from './entities/vocab-card.entity';
import { WordProgress } from '../practice/entities/word-progress.entity';
import { CardSentenceEntity } from './entities/card-sentence.entity';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { AutofillService } from './autofill.service';
import { CardSentencesService } from './card-sentences.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VocabCard, WordProgress, CardSentenceEntity]),
  ],
  controllers: [CardsController],
  providers: [CardsService, AutofillService, CardSentencesService],
})
export class CardsModule {}
