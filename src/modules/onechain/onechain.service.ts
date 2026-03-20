import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClient } from '@onelabs/sui/client';
import { Transaction } from '@onelabs/sui/transactions';
import { Ed25519Keypair } from '@onelabs/sui/keypairs/ed25519';
import { OneChainAdapterService } from '../../adapters/onechain/OneChainAdapterService';
import { SpendBalance, VaultPosition } from '../../adapters/onechain/IOneChainAdapter';

const FAUCET_AMOUNT_USD = 100_000_000; // 100 USD in base units (6 decimals)
const MOCK_USD_DECIMALS = 1_000_000;   // 6 decimals

@Injectable()
export class OneChainService {
  private readonly logger = new Logger(OneChainService.name);

  constructor(
    private readonly adapter: OneChainAdapterService,
    private readonly config: ConfigService,
  ) {}

  async isOnline(): Promise<boolean> {
    return this.adapter.ping();
  }

  async getSpendBalance(userAddress: string): Promise<SpendBalance> {
    return this.adapter.getSpendBalance(userAddress);
  }

  async getVaultPosition(userAddress: string): Promise<VaultPosition | null> {
    return this.adapter.getVaultPosition(userAddress);
  }

  async getTotalDeposits(): Promise<bigint> {
    return this.adapter.getTotalDeposits();
  }

  getPackageId(): string {
    return this.adapter.getPackageId();
  }

  async getVaultYieldReserve(): Promise<bigint> {
    return this.adapter.getVaultYieldReserve();
  }

  async getUserYstBalance(userAddress: string): Promise<bigint> {
    return this.adapter.getUserYstBalance(userAddress);
  }

  async getAdminDexLpShares(): Promise<bigint> {
    return this.adapter.getAdminDexLpShares();
  }

  /** Get OCT coin balance for an address (for gas display) */
  async getOctBalance(address: string): Promise<{ balance: string; balanceOct: string }> {
    try {
      const client = (this.adapter as any).client as SuiClient;
      const balance = await client.getBalance({ owner: address, coinType: '0x2::oct::OCT' });
      const raw = BigInt(balance.totalBalance ?? 0);
      const oct = (Number(raw) / 1_000_000_000).toFixed(4);
      return { balance: raw.toString(), balanceOct: oct };
    } catch (err) {
      this.logger.warn(`getOctBalance failed for ${address}: ${err}`);
      return { balance: '0', balanceOct: '0' };
    }
  }

  /** Get MOCK_USD balance for an address */
  async getUsdBalance(address: string): Promise<{ balance: string; balanceUsd: string }> {
    try {
      const client = (this.adapter as any).client as SuiClient;
      const packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
      const coinType = `${packageId}::mock_usd::MOCK_USD`;
      const balance = await client.getBalance({ owner: address, coinType });
      const raw = BigInt(balance.totalBalance ?? 0);
      const usd = (Number(raw) / 1_000_000).toFixed(2);
      return { balance: raw.toString(), balanceUsd: usd };
    } catch (err) {
      this.logger.warn(`getUsdBalance failed for ${address}: ${err}`);
      return { balance: '0', balanceUsd: '0' };
    }
  }

