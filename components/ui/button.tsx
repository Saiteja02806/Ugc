import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-hover focus-visible:outline-primary",
  secondary:
    "border border-border bg-card text-foreground hover:bg-card-muted focus-visible:outline-primary",
  ghost: "text-muted hover:bg-card-muted hover:text-foreground focus-visible:outline-primary",
};

export function buttonClassName({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: ButtonVariant;
} = {}) {
  return cn(
    "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    variantClasses[variant],
    className,
  );
}
