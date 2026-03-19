import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiClient, getFullnodeUrl } from '@onelabs/sui/client';
import { Ed25519Keypair } from '@onelabs/sui/keypairs/ed25519';
import {
  IOneChainAdapter,
  SpendBalance,
  VaultPosition,
} from './IOneChainAdapter';

@Injectable()
export class OneChainAdapterService implements IOneChainAdapter, OnModuleInit {
  private readonly logger = new Logger(OneChainAdapterService.name);
  private client: SuiClient;
  private packageId: string;
  private vaultObjectId: string;
  private spendBufferObjectId: string;
  private onedexObjectId: string;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const rpcUrl =
      this.config.get<string>('ONECHAIN_RPC_URL') ??
      'https://rpc-testnet.onelabs.cc';
    this.packageId = this.config.get<string>('ONECHAIN_PACKAGE_ID') ?? '';
    this.vaultObjectId = this.config.get<string>('ONECHAIN_VAULT_OBJECT_ID') ?? '';
    this.spendBufferObjectId =
      this.config.get<string>('ONECHAIN_SPEND_BUFFER_OBJECT_ID') ?? '';
    this.onedexObjectId =
      this.config.get<string>('ONECHAIN_ONEDEX_OBJECT_ID') ?? '';

    this.client = new SuiClient({ url: rpcUrl });
    this.logger.log(`OneChainAdapter initialised — RPC: ${rpcUrl}`);
  }

  getPackageId(): string {
    return this.packageId;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.getLatestCheckpointSequenceNumber();
      return true;
    } catch {
      return false;
    }
  }

  async getSpendBalance(userAddress: string): Promise<SpendBalance> {
    if (!this.spendBufferObjectId) {
      return { yieldBalance: 0n, advanceBalance: 0n };
    }
    try {
      const obj = await this.client.getObject({
        id: this.spendBufferObjectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      if (!fields) return { yieldBalance: 0n, advanceBalance: 0n };

      // SpendBuffer has a Table<address, UserBalance> — query the dynamic field
      const tableId = fields.balances?.fields?.id?.id;
      if (!tableId) return { yieldBalance: 0n, advanceBalance: 0n };

      const dynField = await this.client.getDynamicFieldObject({
        parentId: tableId,
        name: { type: 'address', value: userAddress },
      });
      const balFields = (dynField.data?.content as any)?.fields?.value?.fields;
      if (!balFields) return { yieldBalance: 0n, advanceBalance: 0n };

      return {
        yieldBalance: BigInt(balFields.yield_balance ?? 0),
        advanceBalance: BigInt(balFields.advance_balance ?? 0),
      };
    } catch (err) {
      this.logger.warn(`getSpendBalance failed for ${userAddress}: ${err}`);
      return { yieldBalance: 0n, advanceBalance: 0n };
    }
  }

  async getVaultPosition(userAddress: string): Promise<VaultPosition | null> {
    if (!this.vaultObjectId) return null;
    try {
      const obj = await this.client.getObject({
        id: this.vaultObjectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      if (!fields) return null;

      const tableId = fields.positions?.fields?.id?.id;
      if (!tableId) return null;

      const dynField = await this.client.getDynamicFieldObject({
        parentId: tableId,
        name: { type: 'address', value: userAddress },
      });
      const posFields = (dynField.data?.content as any)?.fields?.value?.fields;
      if (!posFields) return null;

      return {
        depositAmount: BigInt(posFields.deposit_amount ?? 0),
        seniorBps: Number(posFields.senior_bps ?? 0),
        juniorBps: Number(posFields.junior_bps ?? 0),
        maturityMs: Number(posFields.maturity_ms ?? 0),
        advanceAmount: BigInt(posFields.advance_amount ?? 0),
        frtMinted: BigInt(posFields.frt_minted ?? 0),
        ystMinted: BigInt(posFields.yst_minted ?? 0),
        depositedAtMs: Number(posFields.deposited_at_ms ?? 0),
      };
    } catch {
      return null;
    }
  }

  async getTotalDeposits(): Promise<bigint> {
    if (!this.vaultObjectId) return 0n;
    try {
      const obj = await this.client.getObject({
        id: this.vaultObjectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      return BigInt(fields?.total_deposits ?? 0);
    } catch {
      return 0n;
    }
  }

  async getVaultYieldReserve(): Promise<bigint> {
    if (!this.vaultObjectId) return 0n;
    try {
      const obj = await this.client.getObject({
        id: this.vaultObjectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      // yield_reserve is a Balance<MOCK_USD> stored as { fields: { value: "..." } }
      const raw = fields?.yield_reserve?.fields?.value ?? '0';
      return BigInt(raw);
    } catch (err) {
      this.logger.warn(`getVaultYieldReserve failed: ${err}`);
      return 0n;
    }
  }

  async getUserYstBalance(userAddress: string): Promise<bigint> {
    try {
      if (!this.packageId) return 0n;
      const coinType = `${this.packageId}::yst::YST`;
      const bal = await this.client.getBalance({ owner: userAddress, coinType });
      return BigInt(bal.totalBalance ?? 0);
    } catch (err) {
      this.logger.warn(`getUserYstBalance failed for ${userAddress}: ${err}`);
      return 0n;
    }
  }

  async getAdminDexLpShares(): Promise<bigint> {
    if (!this.onedexObjectId) return 0n;
    try {
      const privateKeyB64 = this.config.get<string>('ADMIN_PRIVATE_KEY') ?? '';
      if (!privateKeyB64) return 0n;

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyB64);
      const adminAddress = keypair.getPublicKey().toSuiAddress();

      const obj = await this.client.getObject({
        id: this.onedexObjectId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      const tableId = fields?.lp_positions?.fields?.id?.id;
      if (!tableId) return 0n;

      const dynField = await this.client.getDynamicFieldObject({
        parentId: tableId,
        name: { type: 'address', value: adminAddress },
      });
      const val = (dynField.data?.content as any)?.fields?.value;
      return BigInt(val ?? 0);
    } catch {
      // 0n means no LP position exists yet — not an error
      return 0n;
    }
  }
}
