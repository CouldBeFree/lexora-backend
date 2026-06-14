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

export enum Mastery {
  LEARNING = 'learning',
  MASTERED = 'mastered',
}

@Entity('vocab_cards')
export class VocabCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  word: string;

  @Column({ default: 'noun' })
  pos: string;

  @Column({ default: '' })
  pron: string;

  @Column({ default: '' })
  explanation: string;

  @Column({ type: 'simple-json', default: [] })
  example: string[];

  @Column({ type: 'enum', enum: Mastery, default: Mastery.LEARNING })
  mastery: Mastery;

  @Column({ default: 0 })
  streak: number;

  @CreateDateColumn()
  addedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
