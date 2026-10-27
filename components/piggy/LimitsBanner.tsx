import Panel from "@/components/ui/Panel";

export interface LimitsBannerProps {
  penaltyTo?: string;
  className?: string;
}

export default function LimitsBanner({ penaltyTo, className = "" }: LimitsBannerProps) {
  const penaltyNotice = penaltyTo
    ? `The penalty goes to ${penaltyTo} — chosen now, fixed forever.`
    : "The penalty goes to your chosen address — chosen now, fixed forever.";

  return (
    <Panel
      variant="elevated"
      className={["rounded-2xl border border-[var(--border-default)]", className].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: "var(--bg-base)",
            border: "1.5px solid var(--border-default)",
          }}
          aria-hidden="true"
        >
          <span className="text-lg">🛡️</span>
        </div>

        <div className="space-y-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
              This is not a lock
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Piggy is a commitment device with financial gravity, not an immutable prison.
            </p>
          </div>

          <ul className="text-xs space-y-1.5 text-[var(--text-secondary)] list-disc pl-4">
            <li>
              <strong className="text-[var(--text-primary)]">You can always break it.</strong> The
              penalty is the only brake.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">{penaltyNotice}</strong> It cannot be
              redirected or changed.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Nobody else can touch your balance.</strong> Even
              the penalty recipient cannot move your savings.
            </li>
          </ul>
        </div>
      </div>
    </Panel>
  );
}
