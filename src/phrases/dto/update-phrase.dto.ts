import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePhraseDto {
  @IsString()
  @MinLength(1, { message: 'phrase should not be empty' })
  @IsOptional()
  phrase?: string;

  @IsString()
  @IsOptional()
  explanation?: string;
}
