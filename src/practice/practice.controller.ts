import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PracticeService } from './practice.service';
import { PracticeErrorsService } from './practice-errors.service';
import {
  StartRoundDto,
  ScoreRoundDto,
  StartMode2Dto,
  HintMode3Dto,
  CheckMode3Dto,
} from './dto/practice.dto';
import { SaveErrorDto, CheckErrorDto } from './dto/errors.dto';

@Controller('practice')
@UseGuards(JwtAuthGuard)
export class PracticeController {
  constructor(
    private readonly practiceService: PracticeService,
    private readonly errorsService: PracticeErrorsService,
  ) {}

  @Post('round1')
  startRound1(@Req() req: Request, @Body() dto: StartRoundDto) {
    const { id } = req.user as { id: string };
    return this.practiceService.generateRound1(id, dto.wordIds);
  }

  @Put('round1/score')
  scoreRound1(@Req() req: Request, @Body() dto: ScoreRoundDto) {
    const { id } = req.user as { id: string };
    return this.practiceService.scoreRound1(id, dto.wordId, dto.correct);
  }

  @Post('round2')
  startRound2(@Req() req: Request, @Body() dto: StartRoundDto) {
    const { id } = req.user as { id: string };
    return this.practiceService.generateRound2(id, dto.wordIds);
  }

  @Put('round2/score')
  scoreRound2(@Req() req: Request, @Body() dto: ScoreRoundDto) {
    const { id } = req.user as { id: string };
    return this.practiceService.scoreRound2(id, dto.wordId, dto.correct);
  }

  @Post('mode2')
  startMode2(@Req() req: Request, @Body() dto: StartMode2Dto) {
    const { id } = req.user as { id: string };
    return this.practiceService.generateMode2(id, dto.wordId);
  }

  @Put('mode2/score')
  scoreMode2(@Req() req: Request, @Body() dto: ScoreRoundDto) {
    const { id } = req.user as { id: string };
    return this.practiceService.scoreMode2(id, dto.wordId, dto.correct);
  }

  @Post('mode3/hint')
  getMode3Hint(@Req() req: Request, @Body() dto: HintMode3Dto) {
    const { id } = req.user as { id: string };
    return this.practiceService.getMode3Hint(id, dto.wordId);
  }

  @Post('mode3/check')
  checkMode3(@Req() req: Request, @Body() dto: CheckMode3Dto) {
    const { id } = req.user as { id: string };
    return this.practiceService.checkMode3(
      id,
      dto.wordId,
      dto.sentence,
      dto.hintSentence,
    );
  }

  @Put('mode3/score')
  scoreMode3(@Req() req: Request, @Body() dto: ScoreRoundDto) {
    const { id } = req.user as { id: string };
    return this.practiceService.scoreMode3(id, dto.wordId, dto.correct);
  }

  @Post('errors')
  saveError(@Req() req: Request, @Body() dto: SaveErrorDto) {
    const { id } = req.user as { id: string };
    return this.errorsService.saveError(id, dto);
  }

  @Get('errors')
  getErrors(@Req() req: Request) {
    const { id } = req.user as { id: string };
    return this.errorsService.getErrors(id);
  }

  @Post('errors/:id/check')
  checkError(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) errorId: string,
    @Body() dto: CheckErrorDto,
  ) {
    const { id } = req.user as { id: string };
    return this.errorsService.checkError(id, errorId, dto.sentence);
  }

  @Put('errors/:id/resolve')
  resolveError(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) errorId: string,
  ) {
    const { id } = req.user as { id: string };
    return this.errorsService.resolveError(id, errorId);
  }
}
