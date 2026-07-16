"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  const [copiedPayazaField, setCopiedPayazaField] = useState("");
  const [copiedReceiptField, setCopiedReceiptField] = useState("");
  const [launchingPayment, setLaunchingPayment] = useState(false);
  const [payazaAccount, setPayazaAccount] = useState(null);
  const [verifyingPayaza, setVerifyingPayaza] = useState(false);
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptFields, setReceiptFields] = useState({
    phoneNumber: "",
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptSubmitted, setReceiptSubmitted] = useState(false);
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.MonnifySDK)
  );
  const payazaVerifyInFlight = useRef(false);
  const autoCheckingPayaza = Boolean(activeInvoice && payazaAccount?.paymentReference);

  const openInvoice = (invoice) => {
    setActiveInvoice(invoice);
    setPayAmount(getOutstandingAmount(invoice));
    setPayazaAccount(null);
    setReceiptFormOpen(false);
    setReceiptSubmitted(false);
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
          token,
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

  const payWithPayaza = async () => {
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
      const res = await fetch("/api/payaza/virtual-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          invoiceId: activeInvoice._id,
          amount: requestedAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.virtualAccount) {
        throw new Error(data.error || "Unable to create PayAza virtual account");
      }

      setPayazaAccount({
        ...data.virtualAccount,
        invoiceId: data.invoiceId,
        paymentReference: data.paymentReference,
      });
    } catch (err) {
      console.error(err);
      alert(err.message || "Unable to start PayAza payment");
    } finally {
      setLaunchingPayment(false);
    }
  };

  const verifyPayazaPayment = useCallback(async ({ silent = false } = {}) => {
    if (!activeInvoice || !payazaAccount?.paymentReference || payazaVerifyInFlight.current) {
      return false;
    }

    payazaVerifyInFlight.current = true;

    if (!silent) {
      setVerifyingPayaza(true);
    }

    try {
      const res = await fetch("/api/payaza/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          invoiceId: activeInvoice._id,
          paymentReference: payazaAccount.paymentReference,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment is not complete yet");
      }

      const params = new URLSearchParams({
        paymentReference: payazaAccount.paymentReference,
        invoiceId: activeInvoice._id,
      });

      window.location.href = `/pay/success/${token}?${params.toString()}`;
      return true;
    } catch (err) {
      if (!silent) {
        alert(err.message || "Payment is not complete yet");
      }
      return false;
    } finally {
      payazaVerifyInFlight.current = false;
      if (!silent) {
        setVerifyingPayaza(false);
      }
    }
  }, [activeInvoice, payazaAccount, token]);

  useEffect(() => {
    if (!activeInvoice || !payazaAccount?.paymentReference) {
      return undefined;
    }

    const firstCheck = window.setTimeout(() => {
      verifyPayazaPayment({ silent: true });
    }, 4000);

    const intervalId = window.setInterval(() => {
      verifyPayazaPayment({ silent: true });
    }, 5000);

    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(intervalId);
    };
  }, [activeInvoice, payazaAccount, verifyPayazaPayment]);

  const copyPayazaValue = (field, value) => {
    if (!value) return;

    navigator.clipboard.writeText(String(value));
    setCopiedPayazaField(field);
    setTimeout(() => setCopiedPayazaField(""), 1500);
  };

  const copyReceiptValue = (field, value) => {
    if (!value) return;

    navigator.clipboard.writeText(String(value));
    setCopiedReceiptField(field);
    setTimeout(() => setCopiedReceiptField(""), 1500);
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

  const submitReceipt = async (event) => {
    event.preventDefault();

    if (!activeInvoice || !receiptFile) {
      alert("Upload your payment receipt.");
      return;
    }

    setUploadingReceipt(true);

    try {
      const body = new FormData();
      body.append("invoiceId", activeInvoice._id);
      body.append("receipt", receiptFile);
      body.append("phoneNumber", receiptFields.phoneNumber);

      const res = await fetch(`/api/receipts/by-token/${token}`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to upload receipt");
      }

      setReceiptSubmitted(true);
    } catch (uploadError) {
      alert(uploadError.message || "Unable to upload receipt");
    } finally {
      setUploadingReceipt(false);
    }
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
  const paymentGateway = customer.defaultPaymentGateway === "payaza" ? "payaza" : "monnify";
  const receiptUploadEnabled =
    customer.defaultPaymentGateway === "receiptUpload" &&
    customer.receiptUpload?.enabled;

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-3 py-3 dark:bg-slate-950 sm:px-4 sm:py-16">
      <div className="max-w-md mx-auto">
        <div className="mb-3 flex items-center justify-between px-1 sm:mb-6">
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 pb-4 pt-4 dark:border-slate-800 sm:px-8 sm:pb-7 sm:pt-8">
            <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
              Amount to pay
            </p>
            <p className="mt-1 text-[1.85rem] font-semibold tabular-nums text-slate-900 dark:text-slate-100 sm:text-[34px]">
              N{outstandingAmount.toLocaleString()}
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400 sm:mt-1.5 sm:text-[13px]">
              Full invoice amount: N{Number(activeInvoice.amount || 0).toLocaleString()}
            </p>
          </div>

          <div className="space-y-2.5 px-4 py-3 sm:px-8 sm:py-6 sm:space-y-4">
            {customer.businessLogo ? (
              <div className="mb-1 flex justify-center sm:mb-2">
                <Image
                  src={customer.businessLogo}
                  alt={customer.businessName || "Business logo"}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-12 w-12 rounded-xl object-cover sm:h-16 sm:w-16 sm:rounded-2xl"
                />
              </div>
            ) : null}
            <DetailRow label="Customer name" value={customerName} />
            <DetailRow
              label="Invoice number"
              value={activeInvoice.invoiceNumber || "-"}
            />
            <DetailRow label="Category" value={invoiceCategory} />
            <DetailRow label="Description" value={invoiceDescription} />
            <DetailRow
              label="Due date"
              value={
                activeInvoice.dueDate
                  ? new Date(activeInvoice.dueDate).toLocaleDateString()
                  : "-"
              }
            />
          </div>

          {receiptUploadEnabled ? (
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 sm:px-8 sm:py-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Bank transfer details
              </p>
              <div className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:mt-4 sm:p-4">
                <p className="text-[13px] leading-5 text-slate-600 dark:text-slate-300">
                  Open the payment details popup to view the bank name, account name, and account number.
                </p>
                <button
                  type="button"
                  onClick={() => setPaymentDetailsOpen(true)}
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  View payment details
                </button>
              </div>
              {customer.receiptUpload.paymentInstructions ? (
                <p className="mt-2.5 text-[12px] leading-5 text-slate-500 sm:mt-3 sm:text-sm sm:leading-6">
                  {customer.receiptUpload.paymentInstructions}
                </p>
              ) : null}
            </div>
          ) : (
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 sm:px-8 sm:py-6">
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
          )}

          <div className="px-4 pb-4 pt-1.5 sm:px-8 sm:pb-8 sm:pt-2">
            {receiptUploadEnabled ? (
              <>
                <button
                  type="button"
                  onClick={() => setReceiptFormOpen(true)}
                  disabled={receiptSubmitted}
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300 sm:py-3.5 sm:text-[15px]"
                >
                  {receiptSubmitted ? "Receipt submitted" : "I've Made Payment"}
                </button>
                <p className="mt-1.5 text-center text-[11px] text-slate-400 sm:mt-2 sm:text-[12px]">
                  Upload proof after completing your bank transfer.
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={paymentGateway === "payaza" ? payWithPayaza : payWithMonnify}
                  disabled={
                    isPaid ||
                    launchingPayment ||
                    (paymentGateway === "monnify" && !sdkReady) ||
                    parseAmount(payAmount) <= 0
                  }
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium text-[15px] transition-colors"
                >
                  {isPaid
                    ? "Already paid"
                    : launchingPayment
                      ? paymentGateway === "payaza"
                        ? "Generating account..."
                        : "Opening Monnify..."
                      : paymentGateway === "monnify" && !sdkReady
                        ? "Loading Monnify..."
                        : `Pay N${parseAmount(payAmount).toLocaleString()}`}
                </button>
                <p className="text-center text-[12px] text-slate-400 mt-3">
                  Secured by {paymentGateway === "payaza" ? "PayAza" : "Monnify"}
                </p>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-slate-400">Powered by InvoiceHub</p>
      </div>
      {payazaAccount && (
        <PayazaPaymentModal
          account={payazaAccount}
          amount={payAmount}
          onClose={() => setPayazaAccount(null)}
          onVerify={verifyPayazaPayment}
          onCopy={copyPayazaValue}
          copiedField={copiedPayazaField}
          verifying={verifyingPayaza}
          autoChecking={autoCheckingPayaza}
        />
      )}
      {receiptFormOpen && (
        <ReceiptUploadModal
          fields={receiptFields}
          setFields={setReceiptFields}
          receiptFile={receiptFile}
          setReceiptFile={setReceiptFile}
          uploading={uploadingReceipt}
          submitted={receiptSubmitted}
          onClose={() => setReceiptFormOpen(false)}
          onSubmit={submitReceipt}
        />
      )}
      {paymentDetailsOpen && receiptUploadEnabled && (
        <BankTransferDetailsModal
          bankName={customer.receiptUpload.bankName}
          accountName={customer.receiptUpload.accountName}
          accountNumber={customer.receiptUpload.accountNumber}
          copiedField={copiedReceiptField}
          onCopy={copyReceiptValue}
          onClose={() => setPaymentDetailsOpen(false)}
        />
      )}
    </div>
  );
}

function BankTransferDetailsModal({
  bankName,
  accountName,
  accountNumber,
  copiedField,
  onCopy,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Bank transfer details
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              Payment details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3">
            <DetailRow label="Bank" value={bankName || "-"} emphasis="medium" />
            <DetailRow label="Account name" value={accountName || "-"} emphasis="medium" />
          </div>
          <div className="mt-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 dark:border-emerald-400 dark:bg-emerald-950/30">
            <DetailRow
              label="Account number"
              value={accountNumber || "-"}
              emphasis="strong"
              action={
                <button
                  type="button"
                  onClick={() => onCopy("accountNumber", accountNumber)}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  {copiedField === "accountNumber" ? "Copied" : "Copy"}
                </button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptUploadModal({
  fields,
  setFields,
  receiptFile,
  setReceiptFile,
  uploading,
  submitted,
  onClose,
  onSubmit,
}) {
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-900">Thank you.</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Your payment receipt has been received and is awaiting verification.
            You will receive confirmation once the business validates your payment.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const update = (field, value) =>
    setFields((current) => ({ ...current, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Receipt upload
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              Upload proof of payment
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500">
            x
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Upload the receipt and we will read the payment details from it.
          </p>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Receipt file
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <span className="mt-1 block text-xs text-slate-400">
              JPG, PNG, or PDF. Maximum 10 MB.
            </span>
          </label>

          <ReceiptField
            label="Phone number"
            value={fields.phoneNumber}
            onChange={(value) => update("phoneNumber", value)}
            placeholder="Optional"
          />
        </div>

        <button
          type="submit"
          disabled={uploading || !receiptFile}
          className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white disabled:bg-slate-300"
        >
          {uploading ? "Submitting..." : "Submit receipt"}
        </button>
      </form>
    </div>
  );
}

function ReceiptField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function DetailRow({ label, value, align = "center", emphasis = "default", action = null }) {
  return (
    <div
      className={`flex flex-col gap-0.5 md:flex-row md:justify-between md:gap-4 ${
        align === "top" ? "md:items-start" : "md:items-center"
      }`}
    >
      <span
        className={`text-[12px] dark:text-slate-300 sm:text-[13px] ${
          emphasis === "strong"
            ? "font-semibold text-slate-700"
            : emphasis === "medium"
              ? "font-semibold text-slate-600"
              : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {label}
      </span>
      <div className="flex flex-col gap-2 md:items-end">
        <span
          className={`break-words text-[13px] font-medium text-slate-900 dark:text-slate-100 md:text-right sm:text-[14px] ${
            emphasis === "strong"
              ? "font-mono text-[0.98rem] font-bold tracking-[0.08em] text-emerald-950 dark:text-emerald-100 sm:text-[1.05rem]"
              : emphasis === "medium"
                ? "text-[14px] font-semibold text-slate-950 dark:text-white sm:text-[15px]"
              : ""
          }`}
        >
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}

function PayazaPaymentModal({
  account,
  amount,
  onClose,
  onVerify,
  onCopy,
  copiedField,
  verifying,
  autoChecking,
}) {
  const amountPayable = Number(account.amountPayable || amount || 0);
  const formattedAmount = amountPayable.toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl dark:bg-slate-900 sm:rounded-[28px]">
        <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                PayAza transfer
              </p>
              <h2 className="mt-1 text-[1.35rem] font-semibold leading-tight text-slate-900 dark:text-slate-100 sm:text-xl">
                Complete your payment
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-base font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 sm:h-9 sm:w-9"
              aria-label="Close PayAza payment"
            >
              x
            </button>
          </div>
          <p className="mt-1.5 text-[0.86rem] leading-6 text-slate-500 dark:text-slate-400 sm:text-sm sm:leading-6">
            Transfer the exact amount to the temporary account below. PayAza will confirm the payment automatically.
          </p>
        </div>

        <div className="space-y-2.5 px-4 py-2.5 sm:px-6 sm:py-5">
          <div className="rounded-2xl bg-slate-950 px-4 py-2.5 text-white sm:px-5 sm:py-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Amount to transfer</p>
            <p className="mt-1 break-words text-[1.7rem] font-semibold leading-none tabular-nums sm:text-3xl">
              N{formattedAmount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800 sm:p-4">
            <div className="space-y-2">
              <DetailRow label="Bank" value={account.bankName || "-"} align="top" />
              <DetailRow label="Account name" value={account.accountName || "-"} align="top" />
              <DetailRow label="Expires" value={`${account.expiresInMinutes || 30} minutes`} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCopy("accountNumber", account.accountNumber)}
            className="w-full rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-2.5 text-left shadow-sm transition hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 sm:px-5 sm:py-4"
          >
            <span className="block text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Account number
            </span>
            <span className="mt-2 flex flex-col gap-2 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
              <span className="break-all font-mono text-[1.55rem] font-black leading-none tracking-[0.1em] text-emerald-950 dark:text-emerald-50 min-[430px]:text-[1.35rem] sm:text-2xl">
                {account.accountNumber || "-"}
              </span>
              <span className="inline-flex w-fit shrink-0 self-start rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white min-[430px]:self-auto">
                {copiedField === "accountNumber" ? "Copied" : "Copy"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onVerify}
            disabled={verifying || autoChecking}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-[14px] font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:py-3.5 sm:text-[15px]"
          >
            {verifying
              ? "Checking payment..."
              : autoChecking
                ? "Waiting for automatic confirmation..."
                : "I have made the transfer"}
          </button>
          <p className="text-center text-[12px] leading-5 text-slate-500 dark:text-slate-400">
            We are checking for payment automatically. This page will continue once the transfer is confirmed.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-300 bg-white py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:py-3 sm:text-[14px]"
          >
            Back to invoice
          </button>
        </div>
      </div>
    </div>
  );
}
