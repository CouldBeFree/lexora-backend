import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class StartRoundDto {
  @IsArray()
  @IsUUID('4', { each: true })
  wordIds: string[];
}

export class StartMode2Dto {
  @IsUUID('4')
  wordId: string;
}

export class ScoreRoundDto {
  @IsUUID('4')
  wordId: string;

  @IsBoolean()
  correct: boolean;
}

export class HintMode3Dto {
  @IsUUID('4')
  wordId: string;
}

export class CheckMode3Dto {
  @IsUUID('4')
  wordId: string;

  @IsString()
  @IsNotEmpty()
  sentence: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  hintSentence?: string;
}
