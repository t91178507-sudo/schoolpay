"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowRight, FiCode, FiCreditCard, FiFileText, FiUsers } from "react-icons/fi";
import { authFetch } from "../../lib/authFetch";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

export default function MobileHomePage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch("/api/mobile/summary");
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Unable to load dashboard");
        }

        setSummary(data);
      } catch (loadError) {
        setError(loadError.message || "Unable to load dashboard");
      }
    };

    load();
  }, []);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-slate-400">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
          Mobile workspace
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">{summary.businessName}</h2>
        <p className="mt-1 text-sm text-slate-400">
          Payments, invoices, and receipt checks in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SummaryCard label="Today" value={formatCurrency(summary.todayCollections)} />
        <SummaryCard label="Payments" value={summary.todayTransactions} />
        <SummaryCard label="Receipts" value={summary.pendingReceiptValidation} />
        <SummaryCard label="Outstanding" value={formatCurrency(summary.outstandingBalance)} />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Quick actions</p>
          <span className="text-xs text-slate-500">Staff tools</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickButton href="/mobile/invoices" label="Invoice" icon={FiFileText} />
          <QuickButton href="/mobile/qr" label="QR" icon={FiCode} />
          <QuickButton href="/mobile/payments" label="Payments" icon={FiCreditCard} />
          <QuickButton href="/mobile/customers" label="Customers" icon={FiUsers} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Recent activity</p>
          <span className="text-xs text-slate-500">Live</span>
        </div>
        <div className="mt-3 space-y-2">
          {(summary.recentActivities || []).length ? (
            summary.recentActivities.map((activity) => (
              <div key={activity._id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3">
                <p className="text-sm font-medium text-white">{activity.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "-"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No recent activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-white sm:text-2xl">{value}</p>
    </div>
  );
}

function QuickButton({ href, label, icon: Icon }) {
  return (
    <Link
      href={href}
      className="group flex min-h-20 flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm font-semibold text-white transition hover:border-blue-500 hover:bg-slate-900"
    >
      <Icon className="h-5 w-5 text-blue-300" aria-hidden="true" />
      <span className="flex items-center justify-between gap-2">
        {label}
        <FiArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-300" />
      </span>
    </Link>
  );
}
