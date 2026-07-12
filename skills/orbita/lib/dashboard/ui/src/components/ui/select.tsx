import { Check, ChevronDown } from "lucide-react";
import { Select } from "radix-ui";

const ALL = "__orbita_all__";
type SelectOption = { label: string; value: string };

type SelectFieldProps = {
  allLabel: string;
  label: string;
  onValueChange: (value: string | undefined) => void;
  options: ReadonlyArray<SelectOption>;
  value?: string | undefined;
};

/** Source-owned shadcn-style select composition used by compact dashboard filters. */
export function SelectField({ allLabel, label, onValueChange, options, value }: SelectFieldProps) {
  return (
    <div className="filter-field">
      <span>{label}</span>
      <Select.Root
        onValueChange={(next) => onValueChange(next === ALL ? undefined : next)}
        value={value ?? ALL}
      >
        <Select.Trigger aria-label={label} className="ui-select">
          <Select.Value />
          <Select.Icon>
            <ChevronDown aria-hidden="true" size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="ui-select-content" position="popper" sideOffset={5}>
            <Select.Viewport>
              <Select.Item className="ui-select-item" value={ALL}>
                <Select.ItemText>{allLabel}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check aria-hidden="true" size={13} />
                </Select.ItemIndicator>
              </Select.Item>
              {options.map((option) => (
                <Select.Item className="ui-select-item" key={option.value} value={option.value}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check aria-hidden="true" size={13} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
