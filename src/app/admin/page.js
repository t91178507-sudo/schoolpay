"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        setStats(data);
      } catch {
        setError("Failed to load platform stats");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  const cards = [
    { label: "Businesses", value: stats.totalBusinesses, hint: `${stats.monnifyConfiguredBusinesses || 0} with Monnify configured` },
    { label: "Customers", value: stats.totalCustomers, hint: "Across all businesses" },
    { label: "Invoices", value: stats.totalInvoices, hint: `${stats.paidCount || 0} paid, ${stats.partialCount || 0} partial, ${stats.unpaidCount || 0} unpaid` },
    { label: "Invoice value", value: formatMoney(stats.totalRevenue), hint: "Total issued value" },
    { label: "Collected", value: formatMoney(stats.collectedRevenue ?? stats.paidRevenue), hint: `${formatMoney(stats.partialRevenue)} from partial payments` },
    { label: "Outstanding", value: formatMoney(stats.outstandingRevenue), hint: "Remaining balance due" },
    { label: "Prepared receipts", value: stats.preparedNotificationCount || 0, hint: `${stats.unavailableNotificationCount || 0} unavailable` },
    { label: "WhatsApp Web", value: stats.whatsappWebBusinesses || 0, hint: "Businesses using bridge provider" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Platform Overview</h1>
        <p className="mt-1 text-slate-500">
          Payments, gateway readiness, WhatsApp bridge setup, and invoice health across every business
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {card.value}
            </p>
            {card.hint ? (
              <p className="mt-2 text-xs text-slate-400">{card.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
