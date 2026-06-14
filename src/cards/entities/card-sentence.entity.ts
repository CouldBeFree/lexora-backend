import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VocabCard } from './vocab-card.entity';
import { User } from '../../users/entities/user.entity';

@Entity('card_sentences')
export class CardSentenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cardId: string;

  @ManyToOne(() => VocabCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cardId' })
  card: VocabCard;

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
