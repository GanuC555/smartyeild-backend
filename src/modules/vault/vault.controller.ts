import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VaultService } from './vault.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('vaults')
export class VaultController {
  constructor(private vaultService: VaultService) {}

  @Get()
  getVaults() {
    return this.vaultService.getVaults();
  }

  @Get(':id')
  getVault(@Param('id') id: string) {
    return this.vaultService.getVault(id);
  }

  @Post(':id/preview-deposit')
  previewDeposit(@Body('amount') amount: string) {
    return this.vaultService.previewDeposit(amount);
  }

  @Post(':id/preview-withdraw')
  previewWithdraw(@Body('shares') shares: string) {
    return this.vaultService.previewWithdraw(shares);
  }

  @Post(':id/deposit')
  @UseGuards(JwtAuthGuard)
  submitDeposit(
    @Body() body: { txHash: string; amount: string },
    @Req() req: any,
  ) {
    return this.vaultService.submitDeposit(
      req.user.sub,
      req.user.address,
      body.txHash,
      body.amount,
    );
  }

  /** Demo only: instantly confirm a deposit without a real tx */
  @Post(':id/demo-confirm')
  @UseGuards(JwtAuthGuard)
  demoConfirm(@Body('amount') amount: string, @Req() req: any) {
    return this.vaultService.confirmDeposit(
      req.user.sub,
      req.user.address,
      amount,
      `0xdemo_${Date.now()}`,
    );
  }

  @Get(':id/positions')
  @UseGuards(JwtAuthGuard)
  getPositions(@Req() req: any) {
    return this.vaultService.getUserPositions(req.user.sub);
  }
}
