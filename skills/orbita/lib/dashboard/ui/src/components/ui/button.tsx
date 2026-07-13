import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva("ui-button", {
  defaultVariants: { variant: "default", size: "default" },
  variants: {
    variant: {
      default: "ui-button-default",
      danger: "ui-button-danger",
      ghost: "ui-button-ghost",
      quiet: "ui-button-quiet",
    },
    size: { default: "ui-button-md", icon: "ui-button-icon" },
  },
});

type ButtonProps = ComponentPropsWithRef<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ asChild, className, size, variant, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
