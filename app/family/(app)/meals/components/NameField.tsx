import type { ComponentProps } from "react";

import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";

/** The one-line name field the mealtime and recipe forms share, with its error beneath. */
export interface NameFieldProps {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  errors: ComponentProps<typeof FieldError>["messages"];
}

export function NameField({ label, value, maxLength, onChange, errors }: NameFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>
        {label}
        <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} className={FIELD} />
      </label>
      <FieldError messages={errors} />
    </div>
  );
}
