"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { piggyAbi } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import Jar from "@/components/piggy/Jar";
import JarShelf, { type ShelfJarItem } from "@/components/piggy/JarShelf";
import LimitsBanner from "@/components/piggy/LimitsBanner";
import { formatEtherShort, formatTimeRemaining, isPotFree, jarFill } from "@/lib/piggy";

export default function HomePage() {
  const { address: userAddress, isConnected } = useAccount();
  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);

  const [nowSec, setNowSec] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 1. Read potCount
  const { data: rawPotCount } = useReadContract({
    address: deployment.address,
    abi: piggyAbi,
    functionName: "potCount",
    query: {
      enabled: deployed,
      refetchInterval: 6_000,
    },
  });

  // 2. Read latest pots (up to 20 pots)
  const { data: rawLatestPots, isLoading: isLatestLoading } = useReadContract({
    address: deployment.address,
    abi: piggyAbi,
    functionName: "latest",
    args: [0n, 20n],
    query: {
      enabled: deployed,
      refetchInterval: 6_000,
    },
  });

  // 3. Read user's pots
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

  // Map latest pots
  const latestPots = useMemo<ShelfJarItem[]>(() => {
    if (!rawLatestPots || !Array.isArray(rawLatestPots)) return [];
    return rawLatestPots.map((p) => ({
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
  }, [rawLatestPots]);

  // Filter user's pots
  const userPots = useMemo<ShelfJarItem[]>(() => {
    if (!userAddress || !latestPots.length) return [];
    return latestPots.filter((p) => p.owner.toLowerCase() === userAddress.toLowerCase());
  }, [userAddress, latestPots]);

  // Featured / Active Pot: user's first open pot, or latest open community pot, or dummy demo
  const featuredPot = useMemo(() => {
    const userOpen = userPots.find((p) => !p.closed);
    if (userOpen) return userOpen;
    const communityOpen = latestPots.find((p) => !p.closed);
    if (communityOpen) return communityOpen;
    if (latestPots.length > 0) return latestPots[0];
    return null;
  }, [userPots, latestPots]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            Soft Savings Pots
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
          Save toward a goal.
          <br />
          <span className="text-[var(--accent)]">Breaking it costs you.</span>
        </h1>

        <p className="max-w-xl mx-auto text-sm sm:text-base text-[var(--text-muted)] font-normal leading-relaxed">
          Open a glass jar with an unlock date, a savings target, and a penalty beneficiary.
          Reach your goal or wait for the date to collect free. Need the money early? Break it — the penalty goes to the address you named.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link href="/new">
            <Button size="lg" variant="primary">
              Start a piggy &rarr;
            </Button>
          </Link>
          <Link href="/me">
            <Button size="lg" variant="ghost">
              Check pending claims
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured Large Active Jar Centered Above the Shelf */}
      {featuredPot ? (
        <section className="flex flex-col items-center">
          <div className="text-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {featuredPot.owner.toLowerCase() === userAddress?.toLowerCase()
                ? "Your Active Piggy"
                : "Spotlight Jar"}
            </span>
          </div>

          <Link
            href={`/piggy/${featuredPot.id}`}
            className="group flex flex-col items-center bg-[var(--bg-surface)] p-6 sm:p-8 rounded-3xl border border-[var(--border-strong)] shadow-xl hover:-translate-y-1 transition-all duration-300 max-w-sm w-full"
          >
            <Jar
              balance={featuredPot.balance}
              goal={featuredPot.goal}
              unlockAt={featuredPot.unlockAt}
              closed={featuredPot.closed}
              label={featuredPot.label}
              size="lg"
              nowSec={nowSec}
            />

            <div className="text-center mt-5 space-y-1.5 w-full">
              <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                {featuredPot.label || `Piggy #${featuredPot.id}`}
              </h3>

              <div className="flex items-center justify-center gap-2 mono text-sm font-semibold text-[var(--text-secondary)]">
                <span className="text-[var(--text-primary)] font-bold text-base">
                  {formatEtherShort(featuredPot.balance)}
                </span>
                <span>/</span>
                <span>{formatEtherShort(featuredPot.goal)} BOT</span>
              </div>

              <div className="w-full bg-[var(--border-subtle)] h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round(jarFill(featuredPot.balance, featuredPot.goal) * 100))}%`,
                    background: featuredPot.free ? "var(--success)" : "var(--accent)",
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-2 font-medium">
                <span>{featuredPot.penaltyBps / 100}% penalty</span>
                <span>
                  {featuredPot.closed
                    ? "Closed"
                    : isPotFree(featuredPot.balance, featuredPot.goal, featuredPot.unlockAt, nowSec)
                    ? "Free to collect"
                    : formatTimeRemaining(featuredPot.unlockAt - BigInt(nowSec))}
                </span>
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {/* Your Shelf Section (if connected) */}
      {isConnected && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                Your Shelf
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Savings jars started by your wallet ({userPots.length})
              </p>
            </div>
            <Link href="/new">
              <Button size="sm" variant="ghost">
                + New Piggy
              </Button>
            </Link>
          </div>

          <JarShelf
            pots={userPots}
            emptyMessage="You haven't opened any savings jars yet. Commit to a goal today!"
            activeId={featuredPot?.id}
          />
        </section>
      )}

      {/* Public Community Shelf */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              All Public Piggies
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Recent commitment pots across the network
            </p>
          </div>
          {rawPotCount ? (
            <span className="mono text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              {rawPotCount.toString()} total pots
            </span>
          ) : null}
        </div>

        {isLatestLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 rounded-2xl shimmer-box" />
            ))}
          </div>
        ) : (
          <JarShelf
            pots={latestPots}
            emptyMessage="No piggies found on chain. Be the first to start one!"
            activeId={featuredPot?.id}
          />
        )}
      </section>

      {/* Required Limits Banner Disclosure */}
      <LimitsBanner />
    </div>
  );
}
