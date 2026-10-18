import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PhraseCard } from './phrase-card.entity';
import { User } from '../../users/entities/user.entity';

@Entity('phrase_sentences')
export class PhraseSentenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phraseId: string;

  @ManyToOne(() => PhraseCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phraseId' })
  phraseCard: PhraseCard;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  sentence: string;

  @CreateDateColumn()
  createdAt: Date;
}
