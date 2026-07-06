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
  const bridgeHealth = stats.whatsappBridgeHealth || {};
  const bridgeOnline = bridgeHealth.online === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Platform Overview</h1>
        <p className="mt-1 text-slate-500">
          Payments, gateway readiness, WhatsApp bridge setup, and invoice health across every business
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div
          className={`rounded-2xl border p-6 ${
            bridgeOnline
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={bridgeOnline ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
                WhatsApp bridge
              </p>
              <p
                className={`mt-3 text-3xl font-semibold ${
                  bridgeOnline ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {bridgeOnline ? "Online" : "Offline"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                bridgeOnline
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {bridgeHealth.configured === false ? "Not set" : bridgeOnline ? "Live" : "Check"}
            </span>
          </div>
          <p className={bridgeOnline ? "mt-2 break-all text-xs text-emerald-700/80" : "mt-2 break-all text-xs text-red-700/80"}>
            {bridgeHealth.url || "No bridge URL configured"}
          </p>
          {!bridgeOnline && bridgeHealth.error ? (
            <p className="mt-2 text-xs text-red-600">{bridgeHealth.error}</p>
          ) : null}
        </div>
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
