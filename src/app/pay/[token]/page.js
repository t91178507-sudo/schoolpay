"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PaymentPage() {
  const { token } = useParams();

  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // The invoice currently being paid (null while showing the picker)
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchCustomerInvoices = async () => {
      try {
        const res = await fetch(`/api/invoices/by-token/${token}/customer`);
        const data = res.ok ? await res.json() : null;

        if (!data) {
          setError(true);
          return;
        }

        setCustomerData(data);

        const pending = data.invoices.filter((inv) => inv.status !== "Paid");

        // If there's exactly one pending invoice, skip the picker
        // and go straight to the payment screen for it.
        if (pending.length === 1) {
          openInvoice(pending[0]);
        }
        // If there's more than one, leave activeInvoice as null
        // so the picker renders below.
        // If there are zero pending (all paid), the picker will
        // show everything marked as paid.

      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerInvoices();
  }, [token]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://touchpay.gutouch.net/touchpayv2/script/touchpaynr/prod_touchpay-0.0.1.js";
    script.async = true;

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const openInvoice = (invoice) => {
    setActiveInvoice(invoice);
    setPayAmount(Number(invoice.amount));
  };

  const payWithTouchPay = () => {
    if (!activeInvoice) return;

    if (payAmount > activeInvoice.amount) {
      alert("Amount cannot be more than invoice amount");
      return;
    }

    if (payAmount <= 0) {
      alert("Enter a valid amount");
      return;
    }

    const transactionId = new Date().getTime();

    if (!window.sendPaymentInfos) {
      alert("Payment system not loaded yet. Please wait.");
      return;
    }

    window.sendPaymentInfos(
      transactionId,
      "NGTST0005",
      "B2E7NB4n54OjG2ggsc39UU6aHTCQN81uMQqRLermopbvQiBXJS",
      `${window.location.origin}/pay/success/${activeInvoice.token}`,
      `${window.location.origin}/pay/${activeInvoice.token}`,
      payAmount,
      activeInvoice.student,
      "school@example.com",
      activeInvoice.token,
      customerData?.customer?.businessName || "Payment",
      activeInvoice.phone || "08000000000"
    );
  };

  const copyToken = () => {
    if (!activeInvoice?.token) return;
    navigator.clipboard.writeText(activeInvoice.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !customerData) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            This payment link is invalid or has expired
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Check the link or contact the sender for a new one.
          </p>
        </div>
      </div>
    );
  }

  const { customer, invoices } = customerData;

  // ✅ PICKER VIEW — shown when there's no single active invoice
  // (i.e. more than one pending invoice, or all are already paid)
  if (!activeInvoice) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-16 px-4">
        <div className="max-w-md mx-auto">

          <div className="mb-6 px-1">
            <span className="text-[13px] font-semibold tracking-wide text-slate-900 uppercase">
              {customer.businessName || "Payment"}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100">
              <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
                Select an invoice to pay
              </p>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {customer.name}
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const isPaid = inv.status === "Paid";
                return (
                  <button
                    key={inv._id}
                    onClick={() => !isPaid && openInvoice(inv)}
                    disabled={isPaid}
                    className={`w-full text-left px-8 py-5 flex items-center justify-between transition-colors ${
                      isPaid
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900 tabular-nums">
                        ₦{Number(inv.amount).toLocaleString()}
                      </p>
                      <p className="text-[12px] text-slate-400 mt-1">
                        {inv.date
                          ? new Date(inv.date).toLocaleDateString() +
                            " " +
                            new Date(inv.date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                        isPaid
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {isPaid ? "Paid" : "Pay now"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-center text-[12px] text-slate-400 mt-6">
            Powered by SchoolPay
          </p>
        </div>
      </div>
    );
  }

  // ✅ PAYMENT VIEW — shown once a single invoice is active
  const isPaid = activeInvoice.status === "Paid";
  const showBackButton = invoices.length > 1;

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-16 px-4">
      <div className="max-w-md mx-auto">

        <div className="flex items-center justify-between mb-6 px-1">
          {showBackButton ? (
            <button
              onClick={() => setActiveInvoice(null)}
              className="text-[13px] font-medium text-slate-500 hover:text-slate-700"
            >
              ← All invoices
            </button>
          ) : (
            <span className="text-[13px] font-semibold tracking-wide text-slate-900 uppercase">
              {customer.businessName || "Payment"}
            </span>
          )}
          <span
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
              isPaid
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {isPaid ? "Paid" : "Awaiting payment"}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">

          <div className="px-8 pt-8 pb-7 border-b border-slate-100">
            <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
              Invoice amount
            </p>
            <p className="text-[34px] font-semibold text-slate-900 mt-1 tabular-nums">
              ₦{activeInvoice.amount.toLocaleString()}
            </p>
          </div>

          <div className="px-8 py-6 space-y-4">
            <DetailRow label="Customer name" value={activeInvoice.student} />
            <DetailRow label="Customer category" value={activeInvoice.class || "—"} />
            <DetailRow
              label="Invoice token"
              value={
                <button
                  onClick={copyToken}
                  className="font-mono text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 hover:bg-slate-100 transition-colors"
                  title="Click to copy"
                >
                  {activeInvoice.token}
                  <span className="ml-2 text-slate-400">
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>
              }
              align="top"
            />
          </div>

          <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50">
            <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wide block mb-2">
              Amount to pay
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                ₦
              </span>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value <= activeInvoice.amount) {
                    setPayAmount(value);
                  }
                }}
                className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[15px] font-medium text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
              />
            </div>

            {payAmount > activeInvoice.amount && (
              <p className="text-red-600 text-[13px] mt-2">
                Cannot exceed ₦{activeInvoice.amount.toLocaleString()}
              </p>
            )}
          </div>

          <div className="px-8 pb-8 pt-2">
            <button
              onClick={payWithTouchPay}
              disabled={isPaid}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium text-[15px] transition-colors"
            >
              {isPaid ? "Already paid" : `Pay ₦${payAmount.toLocaleString()}`}
            </button>
            <p className="text-center text-[12px] text-slate-400 mt-3">
              Secured by TouchPay
            </p>
          </div>
        </div>

        <p className="text-center text-[12px] text-slate-400 mt-6">
          Powered by SchoolPay
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value, align = "center" }) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        align === "top" ? "items-start" : "items-center"
      }`}
    >
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-[14px] font-medium text-slate-900 text-right">
        {value}
      </span>
    </div>
  );
}