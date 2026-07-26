"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useConfirm } from "../../../components/AppFeedback";
import { authFetch } from "../../../lib/authFetch";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

export default function MobilePaymentsPage() {
  const confirm = useConfirm();
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);
  const [reviewedReceiptIds, setReviewedReceiptIds] = useState([]);
  const [rejecting, setRejecting] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [paymentRes, receiptRes] = await Promise.all([
          authFetch("/api/mobile/payments"),
          authFetch("/api/mobile/receipts"),
        ]);
        const paymentData = await paymentRes.json().catch(() => []);
        const receiptData = await receiptRes.json().catch(() => []);

        if (!paymentRes.ok) {
          throw new Error(paymentData.error || "Unable to load payments");
        }

        setPayments(Array.isArray(paymentData) ? paymentData : []);
        setReceipts(receiptRes.ok && Array.isArray(receiptData) ? receiptData : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load payments");
      }
    };

    load();
  }, []);

  const openReceipt = async (receipt) => {
    setBusy(`${receipt._id}-view`);
    setError("");

    try {
      const res = await authFetch(`/api/receipts/${receipt._id}`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to open receipt");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreview({ receipt, url });
      setReviewedReceiptIds((current) =>
        current.includes(receipt._id) ? current : [...current, receipt._id]
      );
    } catch (previewError) {
      setError(previewError.message || "Unable to open receipt");
    } finally {
      setBusy("");
    }
  };

  const closePreview = () => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
  };

  const reviewReceipt = async (receipt, action, reason = "") => {
    if (action === "approve") {
      const approved = await confirm({
        title: "Approve this payment?",
        message: `This will mark ${receipt.invoiceNumber || "the invoice"} as paid and notify the customer.`,
        confirmLabel: "Approve payment",
        tone: "warning",
      });

      if (!approved) {
        return;
      }
    }

    setBusy(`${receipt._id}-${action}`);
    setError("");
    setMessage("");

    try {
      const res = await authFetch("/api/mobile/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId: receipt._id,
          action,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to update receipt");
      }

      setMessageTone(
        action === "reject" && !data.notification?.sent ? "warning" : "success"
      );
      setMessage(
        action === "approve"
          ? "Payment approved."
          : data.notification?.sent
            ? "Receipt rejected and the customer was notified on WhatsApp."
            : "Receipt rejected, but the WhatsApp message could not be sent."
      );
      setRejecting(null);
      setReceipts((current) => current.filter((item) => item._id !== receipt._id));
    } catch (receiptError) {
      setError(receiptError.message || "Unable to update receipt");
    } finally {
      setBusy("");
    }
  };

  const filtered = useMemo(() => {
    return payments.filter((payment) => {
      const matchesStatus =
        statusFilter === "all" ||
        String(payment.status || "").toLowerCase().includes(statusFilter);
      const haystack = `${payment.customer} ${payment.invoiceNumber} ${payment.amount}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [payments, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {["all", "paid", "pending", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-2xl px-3 py-2 text-sm font-medium ${
              statusFilter === status ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search customer, invoice, amount"
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
      />

      {message ? (
        <p className={`text-sm ${messageTone === "warning" ? "text-amber-300" : "text-emerald-300"}`}>
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {receipts.length ? (
          <div className="rounded-3xl border border-amber-800 bg-amber-950/40 p-4">
            <p className="text-sm font-semibold text-amber-200">Receipt Validation</p>
            <div className="mt-4 space-y-3">
              {receipts.map((receipt) => (
                <div key={receipt._id} className="rounded-2xl bg-slate-950 px-4 py-3">
                  <p className="font-medium text-white">{receipt.customerName || "Customer"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {receipt.invoiceNumber || "Pending invoice"} - {formatCurrency(receipt.amount)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => openReceipt(receipt)}
                      disabled={Boolean(busy)}
                      className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {busy === `${receipt._id}-view` ? "Opening..." : "View receipt"}
                    </button>
                    {reviewedReceiptIds.includes(receipt._id) ? (
                      <>
                        <button
                          onClick={() => reviewReceipt(receipt, "approve")}
                          disabled={Boolean(busy)}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejecting(receipt)}
                          disabled={Boolean(busy)}
                          className="rounded-xl border border-red-400 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                  {!reviewedReceiptIds.includes(receipt._id) ? (
                    <p className="mt-2 text-xs text-amber-300">View the receipt before deciding.</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {filtered.map((payment) => (
          <div key={payment._id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{payment.customer || "Customer"}</p>
                <p className="text-xs text-slate-500">{payment.invoiceNumber || "-"}</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {payment.status || "Unknown"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Amount" value={formatCurrency(payment.amount)} />
              <Info label="Paid" value={formatCurrency(payment.paidAmount)} />
              <Info label="Balance" value={formatCurrency(payment.balanceDue)} />
              <Info
                label="Date"
                value={payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "-"}
              />
            </div>
          </div>
        ))}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Receipt preview</p>
              <p className="text-xs text-slate-400">
                {preview.receipt.invoiceNumber || "Pending invoice"}
              </p>
            </div>
            <button
              type="button"
              onClick={closePreview}
              className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-white"
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
            {preview.receipt.fileType === "application/pdf" ? (
              <iframe title="Uploaded receipt" src={preview.url} className="h-full w-full" />
            ) : (
              <Image
                src={preview.url}
                alt="Uploaded receipt"
                width={1200}
                height={1600}
                unoptimized
                className="max-h-full w-auto max-w-full object-contain"
              />
            )}
          </div>
        </div>
      ) : null}

      {rejecting ? (
        <MobileRejectModal
          receipt={rejecting}
          busy={busy}
          onCancel={() => setRejecting(null)}
          onReject={(reason) => reviewReceipt(rejecting, "reject", reason)}
        />
      ) : null}
    </div>
  );
}

function MobileRejectModal({ receipt, busy, onCancel, onReject }) {
  const [reason, setReason] = useState("Incorrect amount");
  const [customReason, setCustomReason] = useState("");
  const reasons = [
    "Incorrect amount",
    "Receipt unreadable",
    "Payment not found",
    "Duplicate receipt",
    "Wrong invoice",
    "Other",
  ];
  const rejectionReason = reason === "Other" ? customReason.trim() : reason;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-4">
      <div className="w-full rounded-3xl bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Reject receipt</h2>
        <p className="mt-1 text-sm text-slate-400">
          The customer will receive this reason on WhatsApp.
        </p>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
        >
          {reasons.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        {reason === "Other" ? (
          <textarea
            value={customReason}
            onChange={(event) => setCustomReason(event.target.value)}
            rows={3}
            placeholder="Enter the rejection reason"
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
          />
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={Boolean(busy)}
            className="rounded-xl border border-slate-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onReject(rejectionReason)}
            disabled={Boolean(busy) || !rejectionReason}
            className="rounded-xl bg-red-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === `${receipt._id}-reject` ? "Rejecting..." : "Reject and notify"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