  /**
   * Mint MOCK_USD to a recipient using the admin TreasuryCap.
   * Requires ADMIN_PRIVATE_KEY and USD_TREASURY_CAP_ID in env.
   * Default: 100 USD (100_000_000 base units, 6 decimals).
   */
  async mintUsd(recipient: string): Promise<{ success: boolean; digest?: string; message: string }> {
    try {
      const privateKeyB64 = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
      const treasuryCapId = this.config.get<string>('USD_TREASURY_CAP_ID') ?? '';
      const packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
      const rpcUrl = this.config.get<string>('ONECHAIN_RPC_URL') ?? 'https://rpc-testnet.onelabs.cc';

      if (!privateKeyB64 || !treasuryCapId || !packageId) {
        return { success: false, message: 'Faucet not configured (ADMIN_PRIVATE_KEY or USD_TREASURY_CAP_ID missing)' };
      }

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyB64);
      const client = new SuiClient({ url: rpcUrl });

      const tx = new Transaction();
      tx.setGasBudget(20_000_000);
      tx.moveCall({
        target: `${packageId}::mock_usd::faucet_mint`,
        arguments: [
          tx.object(treasuryCapId),
          tx.pure.address(recipient),
          tx.pure.u64(FAUCET_AMOUNT_USD),
        ],
      });

      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true },
      });

      if (result.effects?.status?.status !== 'success') {
        const err = result.effects?.status?.error ?? 'Unknown error';
        this.logger.error(`mintUsd failed: ${err}`);
        return { success: false, message: `Mint failed: ${err}` };
      }

      this.logger.log(`Minted 100 USD to ${recipient} — digest: ${result.digest}`);
      return {
        success: true,
        digest: result.digest,
        message: '100 USD sent — check your balance in ~30 seconds',
      };
    } catch (err) {
      this.logger.error(`mintUsd error: ${err}`);
      return { success: false, message: `Faucet error: ${String(err)}` };
    }
  }

  /**
   * Credit advance to a user's SpendBuffer after vault deposit.
   * Called by the backend (admin) after deposit confirmation.
   * amountUsd: whole USD amount to credit (e.g. 7.0 for 70% of 10 USD deposit).
   */
  async creditAdvance(userAddress: string, amountUsd: number): Promise<{ success: boolean; digest?: string; message: string }> {
    try {
      const privateKeyB64 = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
      const spendBufferId = this.config.get<string>('ONECHAIN_SPEND_BUFFER_OBJECT_ID') ?? '';
      const packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
      const rpcUrl = this.config.get<string>('ONECHAIN_RPC_URL') ?? 'https://rpc-testnet.onelabs.cc';

      if (!privateKeyB64 || !spendBufferId || !packageId) {
        return { success: false, message: 'creditAdvance not configured (ADMIN_PRIVATE_KEY, ONECHAIN_SPEND_BUFFER_OBJECT_ID, or ONECHAIN_PACKAGE_ID missing)' };
      }

      const amountBaseUnits = Math.round(amountUsd * MOCK_USD_DECIMALS);
      const keypair = Ed25519Keypair.fromSecretKey(privateKeyB64);
      const client = new SuiClient({ url: rpcUrl });
      const adminAddress = keypair.getPublicKey().toSuiAddress();
      const coinType = `${packageId}::mock_usd::MOCK_USD`;

      // Fetch all admin MOCK_USD coins
      const coinsResult = await client.getCoins({ owner: adminAddress, coinType });
      const coins = coinsResult.data;
      if (!coins || coins.length === 0) {
        return { success: false, message: 'Admin has no MOCK_USD coins to credit advance' };
      }

      const tx = new Transaction();
      tx.setGasBudget(20_000_000);

      let paymentCoin: any;
      if (coins.length === 1) {
        // Split the exact amount from the single coin
        [paymentCoin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [tx.pure.u64(amountBaseUnits)]);
      } else {
        // Merge all into first, then split
        const primary = tx.object(coins[0].coinObjectId);
        tx.mergeCoins(primary, coins.slice(1).map((c) => tx.object(c.coinObjectId)));
        [paymentCoin] = tx.splitCoins(primary, [tx.pure.u64(amountBaseUnits)]);
      }

      tx.moveCall({
        target: `${packageId}::spend_buffer::credit_advance`,
        arguments: [
          tx.object(spendBufferId),
          tx.pure.address(userAddress),
          tx.pure.u64(amountBaseUnits),
          paymentCoin,
        ],
      });

      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true },
      });

      if (result.effects?.status?.status !== 'success') {
        const err = result.effects?.status?.error ?? 'Unknown error';
        this.logger.error(`creditAdvance failed: ${err}`);
        return { success: false, message: `creditAdvance failed: ${err}` };
      }

      this.logger.log(`creditAdvance: ${amountUsd} USD → ${userAddress} — digest: ${result.digest}`);
      return { success: true, digest: result.digest, message: `Advance of ${amountUsd} USD credited on-chain` };
    } catch (err) {
      this.logger.error(`creditAdvance error: ${err}`);
      return { success: false, message: `creditAdvance error: ${String(err)}` };
    }
  }

  /**
   * Credit yield earnings to a user's SpendBuffer on-chain.
   * Called periodically by YieldCreditService whenever new yield has accrued.
   * amountUsd: the incremental yield delta (e.g. 0.00814 for one day of yield).
   */
  async creditYield(userAddress: string, amountUsd: number): Promise<{ success: boolean; digest?: string; message: string }> {
    try {
      const privateKeyB64 = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
      const spendBufferId = this.config.get<string>('ONECHAIN_SPEND_BUFFER_OBJECT_ID') ?? '';
      const packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
      const rpcUrl = this.config.get<string>('ONECHAIN_RPC_URL') ?? 'https://rpc-testnet.onelabs.cc';

      if (!privateKeyB64 || !spendBufferId || !packageId) {
        return { success: false, message: 'creditYield not configured (ADMIN_PRIVATE_KEY, ONECHAIN_SPEND_BUFFER_OBJECT_ID, or ONECHAIN_PACKAGE_ID missing)' };
      }

      const amountBaseUnits = Math.round(amountUsd * MOCK_USD_DECIMALS);
      if (amountBaseUnits <= 0) {
        return { success: false, message: 'creditYield: amount rounds to zero base units' };
      }

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyB64);
      const client = new SuiClient({ url: rpcUrl });
      const adminAddress = keypair.getPublicKey().toSuiAddress();
      const coinType = `${packageId}::mock_usd::MOCK_USD`;

      const coinsResult = await client.getCoins({ owner: adminAddress, coinType });
      const coins = coinsResult.data;
      if (!coins || coins.length === 0) {
        return { success: false, message: 'Admin has no MOCK_USD coins to credit yield' };
      }

      const tx = new Transaction();
      tx.setGasBudget(20_000_000);

      let paymentCoin: any;
      if (coins.length === 1) {
        [paymentCoin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [tx.pure.u64(amountBaseUnits)]);
      } else {
        const primary = tx.object(coins[0].coinObjectId);
        tx.mergeCoins(primary, coins.slice(1).map((c) => tx.object(c.coinObjectId)));
        [paymentCoin] = tx.splitCoins(primary, [tx.pure.u64(amountBaseUnits)]);
      }

      tx.moveCall({
        target: `${packageId}::spend_buffer::credit_yield`,
        arguments: [
          tx.object(spendBufferId),
          tx.pure.address(userAddress),
          tx.pure.u64(amountBaseUnits),
          paymentCoin,
        ],
      });

      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true },
      });

      if (result.effects?.status?.status !== 'success') {
        const err = result.effects?.status?.error ?? 'Unknown error';
        this.logger.error(`creditYield failed: ${err}`);
        return { success: false, message: `creditYield failed: ${err}` };
      }

      this.logger.log(`creditYield: ${amountUsd} USD → ${userAddress} — digest: ${result.digest}`);
      return { success: true, digest: result.digest, message: `Yield of ${amountUsd} USD credited on-chain` };
    } catch (err) {
      this.logger.error(`creditYield error: ${err}`);
      return { success: false, message: `creditYield error: ${String(err)}` };
    }
  }

  /**
   * Admin adds MOCK_USD to OneDex as an LP provider.
   * Gives admin LP shares so harvest_dex_yield can claim fees.
   * Called once on startup when admin has no LP position.
   * vault.reserve is NOT touched — admin funds their own LP from faucet-minted MOCK_USD.
   */
  async addDexLiquidity(amountUsd: number): Promise<{ success: boolean; digest?: string; message: string }> {
    try {
      const privateKeyB64 = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
      const onedexId = this.config.get<string>('ONECHAIN_ONEDEX_OBJECT_ID') ?? '';
      const packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
      const rpcUrl = this.config.get<string>('ONECHAIN_RPC_URL') ?? 'https://rpc-testnet.onelabs.cc';

      if (!privateKeyB64 || !onedexId || !packageId) {
        return { success: false, message: 'addDexLiquidity: missing env config (ADMIN_PRIVATE_KEY / ONECHAIN_ONEDEX_OBJECT_ID / ONECHAIN_PACKAGE_ID)' };
      }

      const amountBaseUnits = Math.round(amountUsd * MOCK_USD_DECIMALS);
      const keypair = Ed25519Keypair.fromSecretKey(privateKeyB64);
      const client = new SuiClient({ url: rpcUrl });
      const adminAddress = keypair.getPublicKey().toSuiAddress();
      const coinType = `${packageId}::mock_usd::MOCK_USD`;

      const coinsResult = await client.getCoins({ owner: adminAddress, coinType });
      const coins = coinsResult.data;
      if (!coins || coins.length === 0) {
        return { success: false, message: 'addDexLiquidity: admin has no MOCK_USD — run faucet first' };
      }

      const tx = new Transaction();
      tx.setGasBudget(20_000_000);

      let paymentCoin: any;
      if (coins.length === 1) {
        [paymentCoin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [tx.pure.u64(amountBaseUnits)]);
      } else {
        const primary = tx.object(coins[0].coinObjectId);
        tx.mergeCoins(primary, coins.slice(1).map((c) => tx.object(c.coinObjectId)));
        [paymentCoin] = tx.splitCoins(primary, [tx.pure.u64(amountBaseUnits)]);
      }

      tx.moveCall({
        target: `${packageId}::mock_onedex::add_liquidity_entry`,
        arguments: [tx.object(onedexId), paymentCoin],
      });

      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true },
      });

      if (result.effects?.status?.status !== 'success') {
        const err = result.effects?.status?.error ?? 'Unknown error';
        this.logger.error(`addDexLiquidity failed: ${err}`);
        return { success: false, message: `addDexLiquidity failed: ${err}` };
      }

      this.logger.log(`addDexLiquidity: added ${amountUsd} USD to OneDex LP — digest: ${result.digest}`);
      return { success: true, digest: result.digest, message: `Added ${amountUsd} USD as OneDex LP` };
    } catch (err) {
      this.logger.error(`addDexLiquidity error: ${err}`);
      return { success: false, message: `addDexLiquidity error: ${String(err)}` };
    }
  }

  /**
   * Admin injects MOCK_USD into OneDex fee_pool to simulate a period's worth of LP fees.
   * amountUsd = computed by caller (APY × time × LP value).
   */
  async simulateTradingFees(amountUsd: number): Promise<{ success: boolean; digest?: string; message: string }> {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const privateKeyB64 = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
        const onedexId = this.config.get<string>('ONECHAIN_ONEDEX_OBJECT_ID') ?? '';
        const dexAdminCapId = this.config.get<string>('DEX_ADMIN_CAP_ID') ?? '';
        const packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
        const rpcUrl = this.config.get<string>('ONECHAIN_RPC_URL') ?? 'https://rpc-testnet.onelabs.cc';

        if (!privateKeyB64 || !onedexId || !dexAdminCapId || !packageId) {
          return { success: false, message: 'simulateTradingFees: missing env config' };
        }

        const amountBaseUnits = Math.round(amountUsd * MOCK_USD_DECIMALS);
        if (amountBaseUnits <= 0) {
          return { success: false, message: 'simulateTradingFees: amount rounds to zero — skipping' };
        }

        const keypair = Ed25519Keypair.fromSecretKey(privateKeyB64);
        const client = new SuiClient({ url: rpcUrl });
        const adminAddress = keypair.getPublicKey().toSuiAddress();
        const coinType = `${packageId}::mock_usd::MOCK_USD`;

        // Fresh coin fetch on every attempt — avoids stale object version from concurrent txs
        const coinsResult = await client.getCoins({ owner: adminAddress, coinType });
        const coins = coinsResult.data;
        if (!coins || coins.length === 0) {
          return { success: false, message: 'simulateTradingFees: admin has no MOCK_USD' };
        }

        const tx = new Transaction();
        tx.setGasBudget(20_000_000);

        let feesCoin: any;
        if (coins.length === 1) {
          [feesCoin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [tx.pure.u64(amountBaseUnits)]);
        } else {
          const primary = tx.object(coins[0].coinObjectId);
          tx.mergeCoins(primary, coins.slice(1).map((c) => tx.object(c.coinObjectId)));
          [feesCoin] = tx.splitCoins(primary, [tx.pure.u64(amountBaseUnits)]);
        }

        tx.moveCall({
          target: `${packageId}::mock_onedex::simulate_trading_fees`,
          arguments: [tx.object(onedexId), feesCoin, tx.object(dexAdminCapId)],
        });

        const result = await client.signAndExecuteTransaction({
          transaction: tx,
          signer: keypair,
          options: { showEffects: true },
        });

        if (result.effects?.status?.status !== 'success') {
          const err = result.effects?.status?.error ?? 'Unknown error';
          this.logger.error(`simulateTradingFees failed: ${err}`);
          return { success: false, message: `simulateTradingFees failed: ${err}` };
        }

        this.logger.log(`simulateTradingFees: injected ${amountUsd} USD fees — digest: ${result.digest}`);
        return { success: true, digest: result.digest, message: `Injected ${amountUsd} USD into OneDex fee_pool` };
      } catch (err) {
        const msg = String(err);
        const isStaleObject = msg.includes('not available for consumption') || msg.includes('ObjectVersionUnavailableForConsumption');
        if (isStaleObject && attempt < MAX_RETRIES) {
          this.logger.warn(`simulateTradingFees stale object (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        this.logger.error(`simulateTradingFees error: ${err}`);
        return { success: false, message: `simulateTradingFees error: ${msg}` };
      }
    }
    return { success: false, message: 'simulateTradingFees: all retries exhausted' };
  }

  /**
   * Admin harvests all claimable OneDex fees into vault.yield_reserve via lane_router::harvest_dex_yield.
   * Requires admin to have LP shares in OneDex (call addDexLiquidity first if needed).
   * After this call, vault.yield_reserve holds real on-chain MOCK_USD for YST holders.
   */
  async harvestDexYield(): Promise<{ success: boolean; digest?: string; message: string }> {
    try {
      const privateKeyB64 = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
      const laneRouterId = this.config.get<string>('ONECHAIN_LANE_ROUTER_OBJECT_ID') ?? '';
      const vaultId = this.config.get<string>('ONECHAIN_VAULT_OBJECT_ID') ?? '';
      const vaultAdminCapId = this.config.get<string>('VAULT_ADMIN_CAP_ID') ?? '';
      const onedexId = this.config.get<string>('ONECHAIN_ONEDEX_OBJECT_ID') ?? '';
      const packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
      const rpcUrl = this.config.get<string>('ONECHAIN_RPC_URL') ?? 'https://rpc-testnet.onelabs.cc';

      if (!privateKeyB64 || !laneRouterId || !vaultId || !vaultAdminCapId || !onedexId || !packageId) {
        return { success: false, message: 'harvestDexYield: missing env config' };
      }

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyB64);
      const client = new SuiClient({ url: rpcUrl });

      const tx = new Transaction();
      tx.setGasBudget(20_000_000);

      tx.moveCall({
        target: `${packageId}::lane_router::harvest_dex_yield`,
        arguments: [
          tx.object(laneRouterId),
          tx.object(vaultId),
          tx.object(vaultAdminCapId),
          tx.object(onedexId),
        ],
      });

      const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true },
      });

      if (result.effects?.status?.status !== 'success') {
        const err = result.effects?.status?.error ?? 'Unknown error';
        this.logger.error(`harvestDexYield failed: ${err}`);
        return { success: false, message: `harvestDexYield failed: ${err}` };
      }

      this.logger.log(`harvestDexYield: fees moved to vault.yield_reserve — digest: ${result.digest}`);
      return { success: true, digest: result.digest, message: 'Yield harvested into vault.yield_reserve' };
    } catch (err) {
      this.logger.error(`harvestDexYield error: ${err}`);
      return { success: false, message: `harvestDexYield error: ${String(err)}` };
    }
  }
}
