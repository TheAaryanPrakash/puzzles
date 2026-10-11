import { motion, useReducedMotion } from "motion/react";
import type { ButtonProps } from "./types";

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-brand-accent text-brand-accent-fg shadow-brand-sm hover:brightness-105",
  secondary:
    "bg-brand-surface-2 text-brand-fg border border-brand-border hover:bg-brand-border",
  ghost: "bg-transparent text-brand-fg hover:bg-brand-surface-2",
  danger: "bg-brand-danger text-white shadow-brand-sm hover:brightness-105",
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-11 px-4 py-2 text-base",
  lg: "min-h-12 px-6 py-3 text-lg",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  fullWidth,
  autoFocus,
  className = "",
  ...rest
}: ButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex touch-manipulation items-center justify-center gap-2 rounded-brand-md font-brand font-semibold transition-colors duration-brand-base ease-brand disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
