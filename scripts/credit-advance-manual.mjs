/**
 * One-time script: credit advance on-chain for a user whose creditAdvance
 * was never executed (admin had no MOCK_USD at deposit time).
 *
 * Usage:
 *   node scripts/credit-advance-manual.mjs <walletAddress> <amountUsd>
 *
 * Example:
 *   node scripts/credit-advance-manual.mjs \
 *     0xa36552e1b154e2d612c533e2824344dc134b4436856d62423d573a2e0ec91a71 \
 *     168
 */

import { SuiClient } from '@onelabs/sui/client';
import { Transaction } from '@onelabs/sui/transactions';
import { Ed25519Keypair } from '@onelabs/sui/keypairs/ed25519';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = resolve(__dirname, '../.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const MOCK_USD_DECIMALS = 1_000_000;

const [, , userAddress, amountUsdArg] = process.argv;
if (!userAddress || !amountUsdArg) {
  console.error('Usage: node scripts/credit-advance-manual.mjs <walletAddress> <amountUsd>');
  process.exit(1);
}

const amountUsd = parseFloat(amountUsdArg);
const amountBaseUnits = Math.round(amountUsd * MOCK_USD_DECIMALS);

const privateKey = env['ADMIN_PRIVATE_KEY'];
const spendBufferId = env['ONECHAIN_SPEND_BUFFER_OBJECT_ID'];
const packageId = env['ONECHAIN_PACKAGE_ID'];
const rpcUrl = env['ONECHAIN_RPC_URL'] ?? 'https://rpc-testnet.onelabs.cc';

if (!privateKey || !spendBufferId || !packageId) {
  console.error('Missing ADMIN_PRIVATE_KEY, ONECHAIN_SPEND_BUFFER_OBJECT_ID, or ONECHAIN_PACKAGE_ID in .env');
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(privateKey);
const adminAddress = keypair.getPublicKey().toSuiAddress();
const client = new SuiClient({ url: rpcUrl });
const coinType = `${packageId}::mock_usd::MOCK_USD`;

console.log(`Admin address : ${adminAddress}`);
console.log(`User address  : ${userAddress}`);
console.log(`Amount        : ${amountUsd} USD (${amountBaseUnits} base units)`);
console.log(`SpendBuffer   : ${spendBufferId}`);
console.log('');

// Check admin MOCK_USD balance
const coinsResult = await client.getCoins({ owner: adminAddress, coinType });
const coins = coinsResult.data;
const totalAdminBalance = coins.reduce((s, c) => s + BigInt(c.balance), 0n);
console.log(`Admin MOCK_USD coins: ${coins.length} coin(s), total: ${Number(totalAdminBalance) / MOCK_USD_DECIMALS} USD`);

if (!coins.length) {
  console.error('ERROR: Admin has no MOCK_USD coins. Fund the admin wallet first.');
  process.exit(1);
}
if (totalAdminBalance < BigInt(amountBaseUnits)) {
  console.error(`ERROR: Admin only has ${Number(totalAdminBalance) / MOCK_USD_DECIMALS} USD, need ${amountUsd} USD`);
  process.exit(1);
}

// Check current on-chain balance for this user
const obj = await client.getObject({ id: spendBufferId, options: { showContent: true } });
const tableId = obj.data?.content?.fields?.balances?.fields?.id?.id;
if (tableId) {
  try {
    const dynField = await client.getDynamicFieldObject({
      parentId: tableId,
      name: { type: 'address', value: userAddress },
    });
    const b = dynField.data?.content?.fields?.value?.fields;
    if (b) {
      console.log(`Current on-chain balance → yield: ${b.yield_balance}, advance: ${b.advance_balance}`);
    } else {
      console.log('User has no entry in SpendBuffer yet (will be created)');
    }
  } catch {
    console.log('User has no entry in SpendBuffer yet (will be created)');
  }
}

console.log('\nBuilding creditAdvance transaction...');

const tx = new Transaction();
tx.setGasBudget(20_000_000);

let paymentCoin;
if (coins.length === 1) {
  [paymentCoin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [tx.pure.u64(amountBaseUnits)]);
} else {
  const primary = tx.object(coins[0].coinObjectId);
  tx.mergeCoins(primary, coins.slice(1).map(c => tx.object(c.coinObjectId)));
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

if (result.effects?.status?.status === 'success') {
  console.log(`\n✅ creditAdvance SUCCESS`);
  console.log(`   Digest : ${result.digest}`);
  console.log(`   Amount : ${amountUsd} USD credited to ${userAddress}`);
} else {
  console.error(`\n❌ creditAdvance FAILED: ${result.effects?.status?.error}`);
  process.exit(1);
}
