"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function getPaymentTone(status) {
  return String(status || "").toLowerCase() === "paid" ? "green" : "blue";
}

function getNotificationTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "prepared") return "green";
  if (normalized === "unavailable") return "slate";
  return "blue";
}

export default function AdminPayments() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/payments");
        const json = res.ok
          ? await res.json()
          : { payments: [], totalCollected: 0, count: 0 };
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
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  const { payments, totalCollected, count, partialCount, preparedNotificationCount } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="mt-1 text-slate-500">
          {count} payment record{count !== 1 ? "s" : ""} - {formatMoney(totalCollected)} collected, {partialCount || 0} partial, {preparedNotificationCount || 0} receipts prepared
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Business</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Provider</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Notification</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Reference</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((inv) => (
                <tr key={inv._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 align-top text-slate-600">
                    <p>{inv.ownerBusinessName}</p>
                    {inv.ownerEmail ? <p className="text-xs text-slate-400">{inv.ownerEmail}</p> : null}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="font-medium text-slate-900">{inv.customerDisplayName}</p>
                    <p className="max-w-[14rem] truncate text-xs text-slate-500">{inv.description}</p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="font-medium text-emerald-700">{formatMoney(inv.paidAmount)}</p>
                    <StatusPill tone={getPaymentTone(inv.status)}>
                      {inv.status || "Paid"}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="text-sm text-slate-700">{inv.paymentProvider || "-"}</p>
                    <p className="text-xs text-slate-400">{inv.paymentVerificationMethod || inv.paymentStatus || "-"}</p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <StatusPill tone={getNotificationTone(inv.customerNotificationStatus)}>
                      {inv.customerNotificationStatus || "draft"}
                    </StatusPill>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="max-w-[14rem] break-all font-mono text-xs text-slate-500">
                      {inv.paymentReference || "-"}
                    </p>
                  </td>
                  <td className="px-6 py-4 align-top text-sm text-slate-500">
                    {formatDateTime(inv.happenedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payments.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              No confirmed or partial payments yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
