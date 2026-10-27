import { type Address } from "viem";

export const MIN_PENALTY_BPS = 100;
export const MAX_PENALTY_BPS = 5000;
export const MAX_LABEL = 40;
export const MAX_LOCK = 315360000; // 3650 days in seconds

export interface PotData {
  id: bigint;
  owner: Address;
  penaltyTo: Address;
  goal: bigint;
  balance: bigint;
  unlockAt: bigint;
  penaltyBps: number;
  closed: boolean;
  label: string;
}

export interface QuoteResult {
  toOwner: bigint;
  penalty: bigint;
  free: boolean;
}

/**
 * Calculates payout and penalty amounts according to Piggy.sol rules.
 * - If nowSec >= unlockAt OR balance >= goal: withdrawal is free (0 penalty).
 * - Otherwise: penalty = balance * penaltyBps / 10000; toOwner = balance - penalty.
 */
export function quote(
  balance: bigint,
  goal: bigint,
  unlockAt: bigint,
  penaltyBps: number,
  nowSec: bigint | number
): QuoteResult {
  const now = BigInt(nowSec);
  const isFree = now >= unlockAt || balance >= goal;

  if (isFree) {
    return {
      toOwner: balance,
      penalty: 0n,
      free: true,
    };
  }

  const penalty = (balance * BigInt(penaltyBps)) / 10000n;
  const toOwner = balance - penalty;

  return {
    toOwner,
    penalty,
    free: false,
  };
}

/**
 * Computes jar fill ratio as a float between 0 and 1.
 */
export function jarFill(balance: bigint, goal: bigint): number {
  if (goal === 0n) return 0;
  if (balance >= goal) return 1;
  return Number((balance * 10000n) / goal) / 10000;
}

/**
 * Calculates remaining seconds until free unlock.
 */
export function untilFree(
  unlockAt: bigint,
  nowSec: bigint | number
): bigint {
  const diff = unlockAt - BigInt(nowSec);
  return diff > 0n ? diff : 0n;
}

export function formatShortAddress(addr?: string): string {
  if (!addr || addr.length < 10) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
