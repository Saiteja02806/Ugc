"use client";

import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type { VariantProps } from "class-variance-authority";

import { toggleVariants } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    orientation?: "horizontal" | "vertical";
    spacing?: number;
  }
>({
  orientation: "horizontal",
  size: "default",
  spacing: 2,
  variant: "default",
});

function ToggleGroup({
  children,
  className,
  orientation = "horizontal",
  size,
  spacing = 2,
  variant,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
  }) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-orientation={orientation}
      data-size={size}
      data-spacing={spacing}
      data-variant={variant}
      orientation={orientation}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-vertical:flex-col data-vertical:items-stretch",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ orientation, size, spacing, variant }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  children,
  className,
  size = "default",
  variant = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-orientation={context.orientation}
      data-size={context.size}
      data-spacing={context.spacing}
      data-variant={context.variant}
      className={cn(
        toggleVariants({
          size: context.size || size,
          variant: context.variant || variant,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
