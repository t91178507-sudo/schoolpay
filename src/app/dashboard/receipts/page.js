"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatCard,
  StatGrid,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getStatusTone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "orange";
}

export default function ReceiptValidationPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadReceipts = async () => {
    try {
      const res = await authFetch("/api/receipts", { cache: "no-store" });
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(data.error || "Unable to load receipts");
      }

      setReceipts(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(loadReceipts, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const approvedToday = receipts.filter(
      (receipt) =>
        receipt.status === "approved" &&
        String(receipt.approvedAt || "").slice(0, 10) === today
    ).length;
    const rejectedToday = receipts.filter(
      (receipt) =>
        receipt.status === "rejected" &&
        String(receipt.rejectedAt || "").slice(0, 10) === today
    ).length;
    const completed = receipts.filter(
      (receipt) =>
        ["approved", "rejected"].includes(receipt.status) &&
        receipt.createdAt &&
        (receipt.approvedAt || receipt.rejectedAt)
    );
    const averageMs = completed.length
      ? completed.reduce((sum, receipt) => {
          const end = new Date(receipt.approvedAt || receipt.rejectedAt).getTime();
          const start = new Date(receipt.createdAt).getTime();
          return sum + Math.max(end - start, 0);
        }, 0) / completed.length
      : 0;

    return {
      pending: receipts.filter((receipt) => receipt.status === "pending").length,
      approved: receipts.filter((receipt) => receipt.status === "approved").length,
      rejected: receipts.filter((receipt) => receipt.status === "rejected").length,
      approvedToday,
      rejectedToday,
      averageValidation:
        averageMs > 0 ? `${Math.max(Math.round(averageMs / 60000), 1)} min` : "-",
    };
  }, [receipts]);

  const openReceipt = async (receipt) => {
    setError("");
    setActiveReceipt(receipt);
    setReceiptPreviewUrl("");

    try {
      const detailRes = await authFetch(`/api/receipts/${receipt._id}`, {
        cache: "no-store",
      });
      const detail = await detailRes.json().catch(() => ({}));

      if (detailRes.ok) {
        setActiveReceipt({
          ...receipt,
          ...detail.receipt,
          invoice: detail.invoice || receipt.invoice,
        });
      }

      const fileRes = await authFetch(`/api/receipts/${receipt._id}`, {
        method: "POST",
      });

      if (fileRes.ok) {
        const blob = await fileRes.blob();
        setReceiptPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (openError) {
      setError(openError.message || "Unable to open receipt");
    }
  };

  const updateReceipt = async (receipt, action, reason = "") => {
    setBusy(`${receipt._id}-${action}`);
    setMessage("");
    setError("");

    try {
      const res = await authFetch(`/api/receipts/${receipt._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to update receipt");
      }

      setMessage(
        action === "approve"
          ? "Receipt approved and invoice marked paid."
          : "Receipt rejected."
      );
      setRejecting(null);
      setActiveReceipt(null);
      await loadReceipts();
    } catch (updateError) {
      setError(updateError.message || "Unable to update receipt");
    } finally {
      setBusy("");
    }
  };

  const pendingReceipts = receipts.filter((receipt) => receipt.status === "pending");

  return (
    <PageShell>
      <PageHeader
        title="Receipt Validation"
        description="Review uploaded bank transfer receipts and approve or reject payments."
      />

      <StatGrid>
        <StatCard label="Pending Receipt Validation" value={stats.pending} tone="orange" />
        <StatCard label="Approved Receipts" value={stats.approved} tone="emerald" />
        <StatCard label="Rejected Receipts" value={stats.rejected} tone="red" />
        <StatCard label="Receipts Approved Today" value={stats.approvedToday} tone="emerald" />
        <StatCard label="Receipts Rejected Today" value={stats.rejectedToday} tone="red" />
        <StatCard label="Average Validation Time" value={stats.averageValidation} tone="blue" />
      </StatGrid>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Pending receipts
          </h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading receipts...</div>
        ) : pendingReceipts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Invoice Number</th>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Amount</th>
                  <th className="px-5 py-3 text-left">Upload Date</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingReceipts.map((receipt) => (
                  <tr key={receipt._id}>
                    <td className="px-5 py-4 font-mono text-sm">
                      {receipt.invoiceNumber || receipt.invoice?.invoiceNumber || "-"}
                    </td>
                    <td className="px-5 py-4">{receipt.customerName || "-"}</td>
                    <td className="px-5 py-4 font-semibold">
                      {formatCurrency(receipt.amount)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDate(receipt.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={getStatusTone(receipt.status)}>
                        {receipt.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openReceipt(receipt)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                        >
                          View Receipt
                        </button>
                        <button
                          onClick={() => updateReceipt(receipt, "approve")}
                          disabled={busy === `${receipt._id}-approve`}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Approve Payment
                        </button>
                        <button
                          onClick={() => setRejecting(receipt)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                        >
                          Reject Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No pending receipts"
            description="New customer receipt uploads will appear here."
          />
        )}
      </SurfaceCard>

      {activeReceipt ? (
        <ReceiptDrawer
          receipt={activeReceipt}
          previewUrl={receiptPreviewUrl}
          onClose={() => setActiveReceipt(null)}
          onApprove={() => updateReceipt(activeReceipt, "approve")}
          onReject={() => setRejecting(activeReceipt)}
          busy={busy}
        />
      ) : null}

      {rejecting ? (
        <RejectModal
          receipt={rejecting}
          onCancel={() => setRejecting(null)}
          onReject={(reason) => updateReceipt(rejecting, "reject", reason)}
          busy={busy}
        />
      ) : null}
    </PageShell>
  );
}

function ReceiptDrawer({ receipt, previewUrl, onClose, onApprove, onReject, busy }) {
  const invoice = receipt.invoice || {};
  const extracted = receipt.extracted || {};

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 p-4">
      <div className="mx-auto grid h-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-2">
        <div className="flex min-h-[320px] items-center justify-center bg-slate-100 p-4">
          {previewUrl ? (
            receipt.fileType === "application/pdf" ? (
              <iframe src={previewUrl} className="h-full min-h-[640px] w-full rounded-xl" />
            ) : (
              <img src={previewUrl} alt="Uploaded receipt" className="max-h-full rounded-xl object-contain" />
            )
          ) : (
            <p className="text-sm text-slate-500">Loading receipt preview...</p>
          )}
        </div>

        <div className="overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Receipt review
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {receipt.invoiceNumber || invoice.invoiceNumber || "-"}
              </h2>
            </div>
            <button onClick={onClose} className="text-slate-500">Close</button>
          </div>

          <InfoBlock
            title="Invoice Details"
            rows={[
              ["Invoice Number", invoice.invoiceNumber || receipt.invoiceNumber || "-"],
              ["Customer", receipt.customerName || invoice.customer || invoice.customerName || "-"],
              ["Invoice Amount", formatCurrency(invoice.amount || receipt.amount)],
              ["Invoice Date", formatDate(invoice.date || invoice.createdAt)],
            ]}
          />

          <InfoBlock
            title="Payment Information"
            rows={[
              ["Uploaded Amount", extracted.amount ? formatCurrency(extracted.amount) : "-"],
              ["Transaction Reference", receipt.transactionReference || extracted.transactionReference || "-"],
              ["Payment Date", receipt.paymentDate || extracted.transactionDate || "-"],
              ["Payment Time", receipt.paymentTime || extracted.transactionTime || "-"],
              ["Date & Time", extracted.transactionDateTime || "-"],
              ["Sender Name", receipt.senderName || extracted.senderName || "-"],
              ["Receiver Name", receipt.recipientName || extracted.recipientName || "-"],
              ["Bank", extracted.bankName || "-"],
            ]}
          />

          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">OCR validation</h3>
              <StatusBadge tone={Number(extracted.confidence || 0) >= 75 ? "green" : "orange"}>
                {Number(extracted.confidence || 0)}%
              </StatusBadge>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {(extracted.checks || []).map((check) => (
                <p key={check.label} className={check.ok ? "text-emerald-700" : "text-amber-700"}>
                  {check.ok ? "✓" : "⚠"} {check.label}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onApprove}
              disabled={busy === `${receipt._id}-approve`}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Approve Payment
            </button>
            <button
              onClick={onReject}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600"
            >
              Reject Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, rows }) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-medium text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RejectModal({ receipt, onCancel, onReject, busy }) {
  const [reason, setReason] = useState("Incorrect amount");
  const reasons = [
    "Incorrect amount",
    "Receipt unreadable",
    "Payment not found",
    "Duplicate receipt",
    "Wrong invoice",
    "Other",
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Reject receipt</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select why this receipt cannot be confirmed.
        </p>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {reasons.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onReject(reason)}
            disabled={busy === `${receipt._id}-reject`}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
