"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const MONNIFY_SDK_SRC = "https://sdk.monnify.com/plugin/monnify.js";

function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    const asString = value.toString?.();
    if (asString && asString !== "[object Object]") {
      const normalized = asString.replace(/[^0-9.]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOutstandingAmount(invoice) {
  const totalAmount = parseAmount(invoice?.amount);
  const recordedBalance = parseAmount(invoice?.balanceDue);
  const paidAmount = parseAmount(invoice?.paidAmount);

  if (recordedBalance > 0) {
    return recordedBalance;
  }

  if (paidAmount > 0) {
    return Math.max(totalAmount - paidAmount, 0);
  }

  return totalAmount;
}

export default function PaymentPage() {
  const { token } = useParams();
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [launchingPayment, setLaunchingPayment] = useState(false);
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.MonnifySDK)
  );

  const openInvoice = (invoice) => {
    setActiveInvoice(invoice);
    setPayAmount(getOutstandingAmount(invoice));
  };

  useEffect(() => {
    if (window.MonnifySDK) {
      return;
    }

    const script = document.createElement("script");
    script.src = MONNIFY_SDK_SRC;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setSdkReady(false);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

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

        const pending = data.invoices.filter((inv) => getOutstandingAmount(inv) > 0);
        if (pending.length === 1) openInvoice(pending[0]);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerInvoices();
  }, [token]);

  const payWithMonnify = async () => {
    if (!activeInvoice) return;
    const invoiceAmount = getOutstandingAmount(activeInvoice);
    const requestedAmount = parseAmount(payAmount);

    if (requestedAmount <= 0) {
      alert("Enter a valid amount");
      return;
    }

    if (requestedAmount > invoiceAmount) {
      alert(
        `Amount cannot be more than the outstanding invoice balance. Maximum: N${invoiceAmount.toLocaleString()}.`
      );
      return;
    }

    setLaunchingPayment(true);

    try {
      const res = await fetch("/api/monnify/checkout-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: activeInvoice.token,
          invoiceId: activeInvoice._id,
          amount: requestedAmount,
          origin: window.location.origin,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.checkoutConfig) {
        throw new Error(data.error || "Unable to launch Monnify payment");
      }

      if (!window.MonnifySDK?.initialize) {
        throw new Error("Monnify SDK is not available yet");
      }

      window.MonnifySDK.initialize({
        ...data.checkoutConfig,
        onComplete: (response) => {
          if (!response?.paymentReference) {
            setLaunchingPayment(false);
            alert("Payment was not completed.");
            return;
          }

          const params = new URLSearchParams({
            paymentReference: response.paymentReference,
            invoiceId: data.invoiceId,
          });

          window.location.href = `/pay/success/${activeInvoice.token}?${params.toString()}`;
        },
        onClose: () => {
          setLaunchingPayment(false);
        },
      });
    } catch (err) {
      console.error(err);
      alert(err.message || "Unable to start Monnify payment");
      setLaunchingPayment(false);
      return;
    }
  };

  const copyToken = () => {
    if (!activeInvoice?.token) return;
    navigator.clipboard.writeText(activeInvoice.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handlePayAmountChange = (event) => {
    const rawValue = event.target.value;

    if (rawValue === "") {
      setPayAmount("");
      return;
    }

    const invoiceAmount = getOutstandingAmount(activeInvoice);
    const nextAmount = parseAmount(rawValue);

    if (!nextAmount) {
      setPayAmount("");
      return;
    }

    setPayAmount(Math.min(nextAmount, invoiceAmount));
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
  const unpaidInvoices = Array.isArray(invoices)
    ? invoices.filter((inv) => getOutstandingAmount(inv) > 0)
    : [];
  const hasInvoices = unpaidInvoices.length > 0;

  if (!hasInvoices) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
            <span className="text-slate-500 text-xl">i</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            No unpaid invoices available
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {customer?.businessName || "This account"} does not have any unpaid invoice on
            this payment link right now.
          </p>
        </div>
      </div>
    );
  }

  if (!activeInvoice) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 py-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="mb-6 px-1">
            <span className="text-[13px] font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
              {customer.businessName || "Invoice Payment"}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
                Select an invoice to pay
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {customer.name}
              </p>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {unpaidInvoices.map((inv) => {
                return (
                  <button
                    key={inv._id}
                    onClick={() => openInvoice(inv)}
                    className="w-full text-left px-8 py-5 flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/50"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        N{Number(getOutstandingAmount(inv)).toLocaleString()}
                      </p>
                      <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
                        {inv.date
                          ? new Date(inv.date).toLocaleDateString() +
                            " " +
                            new Date(inv.date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200"
                    >
                      Pay now
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    );
  }

  const isPaid = activeInvoice.status === "Paid";
  const showBackButton = unpaidInvoices.length > 1;
  const customerName =
    activeInvoice.customer || activeInvoice.customerName || activeInvoice.student;
  const invoiceCategory = activeInvoice.category || activeInvoice.class || "-";
  const invoiceDescription =
    activeInvoice.description || activeInvoice.category || activeInvoice.class || "-";
  const outstandingAmount = getOutstandingAmount(activeInvoice);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 py-16 px-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 px-1">
          {showBackButton ? (
            <button
              onClick={() => setActiveInvoice(null)}
              className="text-[13px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Back to all invoices
            </button>
          ) : (
            <span className="text-[13px] font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-100">
              {customer.businessName || "Invoice Payment"}
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-8 pt-8 pb-7 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
              Invoice amount
            </p>
            <p className="text-[34px] font-semibold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              N{Number(activeInvoice.amount).toLocaleString()}
            </p>
            <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
              Outstanding balance: N{outstandingAmount.toLocaleString()}
            </p>
          </div>

          <div className="px-8 py-6 space-y-4">
            <DetailRow label="Customer name" value={customerName} />
            <DetailRow
              label="Invoice number"
              value={activeInvoice.invoiceNumber || "-"}
            />
            <DetailRow label="Category" value={invoiceCategory} />
            <DetailRow label="Description" value={invoiceDescription} />
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

          <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60">
            <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wide block mb-2">
              Amount to pay
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                N
              </span>
              <input
                type="number"
                min="1"
                max={outstandingAmount}
                value={payAmount}
                onChange={handlePayAmountChange}
                className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[15px] font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:border-slate-400"
              />
            </div>
            <p className="mt-2 text-[12px] text-slate-400">
              You can enter any amount up to N{outstandingAmount.toLocaleString()}.
            </p>
          </div>

          <div className="px-8 pb-8 pt-2">
            <button
              onClick={payWithMonnify}
              disabled={isPaid || launchingPayment || !sdkReady || parseAmount(payAmount) <= 0}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium text-[15px] transition-colors"
            >
              {isPaid
                ? "Already paid"
                : launchingPayment
                  ? "Opening Monnify..."
                  : !sdkReady
                    ? "Loading Monnify..."
                    : `Pay N${parseAmount(payAmount).toLocaleString()}`}
            </button>
            <p className="text-center text-[12px] text-slate-400 mt-3">
              Secured by Monnify
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-slate-400">Powered by InvoiceHub</p>
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
      <span className="text-[13px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-[14px] font-medium text-slate-900 dark:text-slate-100 text-right">
        {value}
      </span>
    </div>
  );
}
