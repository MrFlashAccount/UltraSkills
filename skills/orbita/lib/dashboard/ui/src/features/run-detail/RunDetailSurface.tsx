import type { RunLightDetailDTO } from "@dashboard-contracts";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { RunDetailBody } from "./RunDetailBody";
import { DetailError, DetailLoading, MissingSelection } from "./states/DetailStates";

type DetailSurfaceProps = {
  detail?: RunLightDetailDTO | null | undefined;
  isError: boolean;
  isLoading: boolean;
  onClose: () => void;
  onReturnFocus: () => void;
  selectedId?: string | undefined;
  visibleInResults: boolean;
};

export function RunDetailSurface(props: DetailSurfaceProps) {
  const [closingSnapshot, setClosingSnapshot] = useState<DetailSurfaceProps | null>(null);
  const visible = props.selectedId ? props : (closingSnapshot ?? props);

  return (
    <Sheet
      description={visible.detail?.run.workflow ?? "Read-only run details"}
      eyebrow={visible.detail ? compactRunId(visible.detail.run.runId) : "Run details"}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        props.onReturnFocus();
      }}
      onOpenChange={(open) => {
        if (!open) {
          setClosingSnapshot(props);
          props.onClose();
        }
      }}
      open={Boolean(props.selectedId)}
      title={visible.detail?.run.title.value ?? "Run details"}
    >
      {detailContent(visible)}
    </Sheet>
  );
}

function compactRunId(runId: string): string {
  return runId.length > 24 ? `${runId.slice(0, 12)}…${runId.slice(-5)}` : runId;
}

function detailContent({
  detail,
  isError,
  isLoading,
  onClose,
  selectedId,
  visibleInResults,
}: DetailSurfaceProps) {
  if (selectedId && !visibleInResults) {
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
