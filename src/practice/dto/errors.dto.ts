import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SaveErrorDto {
  @IsUUID('4')
  wordId: string;

  @IsString()
  @IsNotEmpty()
  originalSentence: string;

  @IsString()
  @IsNotEmpty()
  grammarFeedback: string;
}

export class CheckErrorDto {
  @IsString()
  @IsNotEmpty()
  sentence: string;
}
