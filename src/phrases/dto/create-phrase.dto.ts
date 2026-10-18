import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePhraseDto {
  @IsString()
  @IsNotEmpty({ message: 'phrase should not be empty' })
  phrase: string;
}
