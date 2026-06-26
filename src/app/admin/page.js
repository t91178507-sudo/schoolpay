"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminFetch";

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-400"></div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  const cards = [
    { label: "Total Businesses", value: stats.totalBusinesses, icon: "🏢" },
    { label: "Total Customers", value: stats.totalCustomers, icon: "👥" },
    { label: "Total Invoices", value: stats.totalInvoices, icon: "📄" },
    {
      label: "Total Invoice Value",
      value: `₦${stats.totalRevenue.toLocaleString()}`,
      icon: "💰",
    },
    {
      label: "Confirmed Revenue (Paid)",
      value: `₦${stats.paidRevenue.toLocaleString()}`,
      icon: "✅",
    },
    { label: "Unpaid Invoices", value: stats.unpaidCount, icon: "⏳" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Platform Overview</h1>
        <p className="text-slate-500 mt-1">Stats across every registered business</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl p-6 border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="text-3xl font-semibold text-slate-900 mt-3">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
