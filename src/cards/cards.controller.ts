import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CardsService } from './cards.service';
import { AutofillService } from './autofill.service';
import { CardSentencesService } from './card-sentences.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@Controller('cards')
@UseGuards(JwtAuthGuard) // all card routes require a valid session
export class CardsController {
  constructor(
    private readonly cardsService: CardsService,
    private readonly autofillService: AutofillService,
    private readonly cardSentencesService: CardSentencesService,
  ) {}

  // GET /cards/autofill?word=frigid
  @Get('autofill')
  autofill(@Query('word') word: string) {
    return this.autofillService.autofill(word ?? '');
  }

  // GET /cards
  @Get()
  findAll(@Req() req: Request) {
    const { id } = req.user as { id: string };
    return this.cardsService.findAll(id);
  }

  // POST /cards → 201
  @Post()
  create(@Req() req: Request, @Body() dto: CreateCardDto) {
    const { id } = req.user as { id: string };
    return this.cardsService.create(id, dto);
  }

  // GET /cards/:id/sentences — returns saved sentences for the card
  @Get(':id/sentences')
  async getSentences(@Req() req: Request, @Param('id') cardId: string) {
    const { id } = req.user as { id: string };
    await this.cardsService.findCard(cardId, id);
    const sentences = await this.cardSentencesService.findByCard(cardId, id);
    return { sentences };
  }

  // POST /cards/:id/sentences — generates 2 new sentences and saves them
  @Post(':id/sentences')
  async generateSentences(@Req() req: Request, @Param('id') cardId: string) {
    const { id } = req.user as { id: string };
    const card = await this.cardsService.findCard(cardId, id);
    const sentences = await this.cardSentencesService.generateSentences(
      card,
      id,
    );
    return { sentences };
  }

  // GET /cards/:id
  @Get(':id')
  findOne(@Req() req: Request, @Param('id') cardId: string) {
    const { id } = req.user as { id: string };
    return this.cardsService.findOne(cardId, id);
  }

  // PATCH /cards/:id
  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') cardId: string,
    @Body() dto: UpdateCardDto,
  ) {
    const { id } = req.user as { id: string };
    return this.cardsService.update(cardId, id, dto);
  }

  // DELETE /cards/:id → 200
  @Delete(':id')
  @HttpCode(200)
  async remove(@Req() req: Request, @Param('id') cardId: string) {
    const { id } = req.user as { id: string };
    await this.cardsService.remove(cardId, id);
    return { ok: true };
  }
}
