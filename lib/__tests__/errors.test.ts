import { describe, it, expect } from "vitest";
import { describeError, describeContractError, REVERT_MESSAGES } from "../errors";

describe("Piggy Errors Translation", () => {
  it("translates every contract revert correctly", () => {
    for (const [code, expected] of Object.entries(REVERT_MESSAGES)) {
      const err = new Error(`Contract execution reverted with reason: ${code}()`);
      expect(describeError(err)).toBe(expected);
      expect(describeContractError(err)).toBe(expected);
    }
  });

  it("translates specific required messages", () => {
    expect(describeError(new Error("execution reverted: BadPenaltyTo()"))).toBe(
      "The penalty address can't be you or empty.",
    );
    expect(describeError(new Error("execution reverted: BadUnlock()"))).toBe(
      "Pick a date in the future (up to 10 years).",
    );
    expect(describeError(new Error("execution reverted: NotOwner()"))).toBe(
      "Only the owner of this piggy can perform this action.",
    );
    expect(describeError(new Error("execution reverted: NothingToClaim()"))).toBe(
      "There are no pending funds for you to claim.",
    );
  });

  it("translates user rejection error", () => {
    const err = new Error("User rejected the request.");
    expect(describeError(err)).toBe("Transaction was cancelled in your wallet.");
  });

  it("translates insufficient funds error", () => {
    const err = new Error("insufficient funds for gas * price + value");
    expect(describeError(err)).toBe("Insufficient BOT balance for transaction.");
  });

  it("handles empty or unknown errors safely", () => {
    expect(describeError(null)).toBe("An unexpected error occurred.");
    expect(describeError("Network glitch")).toBe("Network glitch");
  });
});
