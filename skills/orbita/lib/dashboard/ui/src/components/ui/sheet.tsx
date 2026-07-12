import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

type SheetProps = {
  children: ReactNode;
  description?: string;
  onCloseAutoFocus?: Dialog.DialogContentProps["onCloseAutoFocus"];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function Sheet({
  children,
  description,
  onCloseAutoFocus,
  onOpenChange,
  open,
  title,
}: SheetProps) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content className="sheet-content" onCloseAutoFocus={onCloseAutoFocus}>
          <header className="detail-header">
            <div>
              <Dialog.Title className="detail-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="detail-description">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button aria-label="Close details" size="icon" variant="quiet">
                <X aria-hidden="true" size={18} />
              </Button>
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
