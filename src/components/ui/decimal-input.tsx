"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * A decimal-friendly numeric input. Renders a text input (so the browser
 * doesn't block the "," key like type="number" does) with a numeric mobile
 * keypad, and only permits digits plus a single "." or "," separator.
 *
 * Value is kept as a raw string — parse it with `parseDecimal()` at submit
 * time. `onValueChange` gives the cleaned string directly.
 */
type Props = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Allow only whole numbers (no separator). Default false. */
  integer?: boolean;
};

export function DecimalInput({ value, onValueChange, integer = false, ...props }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value;
    // Keep only digits and separators
    v = integer ? v.replace(/[^\d]/g, "") : v.replace(/[^\d.,]/g, "");
    if (!integer) {
      // Collapse to a single decimal separator (first one wins)
      const firstSep = v.search(/[.,]/);
      if (firstSep !== -1) {
        const head = v.slice(0, firstSep + 1);
        const tail = v.slice(firstSep + 1).replace(/[.,]/g, "");
        v = head + tail;
      }
    }
    onValueChange(v);
  }

  return (
    <Input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={value}
      onChange={handleChange}
      {...props}
    />
  );
}
