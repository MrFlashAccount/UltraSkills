import { X } from "lucide-react";
import { type ReactNode, useEffect, useEffectEvent } from "react";
import { Button } from "./button";

type SheetProps = {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  onCloseAutoFocus?: (event: { preventDefault(): void }) => void;
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
  const closeFromEscape = useEffectEvent(() => {
    onOpenChange(false);
    queueMicrotask(() => onCloseAutoFocus?.({ preventDefault() {} }));
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (document.querySelector('[role="dialog"]')) {
        return;
      }
      event.preventDefault();
      closeFromEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <aside aria-label={title} className="sheet-content" data-state="open">
      <header className="detail-header">
        <div>
          {eyebrow ? <span className="sheet-eyebrow">{eyebrow}</span> : null}
          <h2 className="detail-title">{title}</h2>
          {description ? <p className="detail-description">{description}</p> : null}
        </div>
        <Button
          aria-label="Close details"
          onClick={() => {
            onOpenChange(false);
            queueMicrotask(() => onCloseAutoFocus?.({ preventDefault() {} }));
          }}
          size="icon"
          variant="quiet"
        >
          <X aria-hidden="true" size={18} />
        </Button>
      </header>
      {children}
    </aside>
  );
}
