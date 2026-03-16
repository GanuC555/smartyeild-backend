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
}
