import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover focus-visible:ring-focus",
  secondary:
    "border border-border-strong bg-card text-foreground hover:bg-card-muted focus-visible:ring-focus",
  ghost:
    "text-muted hover:bg-card-muted hover:text-foreground focus-visible:ring-focus",
};

export function buttonClassName({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: ButtonVariant;
} = {}) {
  return cn(
    "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    className,
  );
}
