import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhraseCard } from '../phrases/entities/phrase-card.entity';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PhraseReminder } from './entities/phrase-reminder.entity';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PhraseRemindersService } from './phrase-reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PushSubscriptionEntity,
      PhraseReminder,
      PhraseCard,
    ]),
  ],
  controllers: [PushController],
  providers: [PushService, PhraseRemindersService],
})
export class PushModule {}
