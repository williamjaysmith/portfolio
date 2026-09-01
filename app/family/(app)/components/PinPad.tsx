"use client";

import { Delete } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The 4-digit keypad (FR-010).
 *
 * A real password input mirrors the value so screen readers and password
 * managers behave, but `inputMode="none"` keeps the on-screen keyboard away
 * on a tablet — the pad is the keyboard. Physical digits and Backspace work
 * too, for keyboard operability (SC-009).
 */

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export interface PinPadProps {
  disabled?: boolean;
  onComplete: (pin: string) => void;
  /** Change this to clear the pad — after a wrong PIN, for instance. */
  resetKey?: number;
}

export function PinPad({ disabled = false, onComplete, resetKey = 0 }: PinPadProps) {
  const [value, setValue] = useState("");
  const [clearedFor, setClearedFor] = useState(resetKey);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived-state reset: clearing in an effect would trip
  // react-hooks/set-state-in-effect and flash the old digits for a frame.
  if (resetKey !== clearedFor) {
    setClearedFor(resetKey);
    setValue("");
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function push(digit: string): void {
    if (disabled || value.length >= PIN_LENGTH) return;
    const next = value + digit;
    setValue(next);
    // Auto-submit on the fourth digit: nobody should have to find a button.
    if (next.length === PIN_LENGTH) onComplete(next);
  }

  function backspace(): void {
    if (disabled) return;
    setValue((current) => current.slice(0, -1));
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Backspace") {
      event.preventDefault();
      backspace();
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      push(event.key);
    }
  }

  const keyClass =
    "flex min-h-[64px] min-w-[64px] items-center justify-center rounded-2xl bg-(--fam-pill-btn-bg) text-(length:--fam-fs-title) font-medium text-(--fam-text-primary) disabled:opacity-40";

  return (
    <div onKeyDown={handleKeyDown} className="flex flex-col items-center gap-4">
      <input
        ref={inputRef}
        type="password"
        inputMode="none"
        maxLength={PIN_LENGTH}
        autoComplete="off"
        aria-label="PIN"
        value={value}
        disabled={disabled}
        readOnly
        className="sr-only"
      />
      <div aria-hidden="true" className="flex gap-3">
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={`h-4 w-4 rounded-full ${
              index < value.length ? "bg-(--fam-primary-blue)" : "bg-(--fam-hairline)"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button key={key} type="button" disabled={disabled} onClick={() => push(key)} className={keyClass}>
            {key}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" disabled={disabled} onClick={() => push("0")} className={keyClass}>
          0
        </button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={backspace}
          aria-label="Delete last digit"
          className={keyClass}
        >
          <Delete size={28} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
