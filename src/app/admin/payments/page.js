"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

export default function AdminPayments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/payments");
        const json = res.ok ? await res.json() : { payments: [], totalCollected: 0, count: 0 };
        setData(json);
      } catch (err) {
        console.error(err);
        setData({ payments: [], totalCollected: 0, count: 0 });
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

  const { payments, totalCollected, count } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="text-slate-500 mt-1">
          {count} confirmed payment{count !== 1 ? "s" : ""} · ₦{totalCollected.toLocaleString()} collected across all businesses
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Business</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Amount Paid</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Token</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((inv) => (
                <tr key={inv._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-600">{inv.ownerBusinessName}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {inv.student || inv.customer || "—"}
                  </td>
                  <td className="px-6 py-4 text-emerald-700 font-medium">
                    ₦{Number(inv.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">
                    {inv.token ? inv.token.substring(0, 14) + "..." : "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {inv.date ? new Date(inv.date).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payments.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              No confirmed payments yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}