import { Module } from '@nestjs/common';
import { MockStrataAdapterService } from '../../adapters/strata/MockStrataAdapterService';
import { StubPendleAdapter } from '../../adapters/pendle/StubPendleAdapter';
import { StubMorphoAdapter } from '../../adapters/morpho/StubMorphoAdapter';
import { MockPriceOracle } from '../../adapters/oracle/MockPriceOracle';
import { StrataService } from './strata.service';
import { PendleService } from './pendle.service';
import { MorphoService } from './morpho.service';
import { OracleService } from './oracle.service';

@Module({
  providers: [
    MockStrataAdapterService, StubPendleAdapter, StubMorphoAdapter, MockPriceOracle,
    StrataService, PendleService, MorphoService, OracleService,
  ],
  exports: [StrataService, PendleService, MorphoService, OracleService],
})
export class ProtocolModule {}
