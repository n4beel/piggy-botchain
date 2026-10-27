"use client";

import { useState } from "react";
import { parseEther } from "viem";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";

export interface DepositBoxProps {
  potId: bigint;
  onDeposit: (amountWei: bigint) => Promise<void>;
  disabled?: boolean;
}

export default function DepositBox({ potId, onDeposit, disabled }: DepositBoxProps) {
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const presets = ["0.1", "0.5", "1", "5"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountStr || parseFloat(amountStr) <= 0) {
      toast("error", "Invalid deposit", "Please enter an amount greater than 0.");
      return;
    }

    try {
      setLoading(true);
      const wei = parseEther(amountStr);
      await onDeposit(wei);
      setAmountStr("");
    } catch (err: unknown) {
      // Handled by parent or toast
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel variant="surface" className="rounded-2xl border border-[var(--border-default)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Add to this Piggy
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Top up your savings toward your goal anytime.
          </p>
        </div>

        <div className="space-y-2">
          <div className="relative flex items-center">
            <input
              type="number"
              step="any"
              min="0.0001"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.0"
              disabled={disabled || loading}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] mono font-medium focus:outline-none focus:border-[var(--accent)] text-sm"
            />
            <span className="absolute right-4 text-xs font-bold text-[var(--text-muted)] select-none">
              BOT
            </span>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountStr(preset)}
                disabled={disabled || loading}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-colors cursor-pointer disabled:opacity-40"
              >
                +{preset}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={loading}
          disabled={disabled || !amountStr || parseFloat(amountStr) <= 0}
          className="w-full"
        >
          Deposit into Pot
        </Button>
      </form>
    </Panel>
  );
}
