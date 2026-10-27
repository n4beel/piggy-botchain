"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { isAddress, parseEther, type Address } from "viem";
import { piggyAbi } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import {
  MIN_PENALTY_BPS,
  MAX_PENALTY_BPS,
  MAX_LABEL,
  MAX_LOCK,
  penaltyBpsToPercent,
  percentToPenaltyBps,
  formatPenaltyPercent,
} from "@/lib/piggy";
import { describeError } from "@/lib/errors";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import Jar from "@/components/piggy/Jar";
import LimitsBanner from "@/components/piggy/LimitsBanner";
import { useToast } from "@/components/ui/Toast";

export default function NewPiggyPage() {
  const router = useRouter();
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);

  // Form State
  const [label, setLabel] = useState("");
  const [goalStr, setGoalStr] = useState("10");
  const [depositStr, setDepositStr] = useState("1");
  const [penaltyBps, setPenaltyBps] = useState(1500); // 15% default
  const [penaltyTo, setPenaltyTo] = useState("");
  const [understand, setUnderstand] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date picker state (default: 30 days from now)
  const defaultDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [unlockDateStr, setUnlockDateStr] = useState(defaultDateStr);

  const { writeContractAsync } = useWriteContract();

  // Calculated values
  const unlockTimestamp = useMemo(() => {
    if (!unlockDateStr) return 0n;
    const d = new Date(`${unlockDateStr}T23:59:59Z`);
    return BigInt(Math.floor(d.getTime() / 1000));
  }, [unlockDateStr]);

  const goalWei = useMemo(() => {
    try {
      return goalStr && parseFloat(goalStr) > 0 ? parseEther(goalStr) : parseEther("10");
    } catch {
      return parseEther("10");
    }
  }, [goalStr]);

  const depositWei = useMemo(() => {
    try {
      return depositStr && parseFloat(depositStr) > 0 ? parseEther(depositStr) : parseEther("1");
    } catch {
      return parseEther("1");
    }
  }, [depositStr]);

  // Validation
  const validationError = useMemo(() => {
    if (!label.trim()) return "Please give your piggy a label.";
    if (new TextEncoder().encode(label).length > MAX_LABEL) {
      return `Label must be ${MAX_LABEL} bytes or fewer.`;
    }
    if (!goalStr || parseFloat(goalStr) <= 0) return "Goal must be greater than 0.";
    if (!depositStr || parseFloat(depositStr) <= 0) return "Opening deposit must be greater than 0.";

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (unlockTimestamp <= now) return "Unlock date must be in the future.";
    if (unlockTimestamp > now + BigInt(MAX_LOCK)) return "Unlock date cannot exceed 10 years.";

    if (penaltyBps < MIN_PENALTY_BPS || penaltyBps > MAX_PENALTY_BPS) {
      return "Penalty must be between 1% and 50%.";
    }

    if (!penaltyTo || !isAddress(penaltyTo)) {
      return "Enter a valid Ethereum / BotChain address for the penalty recipient.";
    }

    if (userAddress && penaltyTo.toLowerCase() === userAddress.toLowerCase()) {
      return "The penalty address cannot be yourself.";
    }

    if (deployment.address && penaltyTo.toLowerCase() === deployment.address.toLowerCase()) {
      return "The penalty address cannot be the Piggy contract.";
    }

    if (!understand) {
      return "You must confirm you understand the penalty recipient receives the penalty on early break.";
    }

    return null;
  }, [label, goalStr, depositStr, unlockTimestamp, penaltyBps, penaltyTo, userAddress, deployment.address, understand]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) {
      toast("error", "Cannot start piggy", validationError);
      return;
    }

    if (!deployed) {
      toast("error", "Contract not deployed", "Piggy contract is not deployed on this network.");
      return;
    }

    try {
      setIsSubmitting(true);
      const hash = await writeContractAsync({
        address: deployment.address,
        abi: piggyAbi,
        functionName: "open",
        args: [
          goalWei,
          unlockTimestamp,
          penaltyBps,
          penaltyTo as Address,
          label.trim(),
        ],
        value: depositWei,
      });

      toast("info", "Opening piggy...", "Transaction broadcast to the network.");
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        toast("success", "Piggy started!", "Your new savings jar is on the shelf.");
        router.push("/");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      toast("error", "Could not start piggy", describeError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-primary)]">
          Start a Piggy
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-lg mx-auto">
          Save toward a goal. Breaking it costs you. Choose a date, a penalty, and the person who receives it if you quit early.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Container (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          <Panel variant="surface" className="rounded-2xl border border-[var(--border-default)] space-y-5 p-6 sm:p-7">
            {/* Label */}
            <div className="space-y-1.5">
              <label htmlFor="pot-label" className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Pot Label
              </label>
              <input
                id="pot-label"
                type="text"
                maxLength={40}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. New Laptop, Japan Trip, Rainy Day"
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:border-[var(--accent)]"
                required
              />
              <span className="block text-[11px] text-[var(--text-muted)] text-right">
                {new TextEncoder().encode(label).length} / 40 bytes
              </span>
            </div>

            {/* Target Goal & Opening Deposit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="goal-input" className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Savings Goal (BOT)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="goal-input"
                    type="number"
                    step="any"
                    min="0.001"
                    value={goalStr}
                    onChange={(e) => setGoalStr(e.target.value)}
                    placeholder="10"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] mono font-bold text-sm focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                  <span className="absolute right-3 text-xs font-bold text-[var(--text-muted)] select-none">
                    BOT
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="deposit-input" className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Opening Deposit (BOT)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="deposit-input"
                    type="number"
                    step="any"
                    min="0.0001"
                    value={depositStr}
                    onChange={(e) => setDepositStr(e.target.value)}
                    placeholder="1"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] mono font-bold text-sm focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                  <span className="absolute right-3 text-xs font-bold text-[var(--text-muted)] select-none">
                    BOT
                  </span>
                </div>
              </div>
            </div>

            {/* Target Unlock Date */}
            <div className="space-y-1.5">
              <label htmlFor="unlock-date" className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Free Unlock Date
              </label>
              <input
                id="unlock-date"
                type="date"
                value={unlockDateStr}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setUnlockDateStr(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:border-[var(--accent)]"
                required
              />
              <p className="text-[11px] text-[var(--text-muted)]">
                On or after this date (or whenever the goal is reached), withdrawals are 100% free with zero penalty.
              </p>
            </div>

            {/* Penalty Slider */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="penalty-slider" className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Early Break Penalty
                  </label>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Deducted from your balance if you withdraw before unlock
                  </p>
                </div>
                <span className="mono text-lg font-extrabold text-[var(--danger)]">
                  {formatPenaltyPercent(penaltyBps)}
                </span>
              </div>

              <input
                id="penalty-slider"
                type="range"
                min="1"
                max="50"
                step="1"
                value={penaltyBpsToPercent(penaltyBps)}
                onChange={(e) => setPenaltyBps(percentToPenaltyBps(Number(e.target.value)))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />

              {/* Penalty Presets */}
              <div className="flex items-center gap-2">
                {[10, 15, 20, 30, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPenaltyBps(percentToPenaltyBps(pct))}
                    className={[
                      "text-xs font-semibold px-2.5 py-1 rounded-md border transition-all cursor-pointer",
                      penaltyBpsToPercent(penaltyBps) === pct
                        ? "bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]"
                        : "bg-[var(--bg-base)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:border-[var(--border-default)]",
                    ].join(" ")}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Penalty Recipient Address */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <label htmlFor="penalty-to" className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Penalty Beneficiary Address
              </label>
              <input
                id="penalty-to"
                type="text"
                value={penaltyTo}
                onChange={(e) => setPenaltyTo(e.target.value.trim())}
                placeholder="0x... (friend, charity, or partner)"
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] mono text-xs font-medium focus:outline-none focus:border-[var(--accent)]"
                required
              />
              <p className="text-[11px] text-[var(--text-muted)]">
                The penalty goes to this address — chosen now, fixed forever. It cannot be you.
              </p>
            </div>

            {/* Required Confirmation Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={understand}
                  onChange={(e) => setUnderstand(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer"
                />
                <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  I understand that if I break this piggy early,{" "}
                  <strong className="text-[var(--danger)]">
                    {formatPenaltyPercent(penaltyBps)}
                  </strong>{" "}
                  will be credited directly to the penalty beneficiary address and cannot be refunded.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={!isConnected || Boolean(validationError)}
              className="w-full"
            >
              {isConnected ? "Start a piggy" : "Connect wallet to open"}
            </Button>
          </Panel>
        </form>

        {/* Live Jar Preview Container (5 cols) */}
        <aside className="lg:col-span-5 space-y-6">
          <Panel variant="elevated" className="rounded-2xl border border-[var(--border-default)] p-6 text-center space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Live Jar Preview
            </span>

            <div className="py-2">
              <Jar
                balance={depositWei}
                goal={goalWei}
                unlockAt={unlockTimestamp}
                label={label || "New Piggy"}
                size="lg"
              />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-[var(--text-primary)] truncate">
                {label || "My New Piggy"}
              </h3>
              <p className="mono text-xs text-[var(--text-secondary)] font-semibold">
                {depositStr || "0"} / {goalStr || "0"} BOT
              </p>
            </div>

            <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-subtle)] space-y-1 text-left">
              <div className="flex justify-between">
                <span>Unlock target:</span>
                <span className="font-semibold text-[var(--text-primary)]">{unlockDateStr}</span>
              </div>
              <div className="flex justify-between">
                <span>Penalty rate:</span>
                <span className="font-semibold text-[var(--danger)]">{formatPenaltyPercent(penaltyBps)}</span>
              </div>
              <div className="flex justify-between">
                <span>Break brake:</span>
                <span className="font-semibold text-[var(--text-primary)]">Soft Lock</span>
              </div>
            </div>
          </Panel>

          <LimitsBanner penaltyTo={penaltyTo || undefined} />
        </aside>
      </div>
    </div>
  );
}
