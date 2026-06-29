"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "green";
  if (normalized === "partially paid") return "blue";
  if (normalized === "failed") return "red";
  return "orange";
}

function getNotificationTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "prepared") return "green";
  if (normalized === "unavailable") return "slate";
  return "blue";
}

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
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const outstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <p className="mt-1 text-slate-500">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} across all businesses - {formatMoney(totalValue)} issued, {formatMoney(outstanding)} outstanding
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Business</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Invoice</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Payment</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Notification</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Token</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 align-top text-slate-600">
                    <p>{inv.ownerBusinessName}</p>
                    {inv.ownerEmail ? <p className="text-xs text-slate-400">{inv.ownerEmail}</p> : null}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="font-medium text-slate-900">{inv.customerDisplayName}</p>
                    {inv.phone ? <p className="text-xs text-slate-400">{inv.phone}</p> : null}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="font-medium text-slate-900">{formatMoney(inv.amount)}</p>
                    <p className="max-w-[14rem] truncate text-xs text-slate-500">{inv.description}</p>
                    <p className="text-xs text-slate-400">No: {inv.invoiceNumber || "-"}</p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-2">
                      <StatusPill tone={getStatusTone(inv.status)}>{inv.status || "Unpaid"}</StatusPill>
                      <p className="text-xs text-slate-500">
                        Paid {formatMoney(inv.paidAmount)} / Due {formatMoney(inv.balanceDue)}
                      </p>
                      <p className="text-xs text-slate-400">{inv.paymentProvider || "-"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <StatusPill tone={getNotificationTone(inv.customerNotificationStatus)}>
                      {inv.customerNotificationStatus || "draft"}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-4 align-top font-mono text-xs text-slate-500">
                    {inv.token ? `${inv.token.substring(0, 14)}...` : "-"}
                  </td>
                  <td className="px-6 py-4 align-top text-sm text-slate-500">
                    {inv.date ? new Date(inv.date).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {invoices.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              No invoices yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
