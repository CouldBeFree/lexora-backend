import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhraseCard } from './entities/phrase-card.entity';
import { PhraseSentenceEntity } from './entities/phrase-sentence.entity';
import { PhrasesController } from './phrases.controller';
import { PhrasesService } from './phrases.service';
import { PhrasesAiService } from './phrases-ai.service';

@Module({
  imports: [TypeOrmModule.forFeature([PhraseCard, PhraseSentenceEntity])],
  controllers: [PhrasesController],
  providers: [PhrasesService, PhrasesAiService],
})
export class PhrasesModule {}
