"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../../../lib/authFetch";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

export default function MobilePaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

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

  const reviewReceipt = async (receiptId, action) => {
    setBusy(`${receiptId}-${action}`);
    setError("");

    try {
      const res = await authFetch("/api/mobile/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId,
          action,
          reason: action === "reject" ? "Rejected from mobile dashboard" : "",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to update receipt");
      }

      setReceipts((current) => current.filter((receipt) => receipt._id !== receiptId));
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
                    {receipt.invoiceNumber || "Pending invoice"} • {formatCurrency(receipt.amount)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => reviewReceipt(receipt._id, "approve")}
                      disabled={Boolean(busy)}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reviewReceipt(receipt._id, "reject")}
                      disabled={Boolean(busy)}
                      className="rounded-xl border border-red-400 px-3 py-2 text-xs font-semibold text-red-200"
                    >
                      Reject
                    </button>
                  </div>
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
