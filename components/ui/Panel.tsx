import { HTMLAttributes, ReactNode } from "react";

export interface PiggyPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "surface" | "elevated" | "shelf";
  tag?: string;
  badge?: ReactNode;
  title?: string;
  subtitle?: string;
  noPadding?: boolean;
}

export default function Panel({
  variant = "surface",
  tag,
  badge,
  title,
  subtitle,
  noPadding = false,
  children,
  className = "",
  style,
  ...props
}: PiggyPanelProps) {
  const bg =
    variant === "glass"
      ? "var(--jar-glass)"
      : variant === "elevated"
      ? "var(--bg-elevated)"
      : variant === "shelf"
      ? "color-mix(in srgb, var(--border-subtle) 40%, var(--bg-surface))"
      : "var(--bg-surface)";

  return (
    <section
      className={[
        "relative rounded-2xl transition-all",
        noPadding ? "p-0" : "p-5 sm:p-7",
        className,
      ].join(" ")}
      style={{
        background: bg,
        border: "1px solid var(--border-default)",
        boxShadow: "0 2px 14px var(--jar-shadow)",
        ...style,
      }}
      {...props}
    >
      {(tag || title || badge) && (
        <header className="flex items-start justify-between gap-4 mb-5 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            {tag && (
              <span className="inline-block px-2.5 py-0.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                {tag}
              </span>
            )}
            {title && (
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {badge && <div className="flex-shrink-0">{badge}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
