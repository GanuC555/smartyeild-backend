import { Controller, Get, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/schemas/user.schema';

@Controller('telegram')
export class TelegramController {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /** GET /telegram/link-status — is this user's account linked to Telegram? */
  @Get('link-status')
  @UseGuards(JwtAuthGuard)
  async linkStatus(@Req() req: any) {
    const user = await this.userModel.findById(req.user.sub).lean();
    return {
      linked: !!user?.telegramLinked,
      username: user?.telegramUsername ?? undefined,
    };
  }

  /**
   * POST /telegram/link — called from the web app to manually link by platformId.
   * This is the mirror of the bot's /link command.
   */
  @Post('link')
  @UseGuards(JwtAuthGuard)
  async link(@Body('platformId') platformId: string, @Req() req: any) {
    if (!platformId) {
      return { success: false, message: 'platformId is required' };
    }
    const target = await this.userModel.findOne({ platformId: platformId.toUpperCase() });
    if (!target) {
      return { success: false, message: 'Platform ID not found' };
    }
    // Only allow linking your own account
    if (target._id.toString() !== req.user.sub) {
      return { success: false, message: 'Platform ID does not match your account' };
    }
    return {
      success: true,
      message: 'Use /link ' + platformId + ' in the Telegram bot to complete linking.',
    };
  }

  /** DELETE /telegram/link — unlink Telegram from this account */
  @Delete('link')
  @UseGuards(JwtAuthGuard)
  async unlink(@Req() req: any) {
    await this.userModel.findByIdAndUpdate(req.user.sub, {
      $unset: { telegramId: '', telegramUsername: '' },
      $set: { telegramLinked: false },
    });
    return { success: true, message: 'Telegram unlinked' };
  }
}
