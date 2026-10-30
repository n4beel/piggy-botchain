"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { useWriteContract, waitSuccess } from "@/lib/useChainWrite";
import { piggyAbi } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { formatEtherShort, formatShortAddress } from "@/lib/piggy";
import { describeError } from "@/lib/errors";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import JarShelf, { type ShelfJarItem } from "@/components/piggy/JarShelf";
import { useToast } from "@/components/ui/Toast";

export default function MePage() {
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const { toast } = useToast();
  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);

  const [isClaiming, setIsClaiming] = useState(false);

  // 1. Read pending balance for connected wallet
  const { data: rawPending, refetch: refetchPending, isLoading: isPendingLoading } = useReadContract({
    address: deployment.address,
    abi: piggyAbi,
    functionName: "pending",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: deployed && Boolean(userAddress),
      refetchInterval: 5_000,
    },
  });

  const pendingAmount = rawPending ?? 0n;

  // 2. Read user's pots
  const { data: rawUserPotIds } = useReadContract({
    address: deployment.address,
    abi: piggyAbi,
    functionName: "byOwner",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: deployed && Boolean(userAddress),
      refetchInterval: 6_000,
    },
  });

  // 3. Read latest pots to match
  const { data: rawLatestPots, isLoading: isPotsLoading } = useReadContract({
    address: deployment.address,
    abi: piggyAbi,
    functionName: "latest",
    args: [0n, 30n],
    query: {
      enabled: deployed,
      refetchInterval: 6_000,
    },
  });

  const { writeContractAsync } = useWriteContract();

  const userPots = useMemo<ShelfJarItem[]>(() => {
    if (!userAddress || !rawLatestPots || !Array.isArray(rawLatestPots)) return [];
    return rawLatestPots
      .filter((p) => p.owner.toLowerCase() === userAddress.toLowerCase())
      .map((p) => ({
        id: p.id,
        owner: p.owner,
        penaltyTo: p.penaltyTo,
        goal: p.goal,
        balance: p.balance,
        unlockAt: p.unlockAt,
        penaltyBps: p.penaltyBps,
        closed: p.closed,
        label: p.label,
        free: p.free,
      }));
  }, [userAddress, rawLatestPots]);

  const beneficiaryPots = useMemo<ShelfJarItem[]>(() => {
    if (!userAddress || !rawLatestPots || !Array.isArray(rawLatestPots)) return [];
    return rawLatestPots
      .filter(
        (p) =>
          p.penaltyTo.toLowerCase() === userAddress.toLowerCase() &&
          p.owner.toLowerCase() !== userAddress.toLowerCase(),
      )
      .map((p) => ({
        id: p.id,
        owner: p.owner,
        penaltyTo: p.penaltyTo,
        goal: p.goal,
        balance: p.balance,
        unlockAt: p.unlockAt,
        penaltyBps: p.penaltyBps,
        closed: p.closed,
        label: p.label,
        free: p.free,
      }));
  }, [userAddress, rawLatestPots]);

  async function handleClaim() {
    if (!deployed || pendingAmount === 0n) return;
    try {
      setIsClaiming(true);
      const hash = await writeContractAsync({
        address: deployment.address,
        abi: piggyAbi,
        functionName: "claim",
      });

      toast("info", "Claiming funds...", "Claim transaction broadcast.");
      if (publicClient) {
        await waitSuccess(publicClient, hash);
      }
      toast(
        "success",
        "Funds claimed!",
        `${formatEtherShort(pendingAmount)} BOT transferred directly to your wallet.`,
      );
      refetchPending();
    } catch (err: unknown) {
      toast("error", "Claim failed", describeError(err));
    } finally {
      setIsClaiming(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-2xl border border-[var(--border-default)]">
          👛
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Connect Your Wallet</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Connect your wallet to inspect your pending claims and savings jars.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          My Account &amp; Claims
        </h1>
        <p className="mono text-xs text-[var(--text-muted)]">
          {userAddress}
        </p>
      </header>

      {/* Pull-Payment Pending Claims Card */}
      <Panel
        variant="surface"
        className="rounded-3xl border border-[var(--border-strong)] p-6 sm:p-8 shadow-md space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[var(--border-subtle)]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Pull-Payment Balance
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="mono text-4xl font-extrabold text-[var(--text-primary)]">
                {formatEtherShort(pendingAmount)}
              </span>
              <span className="mono text-lg font-bold text-[var(--text-muted)]">BOT</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Available to withdraw directly into your wallet.
            </p>
          </div>

          <div>
            <Button
              variant={pendingAmount > 0n ? "primary" : "ghost"}
              size="lg"
              onClick={handleClaim}
              loading={isClaiming}
              disabled={pendingAmount === 0n}
              className="w-full sm:w-auto min-w-44 text-sm font-bold"
            >
              {pendingAmount > 0n
                ? `Claim ${formatEtherShort(pendingAmount)} BOT`
                : "Nothing to Claim"}
            </Button>
          </div>
        </div>

        <div className="text-xs text-[var(--text-secondary)] space-y-2 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)]">
          <h4 className="font-bold text-[var(--text-primary)]">How do pending funds accumulate?</h4>
          <ul className="list-disc pl-4 space-y-1 text-[11px]">
            <li>
              When you break or collect from your own savings pot, your share is safely stored in pending for you to pull.
            </li>
            <li>
              If an accountability partner named you as their penalty beneficiary and broke early, the penalty was deposited here.
            </li>
            <li>
              Pull-payment protects everyone from failed transfers and allows you to claim anytime.
            </li>
          </ul>
        </div>
      </Panel>

      {/* Jars Owned by User */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              Your Piggies ({userPots.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Savings jars created by you
            </p>
          </div>
          <Link href="/new">
            <Button size="sm" variant="primary">
              + Start a Piggy
            </Button>
          </Link>
        </div>

        <JarShelf
          pots={userPots}
          emptyMessage="You have not opened any savings pots yet."
        />
      </section>

      {/* Pots where user is the Penalty Beneficiary */}
      {beneficiaryPots.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-[var(--border-default)] pb-3">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              Accountability Partner Piggies ({beneficiaryPots.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Pots that designated your wallet as their penalty recipient
            </p>
          </div>

          <JarShelf
            pots={beneficiaryPots}
            emptyMessage="No jars have named you as a beneficiary yet."
          />
        </section>
      )}
    </div>
  );
}
