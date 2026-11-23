import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { ReminderSchedule } from '../reminder-schedule';

// Phrase reminder schedule of a user; exists while one of their devices has phrase reminders on
@Entity('phrase_reminders')
export class PhraseReminder implements ReminderSchedule {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  timezone: string;

  @Index()
  @Column({ type: 'timestamptz' })
  nextAt: Date;

  // The column keeps its original name, so existing schedules carry over
  @Column({ name: 'recentPhraseIds', type: 'simple-json', default: [] })
  recentIds: string[];
}
