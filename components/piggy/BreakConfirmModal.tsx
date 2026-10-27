"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { formatEtherShort, formatShortAddress } from "@/lib/piggy";

export interface BreakConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  toOwner: bigint;
  penalty: bigint;
  penaltyTo: string;
  label: string;
  isPending: boolean;
}

export default function BreakConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  toOwner,
  penalty,
  penaltyTo,
  label,
  isPending,
}: BreakConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="break-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
    >
      <div
        className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl p-6 sm:p-7 shadow-2xl border border-[var(--border-default)] space-y-6"
        style={{ background: "var(--bg-surface)" }}
      >
        <div>
          <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-[var(--bg-base)] text-[var(--danger)] border border-[var(--border-subtle)] mb-2">
            Early Withdrawal
          </span>
          <h2 id="break-modal-title" className="text-xl font-bold text-[var(--text-primary)]">
            Break &ldquo;{label}&rdquo;?
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Breaking your piggy early incurs the committed penalty. This cannot be undone.
          </p>
        </div>

        {/* Breakdown Sheet */}
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)]">You receive now:</span>
            <span className="mono text-base font-bold text-[var(--text-primary)]">
              {formatEtherShort(toOwner)} BOT
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-[var(--danger)]">
                Penalty deduction:
              </span>
              <span className="block text-[11px] text-[var(--text-muted)]">
                goes to {formatShortAddress(penaltyTo)}
              </span>
            </div>
            <span className="mono text-base font-bold text-[var(--danger)]">
              -{formatEtherShort(penalty)} BOT
            </span>
          </div>
        </div>

        {/* Required copy from spec §3.4 */}
        <p className="text-xs text-center font-medium text-[var(--text-secondary)]">
          You get {formatEtherShort(toOwner)} BOT. {formatEtherShort(penalty)} BOT goes to{" "}
          <span className="mono font-semibold" title={penaltyTo}>
            {formatShortAddress(penaltyTo)}
          </span>
          .
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isPending}
          >
            Keep Saving
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onConfirm}
            loading={isPending}
          >
            Confirm Break
          </Button>
        </div>
      </div>
    </div>
  );
}
