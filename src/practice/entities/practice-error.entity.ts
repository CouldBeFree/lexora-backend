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

@Entity('practice_errors')
export class PracticeError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  wordId: string;

  @ManyToOne(() => VocabCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wordId' })
  card: VocabCard;

  @Column()
  originalSentence: string;

  @Column()
  grammarFeedback: string;

  @Column({ nullable: true, type: 'varchar' })
  resolvedSentence: string | null;

  @Column({ nullable: true, type: 'varchar' })
  resolvedFeedback: string | null;

  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
