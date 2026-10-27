/**
 * Local stack runner and seeder for Piggy.
 *
 * Spawns anvil on port 8722 with chain id 968, deploys Piggy, and seeds:
 * - Piggy 1: saving (40% of goal, date far)
 * - Piggy 2: goal met early (ready to collect free)
 * - Piggy 3: date passed (ready to collect free)
 * - Piggy 4: closed after an early break (penalty pending for penaltyTo)
 * - Piggy 5: brand new
 *
 * Usage:
 *   node scripts/local-stack.mjs
 *   npm run dev
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8722;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // (0) Saver (Alice)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // (1) Penalty Recipient (Bob)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // (2) Outsider (Charlie)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // (3) Second Saver (Dave)
];

const accounts = KEYS.map((k) => privateKeyToAccount(k));

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

try {
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

console.log(`Starting anvil on port ${PORT}...`);
spawn(
  "anvil",
  [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--block-time",
    "1",
    "--silent",
  ],
  {
    detached: true,
    stdio: "ignore",
  }
).unref();

const pub = createPublicClient({ chain: local, transport: http() });

// Wait for anvil to answer
for (let i = 0; ; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    if (i > 100) throw new Error(`anvil never answered on ${RPC}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(new URL("../contracts/out/Piggy.sol/Piggy.json", import.meta.url), "utf8"),
);

const deployerWallet = createWalletClient({
  account: accounts[0],
  chain: local,
  transport: http(),
});

const deployHash = await deployerWallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
});

const receipt = await pub.waitForTransactionReceipt({ hash: deployHash });
const contractAddress = receipt.contractAddress;
const startBlock = receipt.blockNumber;

console.log(`Piggy deployed to ${contractAddress} at block ${startBlock}`);

async function openPiggy(account, goal, unlockAt, penaltyBps, penaltyTo, label, value) {
  const w = createWalletClient({ account, chain: local, transport: http() });
  const hash = await w.writeContract({
    address: contractAddress,
    abi: artifact.abi,
    functionName: "open",
    args: [goal, unlockAt, penaltyBps, penaltyTo, label],
    value,
  });
  return await pub.waitForTransactionReceipt({ hash });
}

async function depositPiggy(account, id, value) {
  const w = createWalletClient({ account, chain: local, transport: http() });
  const hash = await w.writeContract({
    address: contractAddress,
    abi: artifact.abi,
    functionName: "deposit",
    args: [BigInt(id)],
    value,
  });
  return await pub.waitForTransactionReceipt({ hash });
}

async function withdrawPiggy(account, id) {
  const w = createWalletClient({ account, chain: local, transport: http() });
  const hash = await w.writeContract({
    address: contractAddress,
    abi: artifact.abi,
    functionName: "withdraw",
    args: [BigInt(id)],
  });
  return await pub.waitForTransactionReceipt({ hash });
}

async function increaseTime(seconds) {
  await pub.request({ method: "evm_increaseTime", params: [seconds] });
  await pub.request({ method: "evm_mine" });
}

const block = await pub.getBlock();
const now = block.timestamp;

// 1. Piggy 1: Saving (40% of goal, date far)
console.log("Seeding Piggy 1: Saving (40% of goal, date far)...");
await openPiggy(
  accounts[0],
  parseEther("10"),
  now + 180n * 86400n,
  1500, // 15%
  accounts[1].address,
  "New Laptop Fund",
  parseEther("4"),
);

// 2. Piggy 2: Goal met early (ready to collect free)
console.log("Seeding Piggy 2: Goal met early (ready to collect free)...");
await openPiggy(
  accounts[0],
  parseEther("5"),
  now + 90n * 86400n,
  2000, // 20%
  accounts[1].address,
  "Emergency Buffer",
  parseEther("2"),
);
await depositPiggy(accounts[0], 2, parseEther("3")); // total = 5 ether == goal

// 3. Piggy 3: Date passed (ready to collect free)
console.log("Seeding Piggy 3: Date passed (ready to collect free)...");
await openPiggy(
  accounts[0],
  parseEther("8"),
  now + 60n, // unlocks in 60s
  1000, // 10%
  accounts[1].address,
  "Summer Holiday",
  parseEther("3"),
);
// Advance time so Piggy 3 unlocks
await increaseTime(100);

// 4. Piggy 4: Closed after early break (penalty pending for penalty address)
console.log("Seeding Piggy 4: Closed after early break (penalty pending)...");
await openPiggy(
  accounts[0],
  parseEther("10"),
  now + 300n * 86400n,
  2500, // 25%
  accounts[1].address,
  "Vintage Vespa",
  parseEther("6"),
);
// Saver breaks early
await withdrawPiggy(accounts[0], 4);

// 5. Piggy 5: Brand new
console.log("Seeding Piggy 5: Brand new...");
await openPiggy(
  accounts[3],
  parseEther("2"),
  now + 30n * 86400n,
  1000, // 10%
  accounts[1].address,
  "Rainy Day Jar",
  parseEther("0.1"),
);

console.log("\n--- Piggy Local Stack Ready ---");
console.log(`Contract: ${contractAddress}`);
console.log(`RPC: ${RPC} (chain ${CHAIN_ID})\n`);

console.log("Account Role Table for Manual Verification:");
console.log("----------------------------------------------------------------------------------------");
console.log("| Role             | Acc # | Address                                    | Private Key          |");
console.log("----------------------------------------------------------------------------------------");
console.log(`| Saver (Alice)    | 0     | ${accounts[0].address} | ${KEYS[0].slice(0, 10)}... |`);
console.log(`| PenaltyTo (Bob)  | 1     | ${accounts[1].address} | ${KEYS[1].slice(0, 10)}... |`);
console.log(`| Outsider Charlie | 2     | ${accounts[2].address} | ${KEYS[2].slice(0, 10)}... |`);
console.log(`| Saver 2 (Dave)   | 3     | ${accounts[3].address} | ${KEYS[3].slice(0, 10)}... |`);
console.log("----------------------------------------------------------------------------------------\n");

console.log("Seeded Piggies Table:");
console.log("----------------------------------------------------------------------------------------");
console.log("| ID | Label            | Goal   | Balance | Penalty | Status                            |");
console.log("----------------------------------------------------------------------------------------");
console.log("| 1  | New Laptop Fund  | 10 BOT | 4 BOT   | 15%     | Saving (40%, unlock in 180 days)  |");
console.log("| 2  | Emergency Buffer | 5 BOT  | 5 BOT   | 20%     | Free (Goal reached early!)        |");
console.log("| 3  | Summer Holiday   | 8 BOT  | 3 BOT   | 10%     | Free (Unlock date passed)         |");
console.log("| 4  | Vintage Vespa    | 10 BOT | 0 BOT   | 25%     | Closed (Broke early, penalty due) |");
console.log("| 5  | Rainy Day Jar    | 2 BOT  | 0.1 BOT | 10%     | Brand new open jar                |");
console.log("----------------------------------------------------------------------------------------\n");

// Write .env.local
const envContent = [
  `NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet`,
  `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
  `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
  `NEXT_PUBLIC_DEPLOY_BLOCK_968=${startBlock}`,
  "",
].join("\n");

writeFileSync(".env.local", envContent);
console.log("Wrote .env.local");
