import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { VocabCard } from '../../cards/entities/vocab-card.entity';

@Entity('word_progress')
export class WordProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  wordId: string;

  @ManyToOne(() => VocabCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wordId' })
  word: VocabCard;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  round1_completed: boolean;

  @Column({ default: false })
  round2_completed: boolean;

  @Column({ default: false })
  mode2_completed: boolean;

  @Column({ default: false })
  mode3_completed: boolean;

  @Column({ default: 0 })
  total_score: number;

  @Column({ type: 'timestamp', nullable: true })
  last_practiced: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_decay_at: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
