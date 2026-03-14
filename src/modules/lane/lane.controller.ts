import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { LaneService } from './lane.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('lanes')
export class LaneController {
  constructor(private readonly laneService: LaneService) {}

  @Get()
  getLanes() {
    return this.laneService.getLaneDefinitions();
  }

  @Get('my-allocation')
  @UseGuards(JwtAuthGuard)
  getMyAllocation(@Req() req: any) {
    return this.laneService.getUserAllocation(req.user.sub);
  }

  @Post('allocate')
  @UseGuards(JwtAuthGuard)
  setAllocation(@Req() req: any, @Body() body: { lane1Bps: number; lane2Bps: number; lane3Bps: number }) {
    return this.laneService.setUserAllocation(req.user.sub, req.user.address, body.lane1Bps, body.lane2Bps, body.lane3Bps);
  }

  @Get(':lane/decisions')
  getDecisions(@Param('lane') lane: string) {
    return this.laneService.getLaneDecisions(lane);
  }
}
