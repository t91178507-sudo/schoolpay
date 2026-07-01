"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function QuickPaySuccessPage() {
  const { token } = useParams();
  const searchParams = useSearchParams();
  const paymentReference =
    searchParams.get("paymentReference") ||
    searchParams.get("reference") ||
    "";
  const provider = searchParams.get("provider") || "monnify";
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    if (!token || !paymentReference) {
      return;
    }

    fetch(provider === "payaza" ? "/api/payaza/qr-verify" : "/api/monnify/qr-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileToken: token,
        paymentReference,
      }),
    })
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Unable to confirm payment");
        }

        setStatus("success");
        setMessage("Payment confirmed successfully.");
      })
      .catch((err) => {
        console.error("Failed to confirm quick payment:", err);
        setStatus("error");
        setMessage(err.message || "We could not confirm this payment.");
      });
  }, [paymentReference, provider, token]);

  const displayStatus = !paymentReference ? "error" : status;
  const displayMessage = !paymentReference
    ? "Missing payment confirmation details."
    : message;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center">
        <div
          className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold ${
            displayStatus === "success"
              ? "bg-emerald-50 text-emerald-600"
              : displayStatus === "error"
                ? "bg-red-50 text-red-600"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {displayStatus === "success"
            ? "OK"
            : displayStatus === "error"
              ? "!"
              : "..."}
        </div>

        <h1 className="text-3xl font-bold text-slate-900">
          {displayStatus === "success"
            ? "Payment Successful"
            : displayStatus === "error"
              ? "Payment Not Confirmed"
              : "Processing Payment"}
        </h1>
        <p className="mt-4 text-slate-500">{displayMessage}</p>

        <div className="mt-8 space-y-3">
          <Link
            href={`/pay/qr/${token}`}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800"
          >
            Back to payment
          </Link>
        </div>
      </div>
    </div>
  );
}
