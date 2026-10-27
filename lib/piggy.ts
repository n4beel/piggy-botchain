import { formatEther, type Address } from "viem";

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
 * Determines whether a pot is eligible for free withdrawal without penalty.
 */
export function isPotFree(
  balance: bigint,
  goal: bigint,
  unlockAt: bigint,
  nowSec: bigint | number,
): boolean {
  const now = BigInt(nowSec);
  return now >= unlockAt || balance >= goal;
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
  nowSec: bigint | number,
): QuoteResult {
  const isFree = isPotFree(balance, goal, unlockAt, nowSec);

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
 * Calculates remaining seconds until free unlock date.
 */
export function untilFree(
  unlockAt: bigint,
  nowSec: bigint | number,
): bigint {
  const diff = unlockAt - BigInt(nowSec);
  return diff > 0n ? diff : 0n;
}

/**
 * Converts penalty basis points (100..5000) to percentage (1..50).
 */
export function penaltyBpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * Converts percentage (1..50) to basis points (100..5000).
 */
export function percentToPenaltyBps(pct: number): number {
  const bps = Math.round(pct * 100);
  if (bps < MIN_PENALTY_BPS) return MIN_PENALTY_BPS;
  if (bps > MAX_PENALTY_BPS) return MAX_PENALTY_BPS;
  return bps;
}

/**
 * Formats basis points into human-friendly percentage string (e.g., "15%").
 */
export function formatPenaltyPercent(bps: number): string {
  const pct = bps / 100;
  return `${pct.toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/**
 * Checks whether penalty bps falls within the valid range.
 */
export function isValidPenaltyBps(bps: number): boolean {
  return bps >= MIN_PENALTY_BPS && bps <= MAX_PENALTY_BPS;
}

/**
 * Formats remaining seconds into friendly human duration string (e.g. "5 days, 3 hours").
 */
export function formatTimeRemaining(seconds: bigint | number): string {
  const s = Number(seconds);
  if (s <= 0) return "Ready now";

  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);

  if (days > 1) return `${days} days left`;
  if (days === 1) return `1 day, ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${s}s left`;
}

/**
 * Formats a short address: 0x1234...5678.
 */
export function formatShortAddress(addr?: string): string {
  if (!addr || addr.length < 10) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Formats wei to a clean BOT string.
 */
export function formatEtherShort(wei: bigint): string {
  const formatted = formatEther(wei);
  const [whole, decimal] = formatted.split(".");
  if (!decimal || decimal === "0") return whole;
  return `${whole}.${decimal.slice(0, 4).replace(/0+$/, "")}`;
}
