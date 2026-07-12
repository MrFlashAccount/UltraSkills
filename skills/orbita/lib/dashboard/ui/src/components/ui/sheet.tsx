import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onCloseAutoFocus?: Dialog.DialogContentProps['onCloseAutoFocus'];
};

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onCloseAutoFocus,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
              <Button variant="quiet" size="icon" aria-label="Close details">
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
