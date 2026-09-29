"use client";

import { CheckCircle, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useActionState, useState } from "react";

import { createOrderAction, type ActionResult } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/dashboard/submit-button";
import type { Bank } from "@/lib/types";
import { cn } from "@/lib/cn";
import { PhoneInput } from "@/components/dashboard/phone-input";
import { RiderBankFields } from "@/components/dashboard/rider-bank-fields";

type Item = { description: string; quantity: string; unitPrice: string };

const EMPTY: Item = { description: "", quantity: "1", unitPrice: "" };

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/80 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-focus/25";

function naira(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function CreateOrderForm({ banks }: { banks: Bank[] }) {
  const [result, formAction] = useActionState<ActionResult | null, FormData>(
    createOrderAction,
    null,
  );
  const [items, setItems] = useState<Item[]>([{ ...EMPTY }]);
  const [fulfillment, setFulfillment] = useState<"0" | "2">("0");
  const [deliveryFee, setDeliveryFee] = useState("");

  const goodsKobo = Math.round(
    items.reduce(
      (sum, item) => sum + naira(item.quantity) * naira(item.unitPrice) * 100,
      0,
    ) * 1,
  );
  // Self-delivery has no rider, so there is no rider fee on the order.
  const feeKobo = fulfillment === "2" ? 0 : Math.round(naira(deliveryFee) * 100);
  const totalKobo = goodsKobo + feeKobo;

  const formatNaira = (kobo: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(kobo / 100);

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-4 text-base font-semibold tracking-[-0.02em] text-ink">
          Buyer
        </h2>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Buyer name" htmlFor="customerName">
            <input
              id="customerName"
              name="customerName"
              type="text"
              autoComplete="name"
              maxLength={120}
              required
              placeholder="Chidi Obi…"
              className={inputClass}
            />
          </Field>
          <Field label="Buyer phone" htmlFor="customerPhone" hint="Nigerian mobile. Type the rest after +234.">
            <PhoneInput id="customerPhone" name="customerPhone" required placeholder="7031602720" />
          </Field>
          <Field
            label="Buyer email"
            htmlFor="buyerEmail"
            hint="Receipts and status mails go here."
            className="sm:col-span-2"
          >
            <input
              id="buyerEmail"
              name="buyerEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={160}
              required
              placeholder="buyer@example.com…"
              className={inputClass}
            />
          </Field>
          <Field
            label="Delivery address"
            htmlFor="deliveryAddress"
            hint="Required for dispatch orders."
            className="sm:col-span-2"
          >
            <input
              id="deliveryAddress"
              name="deliveryAddress"
              type="text"
              autoComplete="street-address"
              maxLength={240}
              placeholder="Lekki Phase 1, Lagos…"
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-4 text-base font-semibold tracking-[-0.02em] text-ink">
          Items
        </h2>
        <div className="space-y-4 px-5 py-5">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 sm:grid-cols-[1.6fr_0.6fr_1fr_auto] sm:items-end"
            >
              <Field label={`Item ${index + 1}`} htmlFor={`itemDescription-${index}`}>
                <input
                  id={`itemDescription-${index}`}
                  name="itemDescription"
                  type="text"
                  maxLength={160}
                  value={item.description}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                  placeholder="Ankara midi dress…"
                  className={inputClass}
                />
              </Field>
              <Field label="Qty" htmlFor={`itemQuantity-${index}`}>
                <input
                  id={`itemQuantity-${index}`}
                  name="itemQuantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={item.quantity}
                  onChange={(event) => updateItem(index, { quantity: event.target.value })}
                  className={cn(inputClass, "tabular-nums")}
                />
              </Field>
              <Field label="Unit (₦)" htmlFor={`itemUnitPrice-${index}`}>
                <input
                  id={`itemUnitPrice-${index}`}
                  name="itemUnitPrice"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) => updateItem(index, { unitPrice: event.target.value })}
                  placeholder="22500…"
                  className={cn(inputClass, "tabular-nums")}
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  setItems((current) =>
                    current.length === 1
                      ? [{ ...EMPTY }]
                      : current.filter((_, i) => i !== index),
                  )
                }
                aria-label={`Remove item ${index + 1}`}
                className="mb-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:mb-0"
              >
                <Trash size={17} aria-hidden="true" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItems((current) => [...current, { ...EMPTY }])}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-canvas px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            Add another item
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-4 text-base font-semibold tracking-[-0.02em] text-ink">
          Fulfilment
        </h2>
        <div className="space-y-5 px-5 py-5">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              How does it reach the buyer?
            </legend>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              This decides who confirms the handover, so it decides when the
              money moves.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    value: "0",
                    title: "A rider delivers",
                    body: "A rider carries it and confirms with the buyer's code. The fee below is paid to them on handover.",
                  },
                  {
                    value: "2",
                    title: "I deliver it myself",
                    body: "You hand it over in person. The buyer releases the payment from their tracking page.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                    fulfillment === option.value
                      ? "border-brand bg-surface-blue"
                      : "border-line bg-canvas hover:bg-surface-raised",
                  )}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value={option.value}
                    checked={fulfillment === option.value}
                    onChange={() => {
                      setFulfillment(option.value);
                      // Self-delivery has no rider, so there is no rider fee.
                      if (option.value === "2") setDeliveryFee("0");
                    }}
                    className="mt-1 h-4 w-4 shrink-0 accent-blue-spruce-700"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                      {option.body}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            label={fulfillment === "2" ? "Delivery charge (₦)" : "Rider fee (₦)"}
            htmlFor="deliveryFeeNgn"
            hint={
              fulfillment === "2"
                ? "You deliver this yourself, so there is no rider fee — the amount must be 0. Whatever you charge the buyer for delivery goes into the order total."
                : "Paid to the rider the moment they confirm the handover."
            }
            className="sm:max-w-xs"
          >
            <input
              id="deliveryFeeNgn"
              name="deliveryFeeNgn"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={fulfillment === "2" ? "0" : deliveryFee}
              disabled={fulfillment === "2"}
              onChange={(event) => setDeliveryFee(event.target.value)}
              placeholder="5000…"
              className={cn(inputClass, "tabular-nums")}
            />
          </Field>

          {fulfillment === "0" ? (
            <RiderBankFields banks={banks} />
          ) : null}
        </div>
      </section>

      <div className="rounded-2xl border border-line bg-surface px-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-ink-muted">Buyer pays</p>
          <p className="money text-2xl font-semibold tabular-nums tracking-[-0.02em] text-ink">
            {formatNaira(totalKobo)}
          </p>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-ink-muted">
          {formatNaira(goodsKobo)} goods
          {fulfillment === "0"
            ? ` + ${formatNaira(feeKobo)} delivery`
            : " · you deliver it yourself"}
          . Held in escrow until the order settles.
        </p>

        <div className="mt-5">
          <SubmitButton pendingLabel="Creating order…" className="w-full sm:w-auto">
            Create order and get payment link
          </SubmitButton>
        </div>

        {result ? (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "mt-4 flex items-start gap-2 text-sm leading-6",
              result.ok
                ? "text-shamrock-800 dark:text-shamrock-200"
                : "text-cinnamon-wood-800 dark:text-cinnamon-wood-200",
            )}
          >
            {result.ok ? (
              <CheckCircle size={18} weight="duotone" className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <WarningCircle size={18} weight="duotone" className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{result.message}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs leading-5 text-ink-muted">{hint}</p> : null}
    </div>
  );
}
