"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PaymentPage() {
  const { token } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ NEW: editable amount
  const [payAmount, setPayAmount] = useState(0);

  useEffect(() => {
    if (!token) return;

    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/by-token/${token}`);
        const data = res.ok ? await res.json() : null;

        setInvoice(data);

        // ✅ set default amount
        if (data?.amount) {
          setPayAmount(Number(data.amount));
        }

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
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

  const payWithTouchPay = () => {
    if (!invoice) return;

    // ✅ VALIDATION: prevent overpayment
    if (payAmount > invoice.amount) {
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

      `${window.location.origin}/pay/success/${invoice.token}`,
      `${window.location.origin}/pay/${invoice.token}`,

      // ✅ USE NEW AMOUNT
      payAmount,

      invoice.student,
      "school@example.com",
      invoice.token,
      "School Fees Payment",
      invoice.phone || "08000000000"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">
            Invalid or Expired Link
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-lg mx-auto px-6">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-10 text-center">
            <div className="text-5xl mb-4">🏫</div>
            <h1 className="text-3xl font-bold">
              School Fees Payment
            </h1>
          </div>

          <div className="p-10 space-y-8">

            <div>
              <p className="text-gray-500 text-sm">Student Name</p>
              <p className="text-2xl font-semibold">
                {invoice.student}
              </p>
            </div>

            {/* ✅ ORIGINAL AMOUNT */}
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <p className="text-gray-500">Invoice Amount</p>
              <p className="text-3xl font-bold mt-2">
                ₦{invoice.amount.toLocaleString()}
              </p>
            </div>

            {/* ✅ NEW INPUT FIELD */}
            <div>
              <p className="text-gray-500 text-sm mb-2">
                Enter Amount to Pay
              </p>

              <input
                type="number"
                value={payAmount}
                onChange={(e) => {
                  const value = Number(e.target.value);

                  // ✅ LIMIT VALUE
                  if (value <= invoice.amount) {
                    setPayAmount(value);
                  }
                }}
                className="w-full px-4 py-3 border rounded-xl text-lg"
              />

              {/* ✅ WARNING */}
              {payAmount > invoice.amount && (
                <p className="text-red-500 text-sm mt-1">
                  Cannot exceed ₦{invoice.amount.toLocaleString()}
                </p>
              )}
            </div>

            {/* STATUS */}
            <div className="text-center space-y-4">
              <span className={`inline-block px-4 py-2 rounded-full text-sm ${
                invoice.status === "Paid"
                  ? "bg-green-100 text-green-700"
                  : "bg-orange-100 text-orange-700"
              }`}>
                {invoice.status}
              </span>

              <button
                onClick={payWithTouchPay}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-medium hover:bg-blue-700"
              >
                Pay ₦{payAmount.toLocaleString()}
              </button>
            </div>

          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-8">
          Powered by SchoolPay
        </p>
      </div>
    </div>
  );
}