import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'OneYield Backend',
      chainAdapter: process.env.CHAIN_ADAPTER || 'stub',
      demoMode: process.env.DEMO_MODE === 'true',
    };
  }
}
