import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('nonce')
  getNonce(@Body('address') address: string) {
    if (!address) throw new Error('address is required');
    return { nonce: this.authService.generateNonce(address) };
  }

  @Post('verify')
  verify(@Body() body: { address: string; signature: string }) {
    return this.authService.verify(body.address, body.signature);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Delete('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Body('refreshToken') refreshToken: string, @Req() req: any) {
    return this.authService.logout(refreshToken, req.user.sub);
  }

  /** POST /auth/telegram-mini-app — silent auth for Telegram Mini App WebView */
  @Post('telegram-mini-app')
  miniAppAuth(@Body('initData') initData: string) {
    if (!initData) throw new Error('initData is required');
    return this.authService.miniAppAuth(initData);
  }
}
