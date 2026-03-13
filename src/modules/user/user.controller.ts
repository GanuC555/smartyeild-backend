import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.sub);
  }

  @Get('me/portfolio')
  @UseGuards(JwtAuthGuard)
  getPortfolio(@Req() req: any) {
    return this.userService.getPortfolio(req.user.sub);
  }
}
