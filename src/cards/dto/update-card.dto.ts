import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Mastery } from '../entities/vocab-card.entity';

export class UpdateCardDto {
  @IsString()
  @MinLength(1, { message: 'word should not be empty' })
  @IsOptional()
  word?: string;

  @IsString()
  @IsOptional()
  pos?: string;

  @IsString()
  @IsOptional()
  pron?: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  example?: string;

  @IsEnum(Mastery, { message: 'mastery must be learning or mastered' })
  @IsOptional()
  mastery?: Mastery;

  @IsInt()
  @Min(0, { message: 'streak must be 0 or greater' })
  @IsOptional()
  streak?: number;
}
