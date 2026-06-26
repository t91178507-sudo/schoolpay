"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/invoices");
        const data = res.ok ? await res.json() : [];
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
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

  const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <p className="text-slate-500 mt-1">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} across all businesses · ₦{totalValue.toLocaleString()} total value
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Business</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Token</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-600">{inv.ownerBusinessName}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {inv.customer || inv.customerName || inv.student || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-900 font-medium">
                    ₦{Number(inv.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        inv.status === "Paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {inv.status || "Unpaid"}
                    </span>
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

          {invoices.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              No invoices yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
