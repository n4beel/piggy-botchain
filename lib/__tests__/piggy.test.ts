import { describe, it, expect } from "vitest";
import { parseEther } from "viem";
import {
  quote,
  isPotFree,
  jarFill,
  untilFree,
  penaltyBpsToPercent,
  percentToPenaltyBps,
  formatPenaltyPercent,
  isValidPenaltyBps,
  formatTimeRemaining,
  formatShortAddress,
  formatEtherShort,
  MIN_PENALTY_BPS,
  MAX_PENALTY_BPS,
  MAX_LOCK,
} from "../piggy";

describe("Piggy Library", () => {
  const now = 1_700_000_000n;
  const unlock = now + 86400n * 30n; // 30 days
  const goal = parseEther("10");

  describe("quote & isPotFree", () => {
    it("returns free when unlock date has passed", () => {
      const bal = parseEther("3");
      const past = now - 1n;
      expect(isPotFree(bal, goal, past, now)).toBe(true);

      const q = quote(bal, goal, past, 2000, now);
      expect(q.free).toBe(true);
      expect(q.penalty).toBe(0n);
      expect(q.toOwner).toBe(bal);
    });

    it("returns free exactly at unlock date", () => {
      const bal = parseEther("3");
      expect(isPotFree(bal, goal, now, now)).toBe(true);

      const q = quote(bal, goal, now, 2000, now);
      expect(q.free).toBe(true);
      expect(q.penalty).toBe(0n);
      expect(q.toOwner).toBe(bal);
    });

    it("returns free when balance meets or exceeds goal before unlock", () => {
      // Exactly at goal
      expect(isPotFree(goal, goal, unlock, now)).toBe(true);
      const qExact = quote(goal, goal, unlock, 2000, now);
      expect(qExact.free).toBe(true);
      expect(qExact.penalty).toBe(0n);
      expect(qExact.toOwner).toBe(goal);

      // Exceeds goal
      const overBal = parseEther("15");
      expect(isPotFree(overBal, goal, unlock, now)).toBe(true);
      const qOver = quote(overBal, goal, unlock, 2000, now);
      expect(qOver.free).toBe(true);
      expect(qOver.penalty).toBe(0n);
      expect(qOver.toOwner).toBe(overBal);
    });

    it("calculates early break penalty accurately (15% on 10 ETH)", () => {
      const bal = parseEther("10");
      const q = quote(bal, parseEther("20"), unlock, 1500, now); // 15%
      expect(q.free).toBe(false);
      expect(q.penalty).toBe(parseEther("1.5"));
      expect(q.toOwner).toBe(parseEther("8.5"));
      expect(q.toOwner + q.penalty).toBe(bal);
    });

    it("handles 1-wei rounding identical to Piggy.sol", () => {
      // 1 wei with 10% penalty: 1 * 1000 / 10000 = 0
      const q = quote(1n, goal, unlock, 1000, now);
      expect(q.free).toBe(false);
      expect(q.penalty).toBe(0n);
      expect(q.toOwner).toBe(1n);
      expect(q.toOwner + q.penalty).toBe(1n);
    });

    it("handles odd wei rounding identical to Piggy.sol", () => {
      // 999 wei with 15% penalty (1500 bps): 999 * 1500 / 10000 = 149
      const q = quote(999n, goal, unlock, 1500, now);
      expect(q.free).toBe(false);
      expect(q.penalty).toBe(149n);
      expect(q.toOwner).toBe(850n);
      expect(q.toOwner + q.penalty).toBe(999n);
    });

    it("conserves total funds across boundary conditions", () => {
      for (const bps of [MIN_PENALTY_BPS, 500, 1500, 3000, MAX_PENALTY_BPS]) {
        for (const bal of [1n, 777n, parseEther("0.1"), parseEther("100")]) {
          const q = quote(bal, parseEther("1000"), unlock, bps, now);
          expect(q.toOwner + q.penalty).toBe(bal);
          expect(q.penalty).toBeLessThanOrEqual(bal);
        }
      }
    });
  });

  describe("jarFill", () => {
    it("returns 0 for zero balance or zero goal", () => {
      expect(jarFill(0n, goal)).toBe(0);
      expect(jarFill(parseEther("5"), 0n)).toBe(0);
    });

    it("returns fractional progress", () => {
      expect(jarFill(parseEther("5"), parseEther("10"))).toBe(0.5);
      expect(jarFill(parseEther("2.5"), parseEther("10"))).toBe(0.25);
    });

    it("caps at 1 when goal reached or exceeded", () => {
      expect(jarFill(goal, goal)).toBe(1);
      expect(jarFill(parseEther("15"), goal)).toBe(1);
    });
  });

  describe("untilFree", () => {
    it("returns positive remaining seconds", () => {
      expect(untilFree(now + 100n, now)).toBe(100n);
    });

    it("returns 0n for past or current timestamp", () => {
      expect(untilFree(now, now)).toBe(0n);
      expect(untilFree(now - 100n, now)).toBe(0n);
    });
  });

  describe("slider & penalty helpers", () => {
    it("converts bps to percent and back", () => {
      expect(penaltyBpsToPercent(100)).toBe(1);
      expect(penaltyBpsToPercent(1500)).toBe(15);
      expect(penaltyBpsToPercent(5000)).toBe(50);

      expect(percentToPenaltyBps(1)).toBe(100);
      expect(percentToPenaltyBps(15)).toBe(1500);
      expect(percentToPenaltyBps(50)).toBe(5000);
    });

    it("clamps percentages to MIN and MAX bps", () => {
      expect(percentToPenaltyBps(0.5)).toBe(MIN_PENALTY_BPS);
      expect(percentToPenaltyBps(75)).toBe(MAX_PENALTY_BPS);
    });

    it("formats penalty percent cleanly", () => {
      expect(formatPenaltyPercent(1000)).toBe("10%");
      expect(formatPenaltyPercent(1250)).toBe("12.5%");
      expect(formatPenaltyPercent(1500)).toBe("15%");
    });

    it("validates penalty bounds", () => {
      expect(isValidPenaltyBps(99)).toBe(false);
      expect(isValidPenaltyBps(100)).toBe(true);
      expect(isValidPenaltyBps(2500)).toBe(true);
      expect(isValidPenaltyBps(5000)).toBe(true);
      expect(isValidPenaltyBps(5001)).toBe(false);
    });
  });

  describe("formatting helpers", () => {
    it("formats remaining time correctly", () => {
      expect(formatTimeRemaining(0)).toBe("Ready now");
      expect(formatTimeRemaining(-10)).toBe("Ready now");
      expect(formatTimeRemaining(45)).toBe("45s left");
      expect(formatTimeRemaining(120)).toBe("2m left");
      expect(formatTimeRemaining(3660)).toBe("1h 1m left");
      expect(formatTimeRemaining(86400 * 1 + 3600 * 5)).toBe("1 day, 5h left");
      expect(formatTimeRemaining(86400 * 4)).toBe("4 days left");
    });

    it("formats short addresses", () => {
      expect(formatShortAddress()).toBe("—");
      expect(formatShortAddress("0x123")).toBe("—");
      expect(formatShortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
        "0x1234…5678",
      );
    });

    it("formats ether amounts cleanly", () => {
      expect(formatEtherShort(parseEther("1"))).toBe("1");
      expect(formatEtherShort(parseEther("1.5"))).toBe("1.5");
      expect(formatEtherShort(parseEther("1.2345678"))).toBe("1.2345");
      expect(formatEtherShort(parseEther("0.05"))).toBe("0.05");
    });
  });
});
