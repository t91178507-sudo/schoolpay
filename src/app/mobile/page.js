"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-400">Business Name</p>
        <h2 className="mt-1 text-2xl font-semibold">{summary.businessName}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Today's Sales" value={formatCurrency(summary.todayCollections)} />
        <SummaryCard label="Payments Received" value={summary.todayTransactions} />
        <SummaryCard label="Pending Receipts" value={summary.pendingReceiptValidation} />
        <SummaryCard label="Outstanding Balance" value={formatCurrency(summary.outstandingBalance)} />
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm font-medium text-slate-300">Quick Actions</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <QuickButton href="/mobile/invoices" label="Create Invoice" />
          <QuickButton href="/mobile/qr" label="Generate QR" />
          <QuickButton href="/mobile/payments" label="Record Payment" />
          <QuickButton href="/mobile/customers" label="View Customers" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Recent Activities</p>
          <span className="text-xs text-slate-500">Live</span>
        </div>
        <div className="mt-4 space-y-3">
          {(summary.recentActivities || []).length ? (
            summary.recentActivities.map((activity) => (
              <div key={activity._id} className="rounded-2xl bg-slate-950 px-4 py-3">
                <p className="text-sm text-white">{activity.title}</p>
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
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function QuickButton({ href, label }) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-blue-600 px-4 py-4 text-center text-sm font-semibold text-white"
    >
      {label}
    </Link>
  );
}
