"use client";

import Link from "next/link";
import Jar from "./Jar";
import { formatEtherShort, isPotFree, jarFill } from "@/lib/piggy";

export interface ShelfJarItem {
  id: bigint;
  owner: string;
  penaltyTo: string;
  goal: bigint;
  balance: bigint;
  unlockAt: bigint;
  penaltyBps: number;
  closed: boolean;
  label: string;
  free?: boolean;
}

export interface JarShelfProps {
  pots: ShelfJarItem[];
  emptyMessage?: string;
  activeId?: bigint;
}

export default function JarShelf({ pots, emptyMessage = "No jars on this shelf yet.", activeId }: JarShelfProps) {
  if (pots.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-base)] flex items-center justify-center text-xl">
          🏺
        </div>
        <p className="text-sm font-semibold text-[var(--text-muted)]">{emptyMessage}</p>
        <Link
          href="/new"
          className="inline-block text-xs font-bold text-[var(--accent)] hover:underline"
        >
          Open a new piggy &rarr;
        </Link>
      </div>
    );
  }

  // Chunk pots into groups of 4 for the shelf beams on wide screens
  return (
    <div className="space-y-8">
      {/* 4 jars across on desktop (lg), 2 on tablet (sm/md), 1 on phone (360px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {pots.map((pot) => {
          const isFree = pot.free !== undefined ? pot.free : isPotFree(pot.balance, pot.goal, pot.unlockAt, Math.floor(Date.now() / 1000));
          const fill = jarFill(pot.balance, pot.goal);
          const isActive = activeId !== undefined && pot.id === activeId;

          return (
            <Link
              key={pot.id.toString()}
              href={`/piggy/${pot.id}`}
              className={[
                "group relative flex flex-col items-center bg-[var(--bg-surface)] rounded-2xl p-5 border transition-all duration-200",
                "hover:-translate-y-1 hover:shadow-lg",
                isActive
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                  : "border-[var(--border-default)]",
              ].join(" ")}
            >
              {/* Status pill badge */}
              <div className="w-full flex items-center justify-between gap-2 mb-2">
                <span className="mono text-[10px] text-[var(--text-muted)] font-bold">
                  #{pot.id.toString()}
                </span>
                {pot.closed ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--border-subtle)] text-[var(--text-muted)]">
                    Closed
                  </span>
                ) : isFree ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[var(--success)] border border-emerald-300">
                    Free Exit
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-base)] text-[var(--accent)] border border-[var(--border-subtle)]">
                    Saving
                  </span>
                )}
              </div>

              {/* Jar Graphic */}
              <div className="my-2">
                <Jar
                  balance={pot.balance}
                  goal={pot.goal}
                  unlockAt={pot.unlockAt}
                  closed={pot.closed}
                  label={pot.label}
                  size="sm"
                />
              </div>

              {/* Jar Info */}
              <div className="w-full text-center mt-3 space-y-1">
                <h4 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                  {pot.label || `Piggy #${pot.id}`}
                </h4>

                <div className="flex items-center justify-center gap-1.5 mono text-xs font-semibold text-[var(--text-secondary)]">
                  <span className="text-[var(--text-primary)]">{formatEtherShort(pot.balance)}</span>
                  <span>/</span>
                  <span>{formatEtherShort(pot.goal)} BOT</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[var(--border-subtle)] h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round(fill * 100))}%`,
                      background: isFree ? "var(--success)" : "var(--accent)",
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Decorative Wooden Shelf Beam under the jars */}
      <div className="shelf-beam h-3 w-full" aria-hidden="true" />
    </div>
  );
}
