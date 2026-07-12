import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva('ui-button', {
  variants: { variant: { default: 'ui-button-default', quiet: 'ui-button-quiet', danger: 'ui-button-danger' }, size: { default: 'ui-button-md', icon: 'ui-button-icon' } },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ asChild, className, variant, size, ...props }, ref) {
  const Component = asChild ? Slot.Root : 'button';
  return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
