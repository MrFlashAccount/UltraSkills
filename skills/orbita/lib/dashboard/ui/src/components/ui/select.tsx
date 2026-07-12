import { Check, ChevronDown } from 'lucide-react';
import { Select } from 'radix-ui';

const ALL = '__orbita_all__';
type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  value?: string;
  allLabel: string;
  options: readonly SelectOption[];
  onValueChange: (value: string | undefined) => void;
};

/** Source-owned shadcn-style select composition used by compact dashboard filters. */
export function SelectField({ label, value, allLabel, options, onValueChange }: SelectFieldProps) {
  return <div className="filter-field"><span>{label}</span><Select.Root value={value ?? ALL} onValueChange={(next) => onValueChange(next === ALL ? undefined : next)}>
    <Select.Trigger className="ui-select" aria-label={label}><Select.Value /><Select.Icon><ChevronDown aria-hidden="true" size={14} /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className="ui-select-content" position="popper" sideOffset={5}><Select.Viewport>
      <Select.Item className="ui-select-item" value={ALL}><Select.ItemText>{allLabel}</Select.ItemText><Select.ItemIndicator><Check aria-hidden="true" size={13} /></Select.ItemIndicator></Select.Item>
      {options.map((option) => <Select.Item className="ui-select-item" key={option.value} value={option.value}><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check aria-hidden="true" size={13} /></Select.ItemIndicator></Select.Item>)}
    </Select.Viewport></Select.Content></Select.Portal>
  </Select.Root></div>;
}
