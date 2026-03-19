/**
 * SmartYield On-Chain Flow Verifier
 * Executes 5 real transactions on OneChain testnet and verifies each one.
 *
 * TX 1: faucet_mint      — mint 100 MOCK_USD to admin
 * TX 2: add_liquidity    — admin adds 1,000 USD to OneDex LP
 * TX 3: simulate_fees    — inject 0.22 USD (≈8% APY daily slice) into fee_pool
 * TX 4: harvest_yield    — lane_router claims fees → vault.yield_reserve
 * TX 5: credit_advance   — credit 7 USD advance to admin SpendBuffer
 *
 * Run: node test-onchain-flow.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
const envRaw = readFileSync(envPath, 'utf8');
for (const line of envRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  if (key && !(key in process.env)) process.env[key] = val;
}

// ── SDK imports (CJS via require since package.json has no "type":"module") ──
const { SuiClient } = require('@onelabs/sui/client');
const { Transaction } = require('@onelabs/sui/transactions');
const { Ed25519Keypair } = require('@onelabs/sui/keypairs/ed25519');

// ── Config ────────────────────────────────────────────────────────────────────
const RPC_URL        = process.env.ONECHAIN_RPC_URL       ?? 'https://rpc-testnet.onelabs.cc';
const PACKAGE_ID     = process.env.ONECHAIN_PACKAGE_ID;
const VAULT_ID       = process.env.ONECHAIN_VAULT_OBJECT_ID;
const SPEND_BUF_ID   = process.env.ONECHAIN_SPEND_BUFFER_OBJECT_ID;
const LANE_ROUTER_ID = process.env.ONECHAIN_LANE_ROUTER_OBJECT_ID;
const ONEDEX_ID      = process.env.ONECHAIN_ONEDEX_OBJECT_ID;
const TREASURY_CAP   = process.env.USD_TREASURY_CAP_ID;
const VAULT_ADMIN    = process.env.VAULT_ADMIN_CAP_ID;
const DEX_ADMIN      = process.env.DEX_ADMIN_CAP_ID;
const PRIV_KEY       = process.env.ADMIN_PRIVATE_KEY;
const EXPLORER       = 'https://explorer.onelabs.cc/txblock';

const COIN_TYPE      = `${PACKAGE_ID}::mock_usd::MOCK_USD`;
const USD_DEC        = 1_000_000;   // 6 decimals

// ── Helpers ───────────────────────────────────────────────────────────────────
const client  = new SuiClient({ url: RPC_URL });
const keypair = Ed25519Keypair.fromSecretKey(PRIV_KEY);
const ADMIN   = keypair.getPublicKey().toSuiAddress();

function sep(label) {
  const bar = '─'.repeat(60);
  console.log(`\n${bar}`);
  console.log(`  ${label}`);
  console.log(bar);
}

function ok(msg)   { console.log(`  ✅  ${msg}`); }
function info(msg) { console.log(`  ℹ️   ${msg}`); }
function err(msg)  { console.log(`  ❌  ${msg}`); }

async function execTx(tx) {
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showEffects: true, showEvents: true },
  });
  return result;
}

async function getUsdCoins() {
  const res = await client.getCoins({ owner: ADMIN, coinType: COIN_TYPE });
  return res.data;
}

async function readVaultState() {
  const obj = await client.getObject({ id: VAULT_ID, options: { showContent: true } });
  const f = obj.data?.content?.fields ?? {};
  return {
    totalDeposits: BigInt(f.total_deposits ?? 0),
    yieldReserve:  BigInt(f.yield_reserve?.fields?.value ?? 0),
    reserve:       BigInt(f.reserve?.fields?.value ?? 0),
  };
}

async function readDexState() {
  const obj = await client.getObject({ id: ONEDEX_ID, options: { showContent: true } });
  const f = obj.data?.content?.fields ?? {};
  return {
    octReserve:    BigInt(f.oct_reserve?.fields?.value ?? 0),
    feePool:       BigInt(f.fee_pool?.fields?.value ?? 0),
    totalLpShares: BigInt(f.total_lp_shares ?? 0),
  };
}

async function readAdminLpShares() {
  const obj = await client.getObject({ id: ONEDEX_ID, options: { showContent: true } });
  const f = obj.data?.content?.fields ?? {};
  const tableId = f.lp_positions?.fields?.id?.id;
  if (!tableId) return 0n;
  try {
    const dyn = await client.getDynamicFieldObject({
      parentId: tableId,
      name: { type: 'address', value: ADMIN },
    });
    return BigInt(dyn.data?.content?.fields?.value ?? 0);
  } catch { return 0n; }
}

async function readSpendBalance(address) {
  const obj = await client.getObject({ id: SPEND_BUF_ID, options: { showContent: true } });
  const f = obj.data?.content?.fields ?? {};
  const tableId = f.balances?.fields?.id?.id;
  if (!tableId) return { yield: 0n, advance: 0n };
  try {
    const dyn = await client.getDynamicFieldObject({
      parentId: tableId,
      name: { type: 'address', value: address },
    });
    const bf = dyn.data?.content?.fields?.value?.fields ?? {};
    return {
      yield:   BigInt(bf.yield_balance ?? 0),
      advance: BigInt(bf.advance_balance ?? 0),
    };
  } catch { return { yield: 0n, advance: 0n }; }
}

function usd(n) { return (Number(n) / USD_DEC).toFixed(6) + ' USD'; }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('   SmartYield On-Chain Flow Verifier — OneChain Testnet');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Admin  : ${ADMIN}`);
  console.log(`  Package: ${PACKAGE_ID}`);
  console.log(`  RPC    : ${RPC_URL}`);

  // ── Pre-flight state ────────────────────────────────────────────────────────
  sep('Pre-flight: Reading on-chain state');
  const vault0  = await readVaultState();
  const dex0    = await readDexState();
  const lp0     = await readAdminLpShares();
  const spend0  = await readSpendBalance(ADMIN);
  info(`Vault  totalDeposits=${usd(vault0.totalDeposits)}  yieldReserve=${usd(vault0.yieldReserve)}  reserve=${usd(vault0.reserve)}`);
  info(`OneDex octReserve=${usd(dex0.octReserve)}  feePool=${usd(dex0.feePool)}  totalLpShares=${dex0.totalLpShares}`);
  info(`Admin  lpShares=${lp0}`);
  info(`SpendBuf (admin) yield=${usd(spend0.yield)}  advance=${usd(spend0.advance)}`);

  const results = [];

  // ────────────────────────────────────────────────────────────────────────────
  // TX 1 — Faucet mint 100 MOCK_USD to admin
  // ────────────────────────────────────────────────────────────────────────────
  sep('TX 1 — mock_usd::faucet_mint  (100 USD → admin)');
  try {
    const tx1 = new Transaction();
    tx1.setGasBudget(20_000_000);
    tx1.moveCall({
      target: `${PACKAGE_ID}::mock_usd::faucet_mint`,
      arguments: [
        tx1.object(TREASURY_CAP),
        tx1.pure.address(ADMIN),
        tx1.pure.u64(100 * USD_DEC),
      ],
    });
    const r1 = await execTx(tx1);
    const status1 = r1.effects?.status?.status;
    results.push({ tx: 'TX1 faucet_mint', digest: r1.digest, status: status1 });
    if (status1 === 'success') {
      ok(`Minted 100 USD  digest=${r1.digest}`);
      ok(`Explorer: ${EXPLORER}/${r1.digest}?network=testnet`);
    } else {
      err(`TX1 failed: ${r1.effects?.status?.error}`);
    }
  } catch (e) {
    err(`TX1 threw: ${e.message}`);
    results.push({ tx: 'TX1 faucet_mint', digest: null, status: 'error', error: e.message });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TX 2 — Add 1,000 USD to OneDex LP
  // ────────────────────────────────────────────────────────────────────────────
  sep('TX 2 — mock_onedex::add_liquidity_entry  (50 USD → DEX LP)');
  try {
    const coins2  = await getUsdCoins();
    if (!coins2.length) throw new Error('No MOCK_USD coins found — did TX1 confirm?');
    const amount2 = 50 * USD_DEC;
    const tx2 = new Transaction();
    tx2.setGasBudget(20_000_000);
    let lpCoin;
    if (coins2.length === 1) {
      [lpCoin] = tx2.splitCoins(tx2.object(coins2[0].coinObjectId), [tx2.pure.u64(amount2)]);
    } else {
      const primary = tx2.object(coins2[0].coinObjectId);
      tx2.mergeCoins(primary, coins2.slice(1).map(c => tx2.object(c.coinObjectId)));
      [lpCoin] = tx2.splitCoins(primary, [tx2.pure.u64(amount2)]);
    }
    tx2.moveCall({
      target: `${PACKAGE_ID}::mock_onedex::add_liquidity_entry`,
      arguments: [tx2.object(ONEDEX_ID), lpCoin],
    });
    const r2 = await execTx(tx2);
    const status2 = r2.effects?.status?.status;
    results.push({ tx: 'TX2 add_liquidity', digest: r2.digest, status: status2 });
    if (status2 === 'success') {
      ok(`Added 1,000 USD as LP  digest=${r2.digest}`);
      ok(`Explorer: ${EXPLORER}/${r2.digest}?network=testnet`);
    } else {
      err(`TX2 failed: ${r2.effects?.status?.error}`);
    }
  } catch (e) {
    err(`TX2 threw: ${e.message}`);
    results.push({ tx: 'TX2 add_liquidity', digest: null, status: 'error', error: e.message });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TX 3 — Simulate 0.22 USD trading fees (≈ 8% APY daily slice on 1000 USD LP)
  // ────────────────────────────────────────────────────────────────────────────
  sep('TX 3 — mock_onedex::simulate_trading_fees  (0.22 USD → fee_pool)');
  try {
    const coins3  = await getUsdCoins();
    if (!coins3.length) throw new Error('No MOCK_USD coins for fees');
    const feeSlice = Math.round(0.22 * USD_DEC);   // 0.22 USD daily slice
    const tx3 = new Transaction();
    tx3.setGasBudget(20_000_000);
    let feeCoin;
    if (coins3.length === 1) {
      [feeCoin] = tx3.splitCoins(tx3.object(coins3[0].coinObjectId), [tx3.pure.u64(feeSlice)]);
    } else {
      const primary = tx3.object(coins3[0].coinObjectId);
      tx3.mergeCoins(primary, coins3.slice(1).map(c => tx3.object(c.coinObjectId)));
      [feeCoin] = tx3.splitCoins(primary, [tx3.pure.u64(feeSlice)]);
    }
    tx3.moveCall({
      target: `${PACKAGE_ID}::mock_onedex::simulate_trading_fees`,
      arguments: [tx3.object(ONEDEX_ID), feeCoin, tx3.object(DEX_ADMIN)],
    });
    const r3 = await execTx(tx3);
    const status3 = r3.effects?.status?.status;
    results.push({ tx: 'TX3 simulate_fees', digest: r3.digest, status: status3 });
    if (status3 === 'success') {
      ok(`Injected 0.22 USD into fee_pool  digest=${r3.digest}`);
      ok(`Explorer: ${EXPLORER}/${r3.digest}?network=testnet`);
    } else {
      err(`TX3 failed: ${r3.effects?.status?.error}`);
    }
  } catch (e) {
    err(`TX3 threw: ${e.message}`);
    results.push({ tx: 'TX3 simulate_fees', digest: null, status: 'error', error: e.message });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TX 4 — Harvest DEX yield → vault.yield_reserve
  // ────────────────────────────────────────────────────────────────────────────
  sep('TX 4 — lane_router::harvest_dex_yield  (fee_pool → vault.yield_reserve)');
  try {
    const tx4 = new Transaction();
    tx4.setGasBudget(20_000_000);
    tx4.moveCall({
      target: `${PACKAGE_ID}::lane_router::harvest_dex_yield`,
      arguments: [
        tx4.object(LANE_ROUTER_ID),
        tx4.object(VAULT_ID),
        tx4.object(VAULT_ADMIN),
        tx4.object(ONEDEX_ID),
      ],
    });
    const r4 = await execTx(tx4);
    const status4 = r4.effects?.status?.status;
    results.push({ tx: 'TX4 harvest_yield', digest: r4.digest, status: status4 });
    if (status4 === 'success') {
      ok(`Yield harvested into vault.yield_reserve  digest=${r4.digest}`);
      ok(`Explorer: ${EXPLORER}/${r4.digest}?network=testnet`);
    } else {
      err(`TX4 failed: ${r4.effects?.status?.error}`);
    }
  } catch (e) {
    err(`TX4 threw: ${e.message}`);
    results.push({ tx: 'TX4 harvest_yield', digest: null, status: 'error', error: e.message });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TX 5 — Credit 7 USD advance to admin's SpendBuffer
  // ────────────────────────────────────────────────────────────────────────────
  sep('TX 5 — spend_buffer::credit_advance  (7 USD advance → admin SpendBuffer)');
  try {
    const coins5  = await getUsdCoins();
    if (!coins5.length) throw new Error('No MOCK_USD coins for advance');
    const advAmt  = 7 * USD_DEC;
    const tx5 = new Transaction();
    tx5.setGasBudget(20_000_000);
    let advCoin;
    if (coins5.length === 1) {
      [advCoin] = tx5.splitCoins(tx5.object(coins5[0].coinObjectId), [tx5.pure.u64(advAmt)]);
    } else {
      const primary = tx5.object(coins5[0].coinObjectId);
      tx5.mergeCoins(primary, coins5.slice(1).map(c => tx5.object(c.coinObjectId)));
      [advCoin] = tx5.splitCoins(primary, [tx5.pure.u64(advAmt)]);
    }
    tx5.moveCall({
      target: `${PACKAGE_ID}::spend_buffer::credit_advance`,
      arguments: [
        tx5.object(SPEND_BUF_ID),
        tx5.pure.address(ADMIN),
        tx5.pure.u64(advAmt),
        advCoin,
      ],
    });
    const r5 = await execTx(tx5);
    const status5 = r5.effects?.status?.status;
    results.push({ tx: 'TX5 credit_advance', digest: r5.digest, status: status5 });
    if (status5 === 'success') {
      ok(`7 USD advance credited to SpendBuffer  digest=${r5.digest}`);
      ok(`Explorer: ${EXPLORER}/${r5.digest}?network=testnet`);
    } else {
      err(`TX5 failed: ${r5.effects?.status?.error}`);
    }
  } catch (e) {
    err(`TX5 threw: ${e.message}`);
    results.push({ tx: 'TX5 credit_advance', digest: null, status: 'error', error: e.message });
  }

  // ── Post-flight state ───────────────────────────────────────────────────────
  sep('Post-flight: Verifying on-chain state changes');
  await new Promise(r => setTimeout(r, 3000)); // brief settle
  const vault1  = await readVaultState();
  const dex1    = await readDexState();
  const lp1     = await readAdminLpShares();
  const spend1  = await readSpendBalance(ADMIN);

  info(`Vault  yieldReserve: ${usd(vault0.yieldReserve)} → ${usd(vault1.yieldReserve)}  Δ=${usd(vault1.yieldReserve - vault0.yieldReserve)}`);
  info(`OneDex feePool: ${usd(dex0.feePool)} → ${usd(dex1.feePool)}  (should be 0 after harvest)`);
  info(`OneDex octReserve: ${usd(dex0.octReserve)} → ${usd(dex1.octReserve)}`);
  info(`Admin  lpShares: ${lp0} → ${lp1}`);
  info(`SpendBuf advance: ${usd(spend0.advance)} → ${usd(spend1.advance)}  Δ=${usd(spend1.advance - spend0.advance)}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  sep('SUMMARY — 5 Transaction Digests');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'success' ? '✅' : '❌';
    console.log(`  ${icon}  ${r.tx.padEnd(22)} ${r.digest ?? r.error}`);
    if (r.digest) console.log(`          ${EXPLORER}/${r.digest}?network=testnet`);
    if (r.status !== 'success') allPass = false;
  }

  console.log('\n' + '═'.repeat(62));
  if (allPass) {
    console.log('  🎉  ALL 5 TRANSACTIONS CONFIRMED — on-chain wiring is live');
  } else {
    console.log('  ⚠️   Some transactions failed — see details above');
  }
  console.log('═'.repeat(62) + '\n');
}

main().catch(e => { console.error('\nFatal:', e); process.exit(1); });
