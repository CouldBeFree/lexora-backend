import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Reminder schedule of a user; exists while they have at least one push subscription
@Entity('phrase_reminders')
export class PhraseReminder {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // IANA zone of the device that subscribed last, e.g. 'Europe/Kyiv'
  @Column()
  timezone: string;

  @Index()
  @Column({ type: 'timestamptz' })
  nextAt: Date;

  // Last sent phrases, skipped when picking the next one
  @Column({ type: 'simple-json', default: [] })
  recentPhraseIds: string[];
}
