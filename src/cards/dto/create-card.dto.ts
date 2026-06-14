import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCardDto {
  @IsString()
  @IsNotEmpty({ message: 'word should not be empty' })
  word: string;

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
}
