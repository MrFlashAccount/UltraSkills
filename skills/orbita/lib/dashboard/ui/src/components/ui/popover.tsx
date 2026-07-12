import { Popover } from 'radix-ui';
export const PopoverRoot = Popover.Root;
export const PopoverTrigger = Popover.Trigger;
export const PopoverClose = Popover.Close;

export function PopoverContent({ children, ...props }: Popover.PopoverContentProps) {
  return <Popover.Portal><Popover.Content className="ui-popover" sideOffset={8} {...props}>{children}</Popover.Content></Popover.Portal>;
}
