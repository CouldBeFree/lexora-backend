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

// Word reminder schedule of a user; exists while one of their devices has word reminders on
@Entity('word_reminders')
export class WordReminder implements ReminderSchedule {
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

  @Column({ name: 'recentWordIds', type: 'simple-json', default: [] })
  recentIds: string[];
}
