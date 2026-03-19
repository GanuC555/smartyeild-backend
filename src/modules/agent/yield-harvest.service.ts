import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ed25519Keypair } from '@onelabs/sui/keypairs/ed25519';
import { OneChainService } from '../onechain/onechain.service';

/**
 * YieldHarvestService — replaces simulated DemoYieldService.
 *
 * Every HARVEST_INTERVAL_MS:
 *   1. Ensure admin has LP shares in OneDex (one-time self-healing setup if missing).
 *   2. Inject 5-min worth of LP fees into OneDex fee_pool via simulate_trading_fees.
 *   3. Harvest those fees from OneDex → vault.yield_reserve via lane_router::harvest_dex_yield.
 *
 * After each cycle, vault.yield_reserve holds real on-chain MOCK_USD.
 * YieldCreditService reads vault.yield_reserve and calls spend_buffer::credit_yield per user.
 *
 * Principal protection: vault.reserve is NEVER touched here.
 * Admin provisions their own MOCK_USD (from faucet) as OneDex LP.
 */

const HARVEST_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LP_BASE_LIQUIDITY_USD = 10_000;       // admin provisions 10k USD LP on startup
const LP_TARGET_APY = 0.08;                 // 8% annual → drives per-interval fee injection
const INTERVALS_PER_YEAR =
  (365 * 24 * 60 * 60 * 1000) / HARVEST_INTERVAL_MS;

@Injectable()
export class YieldHarvestService implements OnModuleInit {
  private readonly logger = new Logger(YieldHarvestService.name);
  private lpProvisioned = false;

  constructor(
    private readonly oneChainService: OneChainService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Run once at startup after a brief delay (let the adapter and DB initialise)
    setTimeout(() => this.runHarvestCycle(), 15_000);
    // Repeat every 5 minutes
    setInterval(() => this.runHarvestCycle(), HARVEST_INTERVAL_MS);
    this.logger.log(
      `YieldHarvestService started — ` +
      `interval=${HARVEST_INTERVAL_MS / 60_000}min ` +
      `LP=${LP_BASE_LIQUIDITY_USD} USD ` +
      `APY=${LP_TARGET_APY * 100}%`,
    );
  }

  private async runHarvestCycle() {
    try {
      await this.ensureAdminLpPosition();
      const feeAmount = this.computeFeeSlice();
      await this.injectFees(feeAmount);
      await this.harvest();
    } catch (err) {
      this.logger.error(`[harvest-cycle] Uncaught error: ${err}`);
    }
  }

  /**
   * One-time check: if admin has no LP shares in OneDex, provision base liquidity.
   * Admin MOCK_USD comes from the faucet (mintUsd to admin address).
   */
  private async ensureAdminLpPosition() {
    if (this.lpProvisioned) return;

    const shares = await this.oneChainService.getAdminDexLpShares();
    if (shares > 0n) {
      this.logger.log(`[harvest] Admin LP shares confirmed on-chain: ${shares.toString()}`);
      this.lpProvisioned = true;
      return;
    }

    this.logger.log(
      `[harvest] Admin has no LP shares — provisioning ${LP_BASE_LIQUIDITY_USD} USD to OneDex`,
    );

    // Derive admin address from private key to mint MOCK_USD to admin wallet
    const adminAddress = this.getAdminAddress();
    if (!adminAddress) {
      this.logger.error(
        `[harvest] Cannot derive admin address — check ADMIN_PRIVATE_KEY env var`,
      );
      return;
    }

    // Top up admin wallet with MOCK_USD via faucet (100 USD per mint)
    // LP_BASE_LIQUIDITY_USD may exceed 100 USD — we mint once and use what we have
    const mintResult = await this.oneChainService.mintUsd(adminAddress);
    if (!mintResult.success) {
      this.logger.warn(
        `[harvest] mintUsd to admin failed: ${mintResult.message} — attempting addDexLiquidity anyway`,
      );
    } else {
      this.logger.log(`[harvest] Minted 100 USD to admin — digest: ${mintResult.digest}`);
      // Brief wait for the mint tx to land before spending the coin
      await new Promise((r) => setTimeout(r, 5_000));
    }

    // Add whatever MOCK_USD the admin now has as LP (up to LP_BASE_LIQUIDITY_USD)
    // If admin has less than 10k USD (e.g. just minted 100), we add what we can
    const addResult = await this.oneChainService.addDexLiquidity(
      Math.min(LP_BASE_LIQUIDITY_USD, 100),
    );
    if (addResult.success) {
      this.logger.log(`[harvest] OneDex LP provisioned — digest: ${addResult.digest}`);
      this.lpProvisioned = true;
    } else {
      this.logger.error(`[harvest] addDexLiquidity failed: ${addResult.message}`);
      // Will retry on next cycle
    }
  }

  /**
   * Compute how many USD of fees to inject for one 5-min interval.
   * formula: LP_BASE_LIQUIDITY_USD × LP_TARGET_APY / INTERVALS_PER_YEAR
   */
  private computeFeeSlice(): number {
    const slice = (LP_BASE_LIQUIDITY_USD * LP_TARGET_APY) / INTERVALS_PER_YEAR;
    // Minimum 0.001 USD per interval to stay above credit threshold
    return Math.max(slice, 0.001);
  }

  private async injectFees(amountUsd: number) {
    this.logger.log(`[harvest] Injecting ${amountUsd.toFixed(6)} USD fees into OneDex fee_pool`);
    const result = await this.oneChainService.simulateTradingFees(amountUsd);
    if (!result.success) {
      this.logger.warn(`[harvest] simulateTradingFees failed: ${result.message}`);
    } else {
      this.logger.log(`[harvest] Fee injection SUCCESS — digest: ${result.digest}`);
    }
  }

  private async harvest() {
    this.logger.log(`[harvest] Calling harvest_dex_yield → vault.yield_reserve`);
    const result = await this.oneChainService.harvestDexYield();
    if (!result.success) {
      // claim_fees fails if fee_pool is 0 (race condition on first run before fees land).
      // Non-fatal — next cycle will succeed once the simulate_trading_fees tx has confirmed.
      this.logger.warn(
        `[harvest] harvestDexYield failed (non-fatal on first run): ${result.message}`,
      );
    } else {
      this.logger.log(`[harvest] Harvest SUCCESS — digest: ${result.digest}`);
    }
  }

  private getAdminAddress(): string | null {
    try {
      const pk = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
      if (!pk) return null;
      const keypair = Ed25519Keypair.fromSecretKey(pk);
      return keypair.getPublicKey().toSuiAddress();
    } catch {
      return null;
    }
  }
}
