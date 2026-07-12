import { Tooltip } from "radix-ui";

export function TooltipLabel({
  children,
  label,
}: Readonly<{ children: React.ReactNode; label: string }>) {
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
