import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SpendBufferService } from './spend-buffer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('spend')
export class SpendBufferController {
  constructor(private readonly spendBufferService: SpendBufferService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(@Req() req: any) {
    return this.spendBufferService.getBalance(req.user.sub);
  }

  @Post('qr-pay')
  @UseGuards(JwtAuthGuard)
  qrPay(@Req() req: any, @Body() body: { recipientAddress: string; amount: string; note?: string }) {
    return this.spendBufferService.settleQRPay(req.user.sub, req.user.address, body.recipientAddress, body.amount, body.note);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Req() req: any) {
    return this.spendBufferService.getSpendHistory(req.user.sub);
  }
}
