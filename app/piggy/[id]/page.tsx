"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { parseEther, type Address } from "viem";
import { piggyAbi } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import {
  quote,
  isPotFree,
  jarFill,
  formatTimeRemaining,
  formatShortAddress,
  formatEtherShort,
  formatPenaltyPercent,
} from "@/lib/piggy";
import { describeError } from "@/lib/errors";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import Jar from "@/components/piggy/Jar";
import DepositBox from "@/components/piggy/DepositBox";
import BreakConfirmModal from "@/components/piggy/BreakConfirmModal";
import LimitsBanner from "@/components/piggy/LimitsBanner";
import { useToast } from "@/components/ui/Toast";

export default function PiggyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const potId = BigInt(resolvedParams.id || "0");

  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);

  const [nowSec, setNowSec] = useState<number>(Math.floor(Date.now() / 1000));
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [isPendingTx, setIsPendingTx] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 1. Read Pot Data
  const { data: rawPot, isLoading, refetch: refetchPot } = useReadContract({
    address: deployment.address,
    abi: piggyAbi,
    functionName: "potOf",
    args: [potId],
    query: {
      enabled: deployed && potId > 0n,
      refetchInterval: 5_000,
    },
  });

  // 2. Read Quote Withdraw
  const { data: rawQuote, refetch: refetchQuote } = useReadContract({
    address: deployment.address,
    abi: piggyAbi,
    functionName: "quoteWithdraw",
    args: [potId],
    query: {
      enabled: deployed && potId > 0n && Boolean(rawPot && !rawPot.closed),
      refetchInterval: 5_000,
    },
  });

  const { writeContractAsync } = useWriteContract();

  const pot = useMemo(() => {
    if (!rawPot) return null;
    return {
      owner: rawPot.owner,
      penaltyTo: rawPot.penaltyTo,
      goal: rawPot.goal,
      balance: rawPot.balance,
      unlockAt: rawPot.unlockAt,
      penaltyBps: rawPot.penaltyBps,
      closed: rawPot.closed,
      label: rawPot.label,
    };
  }, [rawPot]);

  const quoteData = useMemo(() => {
    if (rawQuote) {
      return {
        toOwner: rawQuote[0],
        penalty: rawQuote[1],
        free: rawQuote[2],
      };
    }
    if (pot) {
      return quote(pot.balance, pot.goal, pot.unlockAt, pot.penaltyBps, nowSec);
    }
    return { toOwner: 0n, penalty: 0n, free: false };
  }, [rawQuote, pot, nowSec]);

  const isOwner = useMemo(() => {
    if (!userAddress || !pot) return false;
    return userAddress.toLowerCase() === pot.owner.toLowerCase();
  }, [userAddress, pot]);

  const isPenaltyRecipient = useMemo(() => {
    if (!userAddress || !pot) return false;
    return userAddress.toLowerCase() === pot.penaltyTo.toLowerCase();
  }, [userAddress, pot]);

  const fill = useMemo(() => {
    if (!pot) return 0;
    return jarFill(pot.balance, pot.goal);
  }, [pot]);

  const isFree = useMemo(() => {
    if (rawQuote) return rawQuote[2];
    if (pot) return isPotFree(pot.balance, pot.goal, pot.unlockAt, nowSec);
    return false;
  }, [rawQuote, pot, nowSec]);

  // Actions
  async function handleDeposit(amountWei: bigint) {
    if (!deployed || !pot) return;
    try {
      setIsPendingTx(true);
      const hash = await writeContractAsync({
        address: deployment.address,
        abi: piggyAbi,
        functionName: "deposit",
        args: [potId],
        value: amountWei,
      });

      toast("info", "Depositing...", "Top-up submitted.");
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast("success", "Deposit added!", `${formatEtherShort(amountWei)} BOT placed in the jar.`);
      refetchPot();
      refetchQuote();
    } catch (err: unknown) {
      toast("error", "Deposit failed", describeError(err));
    } finally {
      setIsPendingTx(false);
    }
  }

  async function handleWithdraw() {
    if (!deployed || !pot) return;
    try {
      setIsPendingTx(true);
      const hash = await writeContractAsync({
        address: deployment.address,
        abi: piggyAbi,
        functionName: "withdraw",
        args: [potId],
      });

      toast("info", isFree ? "Collecting..." : "Breaking piggy...", "Transaction broadcast.");
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast(
        "success",
        isFree ? "Collected!" : "Piggy broken",
        isFree
          ? "All savings sent to your pending balance with zero penalty."
          : `Payout sent to pending. Penalty sent to ${formatShortAddress(pot.penaltyTo)}.`,
      );
      setIsBreakModalOpen(false);
      refetchPot();
      refetchQuote();
    } catch (err: unknown) {
      toast("error", "Withdrawal failed", describeError(err));
    } finally {
      setIsPendingTx(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <div className="h-64 rounded-3xl shimmer-box" />
        <div className="h-32 rounded-2xl shimmer-box" />
      </div>
    );
  }

  if (!pot) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-2xl border border-[var(--border-default)]">
          🏺
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Piggy Not Found</h2>
        <p className="text-xs text-[var(--text-muted)]">
          This savings pot does not exist or may not have been created yet.
        </p>
        <Link href="/">
          <Button variant="ghost" size="md">
            &larr; Return to Shelf
          </Button>
        </Link>
      </div>
    );
  }

  const unlockDate = new Date(Number(pot.unlockAt) * 1000);
  const formattedDate = unlockDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          &larr; Return to Shelf
        </Link>
      </div>

      {/* Main Pot Card */}
      <Panel variant="surface" className="rounded-3xl border border-[var(--border-strong)] p-6 sm:p-10 shadow-xl space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="mono text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-base)] px-2.5 py-0.5 rounded-md border border-[var(--border-subtle)]">
                Piggy #{potId.toString()}
              </span>
              {pot.closed ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--border-subtle)] text-[var(--danger)]">
                  Closed
                </span>
              ) : isFree ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[var(--success)] border border-emerald-300">
                  Ready to Collect Free
                </span>
              ) : (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg-base)] text-[var(--accent)] border border-[var(--border-subtle)]">
                  Saving
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {pot.label || `Savings Pot #${potId.toString()}`}
            </h1>
          </div>

          <div className="text-left sm:text-right">
            <span className="block text-xs font-medium text-[var(--text-muted)]">Owner</span>
            <span className="mono text-xs font-bold text-[var(--text-primary)]" title={pot.owner}>
              {formatShortAddress(pot.owner)}
              {isOwner && " (You)"}
            </span>
          </div>
        </header>

        {/* Jar and Progress Display */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 py-4">
          <Jar
            balance={pot.balance}
            goal={pot.goal}
            unlockAt={pot.unlockAt}
            closed={pot.closed}
            label={pot.label}
            size="lg"
            nowSec={nowSec}
          />

          <div className="w-full max-w-sm space-y-4">
            <div className="bg-[var(--bg-elevated)] p-5 rounded-2xl border border-[var(--border-subtle)] space-y-4">
              <div>
                <span className="block text-xs font-semibold text-[var(--text-muted)]">Balance</span>
                <span className="mono text-3xl font-extrabold text-[var(--text-primary)]">
                  {formatEtherShort(pot.balance)}
                  <span className="text-base text-[var(--text-muted)] font-bold ml-1.5">BOT</span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                  <span>Goal: {formatEtherShort(pot.goal)} BOT</span>
                  <span>{Math.round(fill * 100)}%</span>
                </div>
                <div className="w-full bg-[var(--border-subtle)] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round(fill * 100))}%`,
                      background: isFree ? "var(--success)" : "var(--accent)",
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)]">Unlock Date</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formattedDate}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)]">Time Left</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {pot.closed ? "—" : isFree ? "Free now" : formatTimeRemaining(pot.unlockAt - BigInt(nowSec))}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)]">Penalty Rate</span>
                  <span className="font-bold text-[var(--danger)]">{formatPenaltyPercent(pot.penaltyBps)}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--text-muted)]">Penalty Beneficiary</span>
                  <span className="mono font-semibold text-[var(--text-primary)]" title={pot.penaltyTo}>
                    {formatShortAddress(pot.penaltyTo)}
                    {isPenaltyRecipient && " (You)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Owner Actions */}
            {isOwner && !pot.closed && (
              <div className="space-y-3 pt-2">
                {isFree ? (
                  // Free Withdrawal: Prominent Green Collect Button
                  <div className="space-y-2">
                    <Button
                      variant="collect"
                      size="lg"
                      onClick={handleWithdraw}
                      loading={isPendingTx}
                      className="w-full text-base"
                    >
                      Collect {formatEtherShort(pot.balance)} BOT Free
                    </Button>
                    <p className="text-[11px] text-center text-[var(--success)] font-semibold">
                      Goal met or unlock date passed. Zero penalty deduction!
                    </p>
                  </div>
                ) : (
                  // Early break: Deliberately smaller, quieter button
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      variant="break"
                      size="sm"
                      onClick={() => setIsBreakModalOpen(true)}
                      disabled={isPendingTx}
                      className="hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      Break piggy…
                    </Button>
                    <span className="text-[11px] text-[var(--text-muted)] text-center">
                      Early break costs {formatPenaltyPercent(pot.penaltyBps)} to {formatShortAddress(pot.penaltyTo)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Penalty recipient view notification */}
            {isPenaltyRecipient && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-bold block">You are the penalty beneficiary</span>
                <p className="text-[11px] leading-relaxed">
                  If the owner breaks this pot early, the {formatPenaltyPercent(pot.penaltyBps)} penalty will be credited to you.
                  Check your pending claims on your claims page.
                </p>
                <Link href="/me" className="inline-block text-[11px] font-bold text-amber-800 underline mt-1">
                  Go to Pending Claims &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Top up Deposit Box (Owner only, open pot) */}
      {isOwner && !pot.closed && (
        <DepositBox
          potId={potId}
          onDeposit={handleDeposit}
          disabled={isPendingTx}
        />
      )}

      {/* Break Confirmation Sheet Modal */}
      <BreakConfirmModal
        isOpen={isBreakModalOpen}
        onClose={() => setIsBreakModalOpen(false)}
        onConfirm={handleWithdraw}
        toOwner={quoteData.toOwner}
        penalty={quoteData.penalty}
        penaltyTo={pot.penaltyTo}
        label={pot.label}
        isPending={isPendingTx}
      />

      {/* Limits Disclosure */}
      <LimitsBanner penaltyTo={pot.penaltyTo} />
    </div>
  );
}
