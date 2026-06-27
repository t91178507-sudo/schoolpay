"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PublicLegalFooter from "../../../../components/PublicLegalFooter";

export default function QuickPayPage() {
  const { token } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [fatalError, setFatalError] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customerPhone: "",
    amount: "",
  });
  const [acceptedNotice, setAcceptedNotice] = useState(false);

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

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to open payment gateway");
      }

      window.location.href = data.checkoutUrl;
    } catch (launchError) {
      setError(launchError.message || "Unable to open payment gateway");
      setLaunching(false);
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
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-8 py-7 border-b border-slate-100 dark:border-slate-800">
          <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
            Quick payment
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
            {profile.businessName || "InvoiceHub"}
          </h1>
        </div>

        <div className="px-8 py-6 space-y-4">
          <DetailRow label="Description" value={profile.description || "QR payment"} />

          <div className="space-y-2">
            <label className="block text-[13px] text-slate-500 dark:text-slate-400">
              WhatsApp phone number
            </label>
            <input
              type="tel"
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

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
            <p className="font-medium text-slate-900 dark:text-slate-100">Payment and data notice</p>
            <p className="mt-2 leading-6">
              InvoiceHub is providing the billing page and status tracking only. Payment is
              processed by the merchant&apos;s configured gateway, and InvoiceHub does not hold
              customer funds.
            </p>
            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={acceptedNotice}
                onChange={(event) => setAcceptedNotice(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 accent-slate-900"
              />
              <span className="text-[13px] leading-6 text-slate-600">
                I consent to the phone number, amount, and payment reference being used for
                payment verification and receipt preparation.
              </span>
            </label>
          </div>
        </div>

        <div className="px-8 pb-8 pt-2">
          <button
            onClick={startPayment}
            disabled={launching || !acceptedNotice}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl font-medium text-[15px] transition-colors"
          >
            {launching
              ? "Opening gateway..."
              : !acceptedNotice
                ? "Accept notice to continue"
                : "Continue to payment gateway"}
          </button>
          <p className="text-center text-[12px] text-slate-400 mt-3">
            Monnify will provide the transfer account after you continue.
          </p>
          <div className="mt-4 text-center text-[12px] text-slate-500">
            <Link href="/privacy" className="hover:text-slate-700">
              Privacy notice
            </Link>
            <span className="mx-2">|</span>
            <Link href="/terms" className="hover:text-slate-700">
              Platform terms
            </Link>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <PublicLegalFooter />
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 items-start">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-[14px] font-medium text-slate-900 text-right">
        {value}
      </span>
    </div>
  );
}
