"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Nigerian phone field with a fixed +234 prefix.
 *
 * The vendor types only the rest: either the 10 digits after the trunk
 * (`7031602720`) or the full 11-digit local form (`07031602720`). Both
 * combine to the same canonical `234...` value, which is what gets
 * submitted under `name` via the hidden input - so server validation sees
 * exactly what it always saw, and `validateNigerianPhone` stays the single
 * authority. The visible box holds digits only.
 */
export function PhoneInput({
  id,
  name,
  required,
  autoComplete = "tel",
  placeholder = "7031602720",
  defaultValue = "",
}: {
  id: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  const [rest, setRest] = useState(() =>
    defaultValue.replace(/\D/g, "").replace(/^234/, "").slice(0, 11),
  );
  const combined = rest
    ? `234${rest.length === 11 && rest.startsWith("0") ? rest.slice(1) : rest}`
    : "";

  return (
    <div
      className={cn(
        "flex h-12 w-full items-stretch overflow-hidden rounded-xl border border-line bg-canvas transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-2 focus-within:ring-focus/25",
      )}
    >
      <span
        aria-hidden="true"
        className="flex select-none items-center border-r border-line bg-surface-raised px-3 font-mono text-sm font-semibold text-ink-muted"
      >
        +234
      </span>
      <input
        id={id}
        value={rest}
        onChange={(event) =>
          setRest(event.target.value.replace(/\D/g, "").slice(0, 11))
        }
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        required={required}
        minLength={10}
        maxLength={11}
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        className="w-full bg-transparent px-4 font-mono text-sm text-ink outline-none placeholder:text-ink-muted/80"
      />
      <input type="hidden" name={name} value={combined} />
      <span id={`${id}-hint`} className="sr-only">
        Type the 10 digits after +234, with or without the leading zero.
      </span>
    </div>
  );
}

