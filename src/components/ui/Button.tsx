/**
 * components/ui/Button.tsx
 * Reusable button with built-in loading spinner state.
 * Variants: primary | secondary | danger | ghost
 */

"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const VARIANTS = {
  primary:   "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500",
  secondary: "bg-transparent hover:bg-white/5 text-slate-300 border border-slate-600",
  danger:    "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40",
  ghost:     "bg-transparent hover:bg-white/5 text-slate-400 border border-transparent",
};
const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-sm",
};

export default function Button({
  variant = "primary",
  loading  = false,
  size     = "md",
  children,
  disabled,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        "transition-all duration-150 cursor-pointer select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(" ")}
    >
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}
