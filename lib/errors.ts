import { activeBotChain } from "@/lib/botchain/chain";
/**
 * Human-readable error translation for Piggy
 * Maps contract custom errors and viem/wagmi exceptions into clear user feedback
 */

export const REVERT_MESSAGES: Record<string, string> = {
  BadPenaltyTo: "The penalty address can't be you or empty.",
  BadUnlock: "Pick a date in the future (up to 10 years).",
  NotOwner: "Only the owner of this piggy can perform this action.",
  NothingToClaim: "There are no pending funds for you to claim.",
  ZeroGoal: "Target savings goal must be greater than zero.",
  BadPenalty: "Penalty rate must be between 1% and 50%.",
  ZeroDeposit: "Deposit amount must be greater than zero.",
  NoSuchPot: "This piggy pot does not exist.",
  ClosedPot: "This piggy has already been broken or collected.",
  TransferFailed: "ETH transfer failed.",
  ReentrancyGuard: "Reentrancy detected.",
  LabelTooLong: "Label must be 40 bytes or fewer.",
};

export function describeError(err: unknown): string {
  // A wallet on the other BOT Chain network: writes are pinned to this build's chain (lib/useChainWrite.ts), so wagmi
  // refuses before the wallet opens. Say what to do, not the library's name for it.
  if (/ConnectorChainMismatch|chain mismatch|does not match the target chain/i.test(err instanceof Error ? `${err.name} ${err.message}` : String(err))) {
    return `Your wallet is on a different network. Switch it to ${activeBotChain.name}, then try again.`;
  }
  if (!err) return "An unexpected error occurred.";

  const message = err instanceof Error ? err.message : String(err);

  for (const [errorName, translation] of Object.entries(REVERT_MESSAGES)) {
    if (message.includes(errorName)) {
      return translation;
    }
  }

  if (/user rejected|rejected transaction|denied transaction/i.test(message)) {
    return "Transaction was cancelled in your wallet.";
  }

  if (/insufficient funds/i.test(message)) {
    return "Insufficient BOT balance for transaction.";
  }

  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

export const describeContractError = describeError;
