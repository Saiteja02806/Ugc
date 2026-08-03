import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

type LegacyButtonVariant = "primary" | "secondary" | "ghost";

const legacyVariantClasses: Record<LegacyButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-focus",
  secondary:
    "border border-border-strong bg-card text-foreground hover:bg-card-muted focus-visible:ring-focus",
  ghost:
    "text-muted hover:bg-card-muted hover:text-foreground focus-visible:ring-focus",
};

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-border-strong bg-card text-foreground hover:bg-card-muted hover:text-foreground-strong aria-expanded:bg-card-muted aria-expanded:text-foreground-strong",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        muted:
          "border-border-strong bg-card-muted text-muted hover:bg-card hover:text-foreground-strong aria-expanded:bg-card aria-expanded:text-foreground-strong",
        ghost:
          "text-muted hover:bg-card-muted hover:text-foreground aria-expanded:bg-card-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        "creative-reject":
          "border-border-strong bg-card text-error shadow-sm hover:border-error/35 hover:bg-error/10 focus-visible:border-error/60 focus-visible:ring-error/20",
        "creative-accept":
          "border-border-strong bg-card text-success shadow-sm hover:border-success/35 hover:bg-success/10 focus-visible:border-success/60 focus-visible:ring-success/20",
        "creative-edit":
          "border-border-strong bg-card text-foreground shadow-sm hover:bg-card-muted focus-visible:border-ring focus-visible:ring-ring/35",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        auth: "h-12 gap-3 rounded-full px-5",
        "auth-compact": "h-10 gap-2 rounded-full px-4",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        "creative-action":
          "h-11 min-w-0 gap-1.5 rounded-full px-2.5 text-sm font-semibold sm:h-12 sm:gap-2 sm:px-5 [&_svg:not([class*='size-'])]:size-4.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function buttonClassName({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: LegacyButtonVariant;
} = {}) {
  return cn(
    "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    legacyVariantClasses[variant],
    className,
  );
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
