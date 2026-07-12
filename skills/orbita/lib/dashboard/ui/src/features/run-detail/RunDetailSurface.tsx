import type { RunDetailDTO } from "@dashboard-contracts";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RunDetailBody } from "./RunDetailBody";
import { DetailError, DetailLoading, MissingSelection } from "./states/DetailStates";
import { useMediaQuery } from "./use-media-query";
import { LANE_LABELS } from "@/features/board/selectors/board-selectors";

type DetailSurfaceProps = {
  detail?: RunDetailDTO | null | undefined;
  isError: boolean;
  isLoading: boolean;
  onClose: () => void;
  onReturnFocus: () => void;
  selectedId?: string | undefined;
  visibleInResults: boolean;
};

export function RunDetailSurface(props: DetailSurfaceProps) {
  const wide = useMediaQuery("(min-width: 1100px)");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (wide === true && props.selectedId) {
      closeRef.current?.focus();
    }
  }, [wide, props.selectedId]);
  if (!props.selectedId) {
    return null;
  }
  if (wide === undefined) {
    return null;
  }
  if (!wide) {
    return (
      <Sheet
        description={props.detail?.workflow ?? "Read-only run details"}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          props.onReturnFocus();
        }}
        onOpenChange={(open) => {
          if (!open) {
            props.onClose();
          }
        }}
        open
        title={props.detail?.title.value ?? "Run details"}
      >
        {detailContent(props)}
      </Sheet>
    );
  }
  const closeWide = () => {
    props.onClose();
    requestAnimationFrame(props.onReturnFocus);
  };
  const body = detailContent({ ...props, onClose: closeWide });
  return (
    <aside
      aria-label="Run details"
      className="detail-panel"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          closeWide();
        }
      }}
      tabIndex={-1}
    >
      <header className="detail-header">
        <div>
          <Badge>{props.detail ? LANE_LABELS[props.detail.laneId] : "Run details"}</Badge>
          <h2 className="detail-title">{props.detail?.title.value ?? "Run details"}</h2>
        </div>
        <Button
          aria-label="Close details"
          onClick={closeWide}
          onKeyDown={(event) => {
            if (event.key === "Tab" && event.shiftKey) {
              event.preventDefault();
              props.onReturnFocus();
            }
          }}
          ref={closeRef}
          size="icon"
          variant="quiet"
        >
          <X aria-hidden="true" size={18} />
        </Button>
      </header>
      {body}
    </aside>
  );
}

function detailContent({
  detail,
  isError,
  isLoading,
  onClose,
  visibleInResults,
}: DetailSurfaceProps) {
  if (!visibleInResults) {
    return <MissingSelection onBack={onClose} />;
  }
  if (isLoading) {
    return <DetailLoading />;
  }
  if (isError || detail === null) {
    return <DetailError />;
  }
  return detail ? <RunDetailBody detail={detail} /> : <DetailLoading />;
}
