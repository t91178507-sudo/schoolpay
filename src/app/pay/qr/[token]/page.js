"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PublicLegalFooter from "../../../../components/PublicLegalFooter";

export default function QuickPayPage() {
  const { token } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [fatalError, setFatalError] = useState("");
  const [error, setError] = useState("");
  const [payazaAccount, setPayazaAccount] = useState(null);
  const [copiedPayazaField, setCopiedPayazaField] = useState("");
  const [verifyingPayaza, setVerifyingPayaza] = useState(false);
  const [form, setForm] = useState({
    customerPhone: "",
    amount: "",
  });

  useEffect(() => {
    if (!token) return;

    const loadProfile = async () => {
      try {
        const res = await fetch(`/api/quick-pay-profiles/by-token/${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Quick payment profile not found");
        }

        setProfile(data);
      } catch (loadError) {
        setFatalError(loadError.message || "Unable to load quick payment");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token]);

  const startPayment = async () => {
    if (!profile) return;
    if (!form.customerPhone.trim()) {
      setError("Enter your WhatsApp phone number.");
      return;
    }

    if (!Number(form.amount) || Number(form.amount) <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setLaunching(true);
    setError("");

    try {
      const res = await fetch("/api/monnify/qr-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileToken: profile.token,
          customerPhone: form.customerPhone,
          amount: form.amount,
          origin: window.location.origin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to open payment gateway");
      }

      if (data.gateway === "payaza" && data.virtualAccount) {
        setPayazaAccount({
          ...data.virtualAccount,
          paymentReference: data.paymentReference,
        });
        setLaunching(false);
        return;
      }

      if (!data.checkoutUrl) {
        throw new Error(data.error || "Unable to open payment gateway");
      }

      window.location.href = data.checkoutUrl;
    } catch (launchError) {
      setError(launchError.message || "Unable to open payment gateway");
      setLaunching(false);
    }
  };

  const copyPayazaValue = (field, value) => {
    if (!value) return;

    navigator.clipboard.writeText(String(value));
    setCopiedPayazaField(field);
    setTimeout(() => setCopiedPayazaField(""), 1500);
  };

  const verifyPayazaPayment = async () => {
    if (!payazaAccount?.paymentReference || !profile?.token) return;
    setVerifyingPayaza(true);

    try {
      const res = await fetch("/api/payaza/qr-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileToken: profile.token,
          paymentReference: payazaAccount.paymentReference,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment is not complete yet");
      }

      window.location.href = `/pay/qr/success/${profile.token}?paymentReference=${encodeURIComponent(
        payazaAccount.paymentReference
      )}&provider=payaza`;
    } catch (verifyError) {
      alert(verifyError.message || "Payment is not complete yet");
    } finally {
      setVerifyingPayaza(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (fatalError || !profile) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Quick payment is unavailable
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {fatalError || "This QR payment link is invalid or inactive."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex flex-col items-center justify-center px-3 py-5 sm:px-4 sm:py-10">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-6 sm:px-8 sm:py-7 border-b border-slate-100 dark:border-slate-800">
          <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
            Quick payment
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
            {profile.businessName || "InvoiceHub"}
          </h1>
        </div>

        <div className="px-5 py-5 sm:px-8 sm:py-6 space-y-4">
          <DetailRow label="Description" value={profile.description || "QR payment"} />

          <div className="space-y-2">
            <label className="block text-[13px] text-slate-500 dark:text-slate-400">
              WhatsApp phone number
            </label>
            <input
              type="tel"
              autoFocus
              inputMode="tel"
              value={form.customerPhone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  customerPhone: event.target.value,
                }))
              }
              placeholder="08012345678"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-[14px] text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] text-slate-500 dark:text-slate-400">Amount</label>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              placeholder="5000"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-[14px] text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

        </div>

        <div className="px-5 pb-6 pt-2 sm:px-8 sm:pb-8">
          <button
            onClick={startPayment}
            disabled={launching}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl font-medium text-[15px] transition-colors"
          >
            {launching ? "Opening gateway..." : "Continue to payment gateway"}
          </button>
          <p className="text-center text-[12px] leading-5 text-slate-400 mt-3">
            Your selected payment gateway will provide the payment details after you continue.
          </p>
          <PublicLegalFooter className="mt-4 px-2" />
        </div>
      </div>
      {payazaAccount && (
        <PayazaPaymentModal
          account={payazaAccount}
          amount={form.amount}
          onClose={() => setPayazaAccount(null)}
          onVerify={verifyPayazaPayment}
          onCopy={copyPayazaValue}
          copiedField={copiedPayazaField}
          verifying={verifyingPayaza}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4 sm:items-start">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="break-words text-[14px] font-medium text-slate-900 sm:text-right">
        {value}
      </span>
    </div>
  );
}

function PayazaPaymentModal({
  account,
  amount,
  onClose,
  onVerify,
  onCopy,
  copiedField,
  verifying,
}) {
  const amountPayable = Number(account.amountPayable || amount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                PayAza transfer
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Complete your payment
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              aria-label="Close PayAza payment"
            >
              x
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Transfer the exact amount to this temporary account, then confirm below.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Amount to transfer
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              N{amountPayable.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="space-y-3">
              <DetailRow label="Bank" value={account.bankName || "-"} />
              <DetailRow label="Account name" value={account.accountName || "-"} />
              <DetailRow label="Expires" value={`${account.expiresInMinutes || 30} minutes`} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCopy("accountNumber", account.accountNumber)}
            className="w-full rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-5 py-4 text-left shadow-sm transition hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70"
          >
            <span className="block text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Account number
            </span>
            <span className="mt-1 flex items-center justify-between gap-3">
              <span className="break-all font-mono text-2xl font-black tracking-wide text-emerald-950 dark:text-emerald-50">
                {account.accountNumber || "-"}
              </span>
              <span className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">
                {copiedField === "accountNumber" ? "Copied" : "Copy"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="w-full rounded-xl bg-slate-900 py-3.5 text-[15px] font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {verifying ? "Checking payment..." : "I have made the transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
