"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

export interface PageShellProps {
  children: React.ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  const currentPath = usePathname();

  const navLinks = [
    { href: "/", label: "Jar Shelf" },
    { href: "/new", label: "Start a Piggy" },
    { href: "/me", label: "My Claims" },
  ];

  return (
    <div className="piggy-stage flex flex-col min-h-screen relative overflow-x-hidden">
      {/* Soft blush atmosphere gradient */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 10%, rgba(255, 255, 255, 0.6) 0%, transparent 60%), linear-gradient(180deg, #FDF0F3 0%, #FBE3E8 100%)",
        }}
        aria-hidden="true"
      />

      {/* Top Shelf Bar */}
      <nav
        aria-label="Main Navigation"
        className="sticky top-0 z-50 w-full backdrop-blur-md shadow-xs transition-colors"
        style={{
          background: "rgba(255, 255, 255, 0.88)",
          borderBottom: "1.5px solid var(--border-default)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-3 group select-none"
              title="Return to Jar Shelf"
            >
              {/* Distinctive Jar Emblem */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                style={{
                  background: "var(--bg-base)",
                  border: "1.5px solid var(--border-strong)",
                  boxShadow: "0 2px 6px var(--jar-shadow)",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 4H17M6 7H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="8"
                    y1="12"
                    x2="16"
                    y2="12"
                    stroke="var(--coin-gold)"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                  />
                  <circle cx="12" cy="16" r="2.5" fill="var(--coin-gold)" />
                </svg>
              </div>

              <div>
                <span className="block text-lg font-extrabold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-none">
                  {app.name}
                </span>
                <span className="block text-[11px] font-medium text-[var(--text-muted)] mt-1 tracking-normal leading-none">
                  Commitment pots
                </span>
              </div>
            </Link>

            <ul className="hidden md:flex items-center gap-2 list-none m-0 p-0">
              {navLinks.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={[
                        "text-xs font-semibold px-3 py-1.5 rounded-lg transition-all",
                        isActive
                          ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)]",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Main Stage */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {children}
      </main>

      {/* Ground Trim Footer with Shared UI Contract */}
      <footer
        className="w-full mt-auto py-8 text-xs text-[var(--text-muted)]"
        style={{
          background: "var(--bg-surface)",
          borderTop: "1.5px solid var(--border-default)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <aside className="text-center md:text-left space-y-1">
            <p className="font-bold text-[var(--text-primary)]">
              {app.name} · Soft savings lock
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Breakable at any time. The penalty is your only brake.
            </p>
          </aside>

          <nav
            aria-label="BotChain Ecosystem Links"
            className="flex flex-wrap items-center justify-center gap-6"
          >
            <BuiltOnBotChain className="text-[var(--text-muted)] hover:text-[var(--accent)] font-medium transition-colors" />
            <a
              href="https://scan.botchain.ai"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--accent)] font-medium transition-colors"
            >
              Block Explorer
            </a>
            <a
              href="https://botchain.ai"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--accent)] font-medium transition-colors"
            >
              botchain.ai
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
