import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PhrasesService } from './phrases.service';
import { CreatePhraseDto } from './dto/create-phrase.dto';
import { UpdatePhraseDto } from './dto/update-phrase.dto';

@Controller('phrases')
@UseGuards(JwtAuthGuard) // all phrase routes require a valid session
export class PhrasesController {
  constructor(private readonly phrasesService: PhrasesService) {}

  // GET /phrases
  @Get()
  findAll(@Req() req: Request) {
    const { id } = req.user as { id: string };
    return this.phrasesService.findAll(id);
  }

  // POST /phrases → 201; AI fills explanation + 1 example
  @Post()
  create(@Req() req: Request, @Body() dto: CreatePhraseDto) {
    const { id } = req.user as { id: string };
    return this.phrasesService.create(id, dto);
  }

  // POST /phrases/:id/generate — regenerates explanation + adds 1 example
  @Post(':id/generate')
  generate(@Req() req: Request, @Param('id', ParseUUIDPipe) phraseId: string) {
    const { id } = req.user as { id: string };
    return this.phrasesService.generateDetails(phraseId, id);
  }

  // GET /phrases/:id/sentences — returns saved examples for the phrase
  @Get(':id/sentences')
  async getSentences(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) phraseId: string,
  ) {
    const { id } = req.user as { id: string };
    const sentences = await this.phrasesService.getSentences(phraseId, id);
    return { sentences };
  }

  // POST /phrases/:id/sentences — generates 1 new example and saves it
  @Post(':id/sentences')
  async generateSentence(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) phraseId: string,
  ) {
    const { id } = req.user as { id: string };
    const sentences = await this.phrasesService.generateSentence(phraseId, id);
    return { sentences };
  }

  // GET /phrases/:id
  @Get(':id')
  findOne(@Req() req: Request, @Param('id', ParseUUIDPipe) phraseId: string) {
    const { id } = req.user as { id: string };
    return this.phrasesService.findOne(phraseId, id);
  }

  // PATCH /phrases/:id
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) phraseId: string,
    @Body() dto: UpdatePhraseDto,
  ) {
    const { id } = req.user as { id: string };
    return this.phrasesService.update(phraseId, id, dto);
  }

  // DELETE /phrases/:id → 200
  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) phraseId: string,
  ) {
    const { id } = req.user as { id: string };
    await this.phrasesService.remove(phraseId, id);
    return { ok: true };
  }
}
