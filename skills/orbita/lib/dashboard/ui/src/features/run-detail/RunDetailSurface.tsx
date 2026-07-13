import type { RunDetailDTO } from "@dashboard-contracts";
import { Sheet } from "@/components/ui/sheet";
import { RunDetailBody } from "./RunDetailBody";
import { DetailError, DetailLoading, MissingSelection } from "./states/DetailStates";

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
  return (
    <Sheet
      description={props.detail?.workflow ?? "Read-only run details"}
      eyebrow={props.detail ? compactRunId(props.detail.runId) : "Run details"}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        props.onReturnFocus();
      }}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
        }
      }}
      open={Boolean(props.selectedId)}
      title={props.detail?.title.value ?? "Run details"}
    >
      {detailContent(props)}
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
