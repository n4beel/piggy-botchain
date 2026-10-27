"use client";

import { useMemo } from "react";
import { formatEther } from "viem";
import { jarFill, isPotFree, formatTimeRemaining, formatEtherShort } from "@/lib/piggy";

export interface JarProps {
  balance: bigint;
  goal: bigint;
  unlockAt: bigint;
  closed?: boolean;
  label?: string;
  size?: "lg" | "md" | "sm";
  nowSec?: number | bigint;
}

export default function Jar({
  balance,
  goal,
  unlockAt,
  closed = false,
  label = "Savings Jar",
  size = "md",
  nowSec,
}: JarProps) {
  const currentNow = nowSec ? BigInt(nowSec) : BigInt(Math.floor(Date.now() / 1000));
  const fill = jarFill(balance, goal);
  const free = isPotFree(balance, goal, unlockAt, currentNow);

  const dimensions = useMemo(() => {
    switch (size) {
      case "lg":
        return { width: 220, height: 280, scale: 1.1 };
      case "sm":
        return { width: 110, height: 140, scale: 0.55 };
      case "md":
      default:
        return { width: 150, height: 195, scale: 0.75 };
    }
  }, [size]);

  // Max 8 coin tiers stacked from bottom (y = 215) to goal line (y = 80)
  const coinLayers = useMemo(() => {
    if (balance === 0n) return [];
    const maxTiers = 8;
    const count = Math.min(maxTiers, Math.max(1, Math.ceil(fill * maxTiers)));
    const layers = [];
    const bottomY = 212;
    const topY = 90;
    const step = (bottomY - topY) / maxTiers;

    for (let i = 0; i < count; i++) {
      const y = bottomY - i * step;
      layers.push({ id: i, y, cx: 100 });
    }
    return layers;
  }, [balance, fill]);

  const unlockDate = new Date(Number(unlockAt) * 1000);
  const formattedDate = unlockDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const accessibleDesc = closed
    ? `${label}: Pot is closed and withdrawn.`
    : `${label}: ${formatEtherShort(balance)} of ${formatEtherShort(goal)} BOT saved (${Math.round(
        fill * 100,
      )}% of goal). ${free ? "Ready to withdraw free" : `Locked until ${formattedDate}`}.`;

  return (
    <div className="flex flex-col items-center select-none" title={accessibleDesc}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 200 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={accessibleDesc}
        className="transition-transform duration-300 hover:scale-[1.02]"
      >
        <title>{accessibleDesc}</title>
        <desc>{accessibleDesc}</desc>

        <defs>
          {/* Glass jar gradient */}
          <linearGradient id="jarGlassGrad" x1="20" y1="20" x2="180" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#F9EBF0" stopOpacity="0.8" />
          </linearGradient>

          {/* Golden coin gradient */}
          <linearGradient id="goldCoinGrad" x1="60" y1="0" x2="140" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F5D061" />
            <stop offset="50%" stopColor="#E5A93C" />
            <stop offset="100%" stopColor="#C48720" />
          </linearGradient>

          {/* Soft shadow under jar */}
          <radialGradient id="jarShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(58, 16, 32, 0.16)" />
            <stop offset="100%" stopColor="rgba(58, 16, 32, 0)" />
          </radialGradient>
        </defs>

        {/* Ambient shadow underneath */}
        <ellipse cx="100" cy="246" rx="68" ry="10" fill="url(#jarShadow)" />

        {/* Closed Pot Break Indicator (if closed) */}
        {closed ? (
          <g opacity="0.6">
            {/* Faded empty jar */}
            <path
              d="M60 28H140V40H60V28Z M50 40H150V52H50V40Z M35 68C35 56 46 48 58 48H142C154 48 165 56 165 68V210C165 226 150 238 134 238H66C50 238 35 226 35 210V68Z"
              fill="rgba(255, 255, 255, 0.5)"
              stroke="var(--border-default)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            {/* Red 'Closed' Stamp */}
            <rect x="52" y="125" width="96" height="30" rx="6" fill="var(--bg-surface)" stroke="var(--danger)" strokeWidth="2" />
            <text x="100" y="145" textAnchor="middle" fill="var(--danger)" fontSize="13" fontWeight="bold" letterSpacing="1">
              CLOSED
            </text>
          </g>
        ) : (
          <>
            {/* Jar Body Fill */}
            <path
              d="M34 68C34 54 45 46 58 46H142C155 46 166 54 166 68V208C166 225 151 238 134 238H66C49 238 34 225 34 208V68Z"
              fill="url(#jarGlassGrad)"
              stroke="var(--border-strong)"
              strokeWidth="2.5"
            />

            {/* Stacked Gold Coins */}
            <g className="coin-animate">
              {coinLayers.map((coin) => (
                <g key={coin.id}>
                  {/* 3D coin edge */}
                  <ellipse cx={coin.cx} cy={coin.y + 3} rx="46" ry="12" fill="#B3781A" />
                  {/* Coin face */}
                  <ellipse
                    cx={coin.cx}
                    cy={coin.y}
                    rx="46"
                    ry="12"
                    fill="url(#goldCoinGrad)"
                    stroke="#D69428"
                    strokeWidth="1.2"
                  />
                  {/* Inner coin embossed ring */}
                  <ellipse cx={coin.cx} cy={coin.y} rx="38" ry="9" fill="none" stroke="#FCE89B" strokeWidth="0.8" opacity="0.6" />
                </g>
              ))}
            </g>

            {/* Goal Line (Dashed red/teal line) */}
            <g>
              <line
                x1="36"
                y1="82"
                x2="164"
                y2="82"
                stroke={fill >= 1 ? "var(--success)" : "var(--accent)"}
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {/* Goal label tag on the left */}
              <rect x="36" y="70" width="38" height="15" rx="3" fill="var(--bg-surface)" stroke="var(--border-subtle)" strokeWidth="1" />
              <text x="55" y="81" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="700">
                GOAL
              </text>
            </g>

            {/* Specular curved reflection on left wall */}
            <path
              d="M44 76C42 105 42 170 45 204"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Jar Glass Neck & Collar Ring */}
            <rect
              x="48"
              y="38"
              width="104"
              height="10"
              rx="3"
              fill="var(--bg-surface)"
              stroke="var(--border-strong)"
              strokeWidth="2"
            />
            {/* Top Glass Lid Rim */}
            <rect
              x="56"
              y="26"
              width="88"
              height="14"
              rx="4"
              fill="var(--border-subtle)"
              stroke="var(--border-strong)"
              strokeWidth="2"
            />
            {/* Wire Clamp Ring */}
            <line x1="52" y1="33" x2="148" y2="33" stroke="var(--border-strong)" strokeWidth="2.5" />

            {/* Hanging Padlock Date Tag on Right Rim */}
            <g transform="translate(142, 28)">
              {/* String / wire */}
              <path d="M0 6 C 6 12, 10 18, 12 24" stroke="var(--border-strong)" strokeWidth="1.5" fill="none" />
              {/* Tag Body */}
              <g transform="translate(2, 22)">
                <rect
                  x="0"
                  y="0"
                  width="44"
                  height="34"
                  rx="6"
                  fill="var(--bg-surface)"
                  stroke={free ? "var(--success)" : "var(--border-strong)"}
                  strokeWidth="1.5"
                  filter="drop-shadow(0 2px 4px rgba(58,16,32,0.1))"
                />
                {/* Hole for wire */}
                <circle cx="6" cy="6" r="2" fill="var(--border-strong)" />

                {/* Padlock Icon */}
                {free ? (
                  // Open Padlock in Green
                  <g transform="translate(16, 8)">
                    <path
                      d="M5 6V3C5 1.9 5.9 1 7 1C8.1 1 9 1.9 9 3V4"
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <rect x="2" y="6" width="10" height="8" rx="2" fill="var(--success)" />
                    <circle cx="7" cy="10" r="1" fill="#FFFFFF" />
                  </g>
                ) : (
                  // Closed Padlock in Wine
                  <g transform="translate(16, 8)">
                    <rect x="2" y="6" width="10" height="8" rx="2" fill="var(--text-primary)" />
                    <path
                      d="M4 6V3.5C4 2.1 5.3 1 7 1C8.7 1 10 2.1 10 3.5V6"
                      fill="none"
                      stroke="var(--text-primary)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="7" cy="10" r="1" fill="#FFFFFF" />
                  </g>
                )}

                {/* Status text */}
                <text
                  x="22"
                  y="28"
                  textAnchor="middle"
                  fill={free ? "var(--success)" : "var(--text-muted)"}
                  fontSize="7.5"
                  fontWeight="700"
                >
                  {free ? "FREE" : "LOCKED"}
                </text>
              </g>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
