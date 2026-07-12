import type { DashboardLaneId } from '@dashboard-contracts';
import { Filter, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/ui/popover';
import { SelectField } from '@/components/ui/select';
import type { FreshnessView } from '@/features/freshness/freshness-selector';
import { ConnectionStatus } from '@/features/freshness/ConnectionStatus';
import { LANE_LABELS, type BoardFilters } from './selectors/board-selectors';

type ToolbarProps = {
  filters: BoardFilters;
  workflows: string[];
  total: number;
  freshness: FreshnessView;
  onChange: (change: Partial<BoardFilters>) => void;
};

export function BoardToolbar({ filters, workflows, total, freshness, onChange }: ToolbarProps) {
  const [query, setQuery] = useState(filters.q);
  useEffect(() => {
    setQuery(filters.q);
  }, [filters.q]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== filters.q) onChange({ q: query });
    }, 180);
    return () => clearTimeout(timer);
  }, [query, filters.q, onChange]);
  const clear = () => {
    setQuery('');
    onChange({ q: '', workflow: undefined, lane: undefined });
  };
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="orb" aria-hidden="true" />
        <h1>Orbita runs</h1>
        <span className="read-only">Read only</span>
      </div>
      <div className="toolbar-controls">
        <label className="search-field">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">Search runs</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search run, workflow, step"
          />
          {query ? (
            <Button
              variant="quiet"
              size="icon"
              aria-label="Clear search"
              onClick={() => setQuery('')}
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
              label="Workflow"
              value={filters.workflow}
              allLabel="All workflows"
              options={workflows.map((workflow) => ({ value: workflow, label: workflow }))}
              onValueChange={(workflow) => onChange({ workflow })}
            />
            <SelectField
              label="Lane"
              value={filters.lane}
              allLabel="All lanes"
              options={Object.entries(LANE_LABELS).map(([value, label]) => ({ value, label }))}
              onValueChange={(lane) => onChange({ lane: lane as DashboardLaneId | undefined })}
            />
            <Button variant="quiet" onClick={clear}>
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
