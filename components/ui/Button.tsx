"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

export type ButtonVariant = "primary" | "collect" | "break" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "1px solid var(--accent)",
  },
  collect: {
    background: "var(--success)",
    color: "#FFFFFF",
    border: "1px solid var(--success)",
  },
  break: {
    background: "transparent",
    border: "1px solid var(--border-default)",
    color: "var(--text-muted)",
  },
  ghost: {
    background: "transparent",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
  },
  danger: {
    background: "var(--danger)",
    color: "#FFFFFF",
    border: "1px solid var(--danger)",
  },
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-medium rounded-lg",
  md: "px-5 py-2.5 text-sm font-semibold rounded-xl",
  lg: "px-6 py-3.5 text-base font-semibold rounded-2xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      className = "",
      style,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2",
          "transition-all cursor-pointer select-none",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "active:scale-[0.98]",
          sizeStyles[size],
          className,
        ].join(" ")}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
