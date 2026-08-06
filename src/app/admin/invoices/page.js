"use client";

import { useEffect, useState } from "react";
import {
  AdminBadge,
  AdminHeader,
  AdminLoading,
  AdminMetric,
  AdminTable,
  AdminTd,
  AdminTh,
} from "../../../components/AdminUI";
import { adminFetch } from "../../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
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
  if (["sent", "prepared"].includes(normalized)) return "green";
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

  if (loading) return <AdminLoading />;

  const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const collected = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
  const outstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0);

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Invoice monitoring"
        title="Invoices"
        description="Review invoice value, settlement status, and customer notification readiness across every business."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <AdminMetric label="Invoices" value={invoices.length} hint="All businesses" tone="blue" />
        <AdminMetric label="Issued value" value={formatMoney(totalValue)} hint="Total invoice value" />
        <AdminMetric label="Collected" value={formatMoney(collected)} hint="Recorded paid amount" tone="green" />
        <AdminMetric label="Outstanding" value={formatMoney(outstanding)} hint="Balance remaining" tone="orange" />
      </div>

      <AdminTable minWidth="1120px">
        <thead>
          <tr className="border-b border-slate-200">
            <AdminTh className="w-[18%]">Business</AdminTh>
            <AdminTh className="w-[17%]">Customer</AdminTh>
            <AdminTh className="w-[23%]">Invoice</AdminTh>
            <AdminTh className="w-[16%]">Payment</AdminTh>
            <AdminTh className="w-[12%]">Notification</AdminTh>
            <AdminTh className="w-[8%]">Date</AdminTh>
            <AdminTh className="w-[6%]">Token</AdminTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((inv) => (
            <tr key={inv._id} className="hover:bg-slate-50">
              <AdminTd>
                <p className="font-medium text-slate-900">{inv.ownerBusinessName || "-"}</p>
                {inv.ownerEmail ? <p className="mt-1 truncate text-xs text-slate-400">{inv.ownerEmail}</p> : null}
              </AdminTd>
              <AdminTd>
                <p className="font-medium text-slate-900">{inv.customerDisplayName || "-"}</p>
                {inv.phone ? <p className="mt-1 text-xs text-slate-400">{inv.phone}</p> : null}
              </AdminTd>
              <AdminTd>
                <p className="font-semibold text-slate-950">{formatMoney(inv.amount)}</p>
                <p className="mt-1 truncate text-xs text-slate-500" title={inv.description}>{inv.description || "-"}</p>
                <p className="mt-1 font-mono text-xs text-slate-400">{inv.invoiceNumber || "-"}</p>
              </AdminTd>
              <AdminTd>
                <div className="space-y-2">
                  <AdminBadge tone={getStatusTone(inv.status)}>{inv.status || "Unpaid"}</AdminBadge>
                  <p className="text-xs text-slate-500">
                    Paid {formatMoney(inv.paidAmount)} / Due {formatMoney(inv.balanceDue)}
                  </p>
                  <p className="text-xs text-slate-400">{inv.paymentProvider || "-"}</p>
                </div>
              </AdminTd>
              <AdminTd>
                <AdminBadge tone={getNotificationTone(inv.customerNotificationStatus)}>
                  {inv.customerNotificationStatus || "draft"}
                </AdminBadge>
              </AdminTd>
              <AdminTd className="text-xs text-slate-500">
                {inv.date ? new Date(inv.date).toLocaleDateString() : "-"}
              </AdminTd>
              <AdminTd className="font-mono text-xs text-slate-500">
                {inv.token ? `${inv.token.substring(0, 8)}...` : "-"}
              </AdminTd>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          No invoices yet.
        </div>
      ) : null}
    </div>
  );
}
