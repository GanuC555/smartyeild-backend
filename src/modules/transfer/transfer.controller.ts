import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('transfer')
export class TransferController {
  constructor(private transferService: TransferService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(@Req() req: any) {
    return this.transferService.getSpendableBalance(req.user.sub);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  send(
    @Body() body: { toAddress: string; amount: string; note?: string },
    @Req() req: any,
  ) {
    return this.transferService.sendP2P(
      req.user.sub,
      body.toAddress,
      body.amount,
      body.note,
    );
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Req() req: any) {
    return this.transferService.getHistory(req.user.sub);
  }
}
