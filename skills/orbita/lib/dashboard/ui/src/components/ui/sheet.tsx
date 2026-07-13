import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "./button";

type SheetProps = {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  onCloseAutoFocus?: Dialog.DialogContentProps["onCloseAutoFocus"];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function Sheet({
  children,
  description,
  eyebrow,
  onCloseAutoFocus,
  onOpenChange,
  open,
  title,
}: SheetProps) {
  const openCloseAutoFocus = useRef(onCloseAutoFocus);
  useEffect(() => {
    if (open) {
      openCloseAutoFocus.current = onCloseAutoFocus;
    }
  }, [onCloseAutoFocus, open]);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="sheet-content"
          onCloseAutoFocus={(event) => openCloseAutoFocus.current?.(event)}
        >
          <header className="detail-header">
            <div>
              {eyebrow ? <span className="sheet-eyebrow">{eyebrow}</span> : null}
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
