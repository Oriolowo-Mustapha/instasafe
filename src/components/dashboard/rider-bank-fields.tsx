"use client";

import { useState } from "react";

import { resolveBankAccount } from "@/lib/auth-api";
import type { Bank } from "@/lib/types";
import { cn } from "@/lib/cn";
import { PhoneInput } from "@/components/dashboard/phone-input";

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/80 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-focus/25";
/**
 * Rider payout details with holder-name confirmation.
 */
export function RiderBankFields({ banks }: { banks: Bank[] }) {
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holder, setHolder] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState("");

  const key = bankCode + ":" + accountNumber;

  function reset() {
    setHolder(null);
    setUnavailable(false);
    setAcknowledged(false);
    setError(null);
    setCheck("");
  }

  async function handleVerify() {
    setError(null);
    const digitsOnly = accountNumber.replace(/[^0-9]/g, "");
    if (digitsOnly.length < 10) {
      setError("Account number should be at least 10 digits.");
      return;
    }
    if (!bankCode) {
      setError("Choose the rider bank first.");
      return;
    }
    setResolving(true);
    try {
      const response = await resolveBankAccount({ bankCode, accountNumber });
      if (response.ok && response.data && response.data.accountName) {
        setHolder(response.data.accountName);
        setUnavailable(false);
        setCheck("verified:" + key);
      } else if (!response.ok) {
        const code = response.error ? response.error.code : "";
        if (code === "HTTP_503") {
          setHolder(null);
          setUnavailable(true);
          setCheck("");
        } else {
          setHolder(null);
          setCheck("");
          setError(response.error ? response.error.message : "Could not verify this account.");
        }
      } else {
        setHolder(null);
        setCheck("");
        setError("The bank did not return an account name. Double-check and retry.");
      }
    } catch {
      setHolder(null);
      setCheck("");
      setError("Could not reach verification. Check your connection and retry.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
      <p className="text-xs leading-5 text-ink-muted sm:col-span-3">
        Required on a rider order. All three go on this order.
      </p>
      <div>
        <label htmlFor="driverPhone" className="text-sm font-semibold text-ink">
          Rider phone
        </label>
        <p className="mt-1.5 text-xs leading-5 text-ink-muted">
          Their WhatsApp number. Type the rest after +234.
        </p>
        <div className="mt-2">
          <PhoneInput id="driverPhone" name="driverPhone" required autoComplete="off" placeholder="8055556666" />
        </div>
      </div>
      <div>
        <label htmlFor="driverBankCode" className="text-sm font-semibold text-ink">
          Rider bank
        </label>
        <div className="mt-2">
          {banks.length > 0 ? (
            <select
              id="driverBankCode"
              name="driverBankCode"
              required
              value={bankCode}
              onChange={(e) => { setBankCode(e.target.value); reset(); }}
              className={cn(inputClass, "appearance-none")}
            >
              <option value="">Choose a bank</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="driverBankCode"
              name="driverBankCode"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={12}
              placeholder="058"
              value={bankCode}
              onChange={(e) => { setBankCode(e.target.value); reset(); }}
              className={cn(inputClass, "font-mono")}
            />
          )}
        </div>
      </div>
      <div>
        <label htmlFor="driverAccountNumber" className="text-sm font-semibold text-ink">
          Rider account
        </label>
        <div className="mt-2">
          <input
            id="driverAccountNumber"
            name="driverAccountNumber"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={20}
            placeholder="0123456789"
            value={accountNumber}
            onChange={(e) => { setAccountNumber(e.target.value); reset(); }}
            className={cn(inputClass, "font-mono")}
          />
        </div>
      </div>
      <div className="sm:col-span-3">
        <button
          type="button"
          onClick={handleVerify}
          disabled={resolving || !bankCode || accountNumber.length < 10}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface-raised px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {resolving ? "Verifying..." : "Verify account"}
        </button>
      </div>
      <input type="hidden" name="riderBankCheck" value={check} />
      {holder ? (
        <p role="status" className="rounded-xl border border-shamrock-300 bg-shamrock-50 px-4 py-3 text-sm font-semibold text-shamrock-900 sm:col-span-3 dark:border-shamrock-800 dark:bg-shamrock-950 dark:text-shamrock-100">
          Account name: {holder}
        </p>
      ) : null}
      {unavailable ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm leading-6 text-ink-muted sm:col-span-3">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              setAcknowledged(e.target.checked);
              if (e.target.checked) { setCheck("acknowledged:" + key); }
              else { setCheck(""); }
            }}
            className="mt-1"
          />
          Verification is unavailable right now. I checked the bank and
          account number myself and take responsibility for them.
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-cinnamon-wood-900 sm:col-span-3 dark:text-cinnamon-wood-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}

