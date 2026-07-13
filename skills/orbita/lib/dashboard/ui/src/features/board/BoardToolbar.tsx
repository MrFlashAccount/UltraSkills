import type { DashboardLaneId } from "@dashboard-contracts";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select";
import type { FreshnessView } from "@/features/freshness/freshness-selector";
import { ConnectionStatus } from "@/features/freshness/ConnectionStatus";
import { LANE_LABELS, type BoardFilters } from "./selectors/board-selectors";

type ToolbarProps = {
  filters: BoardFilters;
  freshness: FreshnessView;
  onChange: (change: Partial<BoardFilters>) => void;
  total: number;
  workflows: Array<string>;
};

export function BoardToolbar({ filters, freshness, onChange, total, workflows }: ToolbarProps) {
  const clear = () => {
    onChange({ lane: undefined, q: "", workflow: undefined });
  };
  return (
    <header className="toolbar">
      <div className="brand">
        <span aria-hidden="true" className="orb" />
        <h1>Orbita runs</h1>
        <span className="read-only">Read only</span>
      </div>
      <div className="toolbar-controls">
        <label className="search-field">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">Search runs</span>
          <Input
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Search run, workflow, step"
            value={filters.q}
          />
          {filters.q ? (
            <Button
              aria-label="Clear search"
              onClick={() => onChange({ q: "" })}
              size="icon"
              variant="quiet"
            >
              <X aria-hidden="true" size={15} />
            </Button>
          ) : null}
        </label>
        <PopoverRoot>
          <PopoverTrigger asChild>
            <Button variant="quiet">
              <Filter aria-hidden="true" size={15} />
              Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" aria-label="Run filters">
            <SelectField
              allLabel="All workflows"
              label="Workflow"
              onValueChange={(workflow) => onChange({ workflow })}
              options={workflows.map((workflow) => ({ value: workflow, label: workflow }))}
              value={filters.workflow}
            />
            <SelectField
              allLabel="All lanes"
              label="Lane"
              onValueChange={(lane) => onChange({ lane: lane as DashboardLaneId | undefined })}
              options={Object.entries(LANE_LABELS).map(([value, label]) => ({ value, label }))}
              value={filters.lane}
            />
            <Button onClick={clear} variant="quiet">
              Clear filters
            </Button>
          </PopoverContent>
        </PopoverRoot>
        <span className="run-count">{total.toLocaleString()} runs</span>
        <ConnectionStatus freshness={freshness} />
      </div>
    </header>
  );
}
