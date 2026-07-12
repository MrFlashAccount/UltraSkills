import { Tooltip } from 'radix-ui';

export function TooltipLabel({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="ui-tooltip" sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
