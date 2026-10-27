import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  BaseError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { piggyAbi } from "@/lib/botchain/abi";
import {
  quote,
  MIN_PENALTY_BPS,
  MAX_PENALTY_BPS,
  MAX_LOCK,
} from "@/lib/piggy";
import { getLogsChunked } from "@/lib/logs";

const PORT = 8622;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968 as const;

const KEY_ALICE = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const KEY_BOB = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const KEY_CHARLIE = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const accountAlice = privateKeyToAccount(KEY_ALICE);
const accountBob = privateKeyToAccount(KEY_BOB);
const accountCharlie = privateKeyToAccount(KEY_CHARLIE);

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

let node: ChildProcess;
let publicClient: PublicClient;
let walletAlice: any;
let walletBob: any;
let walletCharlie: any;
let address: Address;
let deployBlock: bigint;

function expectContractRevert(err: unknown, errorName: string) {
  const msg = err instanceof Error ? err.message : String(err);
  expect(msg).toContain(errorName);
}

beforeAll(async () => {
  try {
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}

  node = spawn("anvil", [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--silent",
  ]);

  publicClient = createPublicClient({ chain: local, transport: http() });

  for (let i = 0; ; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      if (i > 80) throw new Error("Anvil failed to start on integration port");
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  walletAlice = createWalletClient({ account: accountAlice, chain: local, transport: http() });
  walletBob = createWalletClient({ account: accountBob, chain: local, transport: http() });
  walletCharlie = createWalletClient({ account: accountCharlie, chain: local, transport: http() });

  const artifact = JSON.parse(
    readFileSync(new URL("../../contracts/out/Piggy.sol/Piggy.json", import.meta.url), "utf8"),
  );

  const hash = await walletAlice.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  address = receipt.contractAddress!;
  deployBlock = receipt.blockNumber;
}, 30_000);

afterAll(() => {
  try {
    node?.kill();
    execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
  } catch {}
});

describe("Piggy Integration Tests", () => {
  async function increaseTime(seconds: number) {
    await publicClient.request({ method: "evm_increaseTime" as any, params: [seconds] as any });
    await publicClient.request({ method: "evm_mine" as any, params: [] as any });
  }

  it("Path 1: Withdraw after unlock date is free (quote matches actual payout)", async () => {
    const block = await publicClient.getBlock();
    const unlockAt = block.timestamp + 300n; // 5 min
    const goal = parseEther("10");
    const depositVal = parseEther("3");

    // Alice opens pot with Bob as penaltyTo
    const hashOpen = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "open",
      args: [goal, unlockAt, 1500, accountBob.address, "Trip Fund"],
      value: depositVal,
    });
    await publicClient.waitForTransactionReceipt({ hash: hashOpen });

    const potId = 1n;
    const pot = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "potOf",
      args: [potId],
    });
    expect(pot.owner.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    expect(pot.balance).toBe(depositVal);
    expect(pot.closed).toBe(false);

    // Warp time past unlock date
    await increaseTime(350);

    const blockAfter = await publicClient.getBlock();
    const [qOwner, qPenalty, qFree] = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "quoteWithdraw",
      args: [potId],
    });

    const libQ = quote(depositVal, goal, unlockAt, 1500, blockAfter.timestamp);
    expect(qFree).toBe(true);
    expect(qPenalty).toBe(0n);
    expect(qOwner).toBe(depositVal);
    expect(libQ.free).toBe(true);
    expect(libQ.penalty).toBe(0n);
    expect(libQ.toOwner).toBe(depositVal);

    // Alice withdraws
    const hashW = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "withdraw",
      args: [potId],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashW });

    const alicePending = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "pending",
      args: [accountAlice.address],
    });
    const bobPending = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "pending",
      args: [accountBob.address],
    });

    expect(alicePending).toBe(qOwner);
    expect(bobPending).toBe(0n);

    // Alice claims
    const balBefore = await publicClient.getBalance({ address: accountAlice.address });
    const hashClaim = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "claim",
    });
    const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: hashClaim });
    const gasUsed = claimReceipt.gasUsed * claimReceipt.effectiveGasPrice;
    const balAfter = await publicClient.getBalance({ address: accountAlice.address });

    expect(balAfter).toBe(balBefore + alicePending - gasUsed);
  });

  it("Path 2: Withdraw when goal is met early before unlock is free", async () => {
    const block = await publicClient.getBlock();
    const unlockAt = block.timestamp + 86400n * 50n; // 50 days in future
    const goal = parseEther("5");

    const hashOpen = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "open",
      args: [goal, unlockAt, 2000, accountBob.address, "Car Fund"],
      value: parseEther("2"),
    });
    await publicClient.waitForTransactionReceipt({ hash: hashOpen });
    const potId = 2n;

    // Top up to reach goal
    const hashDep = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "deposit",
      args: [potId],
      value: parseEther("3"),
    });
    await publicClient.waitForTransactionReceipt({ hash: hashDep });

    const [qOwner, qPenalty, qFree] = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "quoteWithdraw",
      args: [potId],
    });

    expect(qFree).toBe(true);
    expect(qPenalty).toBe(0n);
    expect(qOwner).toBe(parseEther("5"));

    // Withdraw
    const hashW = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "withdraw",
      args: [potId],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashW });

    const alicePending = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "pending",
      args: [accountAlice.address],
    });
    expect(alicePending).toBe(parseEther("5"));

    // Alice claims
    const hashClaim = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "claim",
    });
    await publicClient.waitForTransactionReceipt({ hash: hashClaim });
  });

  it("Path 3: Early withdraw applies penalty to designated recipient", async () => {
    const block = await publicClient.getBlock();
    const unlockAt = block.timestamp + 86400n * 30n; // 30 days
    const goal = parseEther("10");
    const balance = parseEther("6");
    const penaltyBps = 2500; // 25%

    const hashOpen = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "open",
      args: [goal, unlockAt, penaltyBps, accountBob.address, "Break Early Test"],
      value: balance,
    });
    await publicClient.waitForTransactionReceipt({ hash: hashOpen });
    const potId = 3n;

    const [qOwner, qPenalty, qFree] = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "quoteWithdraw",
      args: [potId],
    });

    expect(qFree).toBe(false);
    expect(qPenalty).toBe(parseEther("1.5")); // 25% of 6 ETH
    expect(qOwner).toBe(parseEther("4.5"));
    expect(qOwner + qPenalty).toBe(balance);

    // Library quote check
    const blockCur = await publicClient.getBlock();
    const libQ = quote(balance, goal, unlockAt, penaltyBps, blockCur.timestamp);
    expect(libQ.free).toBe(false);
    expect(libQ.penalty).toBe(qPenalty);
    expect(libQ.toOwner).toBe(qOwner);

    // Bob pending before
    const bobPendingBefore = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "pending",
      args: [accountBob.address],
    });

    // Alice withdraws early
    const hashW = await walletAlice.writeContract({
      address,
      abi: piggyAbi,
      functionName: "withdraw",
      args: [potId],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashW });

    const alicePending = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "pending",
      args: [accountAlice.address],
    });
    const bobPending = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "pending",
      args: [accountBob.address],
    });

    expect(alicePending).toBe(parseEther("4.5"));
    expect(bobPending).toBe(bobPendingBefore + parseEther("1.5"));

    // Path 4: Bob claims penalty
    const bobBalBefore = await publicClient.getBalance({ address: accountBob.address });
    const hashBobClaim = await walletBob.writeContract({
      address,
      abi: piggyAbi,
      functionName: "claim",
    });
    const bobClaimReceipt = await publicClient.waitForTransactionReceipt({ hash: hashBobClaim });
    const bobGas = bobClaimReceipt.gasUsed * bobClaimReceipt.effectiveGasPrice;
    const bobBalAfter = await publicClient.getBalance({ address: accountBob.address });

    expect(bobBalAfter).toBe(bobBalBefore + bobPending - bobGas);
  });

  it("Rejects invalid open parameters", async () => {
    const block = await publicClient.getBlock();
    const unlockAt = block.timestamp + 86400n;

    // ZeroGoal
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [0n, unlockAt, 1000, accountBob.address, "ZeroGoal"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    // BadUnlock (past)
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), block.timestamp, 1000, accountBob.address, "Past"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    // BadUnlock (too far > 10 years)
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), block.timestamp + BigInt(MAX_LOCK) + 10n, 1000, accountBob.address, "TooFar"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    // BadPenalty (< 100 or > 5000)
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), unlockAt, 99, accountBob.address, "TooLow"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), unlockAt, 5001, accountBob.address, "TooHigh"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    // BadPenaltyTo: zero address or self
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), unlockAt, 1000, "0x0000000000000000000000000000000000000000", "Zero"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), unlockAt, 1000, accountAlice.address, "Self"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    // ZeroDeposit
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), unlockAt, 1000, accountBob.address, "ZeroVal"],
        value: 0n,
      }),
    ).rejects.toThrow();

    // LabelTooLong (> 40 bytes)
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "open",
        args: [parseEther("5"), unlockAt, 1000, accountBob.address, "12345678901234567890123456789012345678901"],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();
  });

  it("Enforces access control: non-owner cannot deposit or withdraw", async () => {
    // Pot 1 is owned by Alice
    await expect(
      walletCharlie.writeContract({
        address,
        abi: piggyAbi,
        functionName: "deposit",
        args: [1n],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    await expect(
      walletCharlie.writeContract({
        address,
        abi: piggyAbi,
        functionName: "withdraw",
        args: [1n],
      }),
    ).rejects.toThrow();
  });

  it("Rejects actions on closed pots", async () => {
    // Pot 1 was already withdrawn and closed
    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "deposit",
        args: [1n],
        value: parseEther("1"),
      }),
    ).rejects.toThrow();

    await expect(
      walletAlice.writeContract({
        address,
        abi: piggyAbi,
        functionName: "withdraw",
        args: [1n],
      }),
    ).rejects.toThrow();
  });

  it("Rejects claim when pending balance is zero", async () => {
    // Charlie has 0 pending
    await expect(
      walletCharlie.writeContract({
        address,
        abi: piggyAbi,
        functionName: "claim",
      }),
    ).rejects.toThrow();
  });

  it("Views latest and byOwner correctly", async () => {
    const alicePots = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "byOwner",
      args: [accountAlice.address],
    });
    expect(alicePots.length).toBe(3);

    const latest = await publicClient.readContract({
      address,
      abi: piggyAbi,
      functionName: "latest",
      args: [0n, 10n],
    });
    expect(latest.length).toBe(3);
    expect(latest[0].id).toBe(3n);
    expect(latest[1].id).toBe(2n);
    expect(latest[2].id).toBe(1n);
  });

  it("getLogsChunked fetches all historical events", async () => {
    const curBlock = await publicClient.getBlockNumber({ cacheTime: 0 });
    const openedEvent = piggyAbi.find((x) => x.type === "event" && x.name === "Opened") as any;
    const res = await getLogsChunked({
      client: publicClient as any,
      address,
      event: openedEvent,
      fromBlock: 0n,
      toBlock: curBlock,
    });

    expect(res.complete).toBe(true);
    expect(res.logs.length).toBe(3);
  });
});
