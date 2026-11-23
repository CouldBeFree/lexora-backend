import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhraseCard } from '../phrases/entities/phrase-card.entity';
import { VocabCard } from '../cards/entities/vocab-card.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { WordReminder } from './entities/word-reminder.entity';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PhraseRemindersService } from './phrase-reminders.service';
import { WordRemindersService } from './word-reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PushSubscriptionEntity,
      PhraseReminder,
      WordReminder,
      PhraseCard,
      VocabCard,
    ]),
  ],
  controllers: [PushController],
  providers: [PushService, PhraseRemindersService, WordRemindersService],
})
export class PushModule {}
