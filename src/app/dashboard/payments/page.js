"use client";

import { useEffect, useState } from "react";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch invoices and get ONLY paid ones
  const loadPayments = async () => {
    try {
      const res = await fetch("/api/invoices");
      const data = await res.json();

      console.log("Invoices:", data); // ✅ debug

      const paidPayments = data
        .filter((inv) => inv.status?.toLowerCase() === "paid")
        .sort(
          (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
        );

      setPayments(paidPayments);
    } catch (error) {
      console.error("Failed to load payments", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto refresh every 5 seconds
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

  const transactionId = new Date().getTime();

  window.sendPaymentInfos(
    transactionId,
    "NGTST0005",
    "B2E7NB4n54OjG2ggsc39UU6aHTCQN81uMQqRLermopbvQiBXJS",

    // ✅ success + cancel URLs
    window.location.origin + `/pay/success/${invoice.token}`,
    window.location.origin + `/pay/${invoice.token}`,

    // ✅ amount
    invoice.amount,

    // ✅ customer details
    invoice.student,
    "school@example.com",

    // ✅ IMPORTANT: use TOKEN HERE
    sendPaymentInfos(invoice.token)``,

    "School Fees Payment",
    invoice.phone || "08000000000"
  );
};

  // Filter by student name
  const filteredPayments = payments.filter((payment) =>
    (payment.student || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Totals
  const totalCollected = filteredPayments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  const totalPayments = filteredPayments.length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">

        {/* ✅ HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Payments
            </h1>
            <p className="text-gray-600 mt-1">
              Record and view all school fees payments
            </p>
          </div>

          <div className="mt-6 sm:mt-0 flex items-center gap-8">
            <div>
              <p className="text-sm text-gray-500">
                Total Collected
              </p>
              <p className="text-4xl font-semibold text-emerald-600">
                ₦{totalCollected.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Transactions
              </p>
              <p className="text-4xl font-semibold text-gray-900">
                {totalPayments}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ SEARCH */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-5 py-3 border border-gray-300 rounded-2xl"
          />
        </div>

        {/* ✅ LOADING */}
        {loading ? (
          <div className="text-center py-20">Loading...</div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

            {/* ✅ EMPTY STATE */}
            {filteredPayments.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No payments found
              </div>
            ) : (

              /* ✅ TABLE */
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">

                    <th className="px-8 py-5 text-left text-sm text-gray-500">
                      Date
                    </th>

                    <th className="px-8 py-5 text-left text-sm text-gray-500">
                      Student Name
                    </th>

                    <th className="px-8 py-5 text-left text-sm text-gray-500">
                      Amount
                    </th>

                    <th className="px-8 py-5 text-left text-sm text-gray-500">
                      Status
                    </th>

                    <th className="px-8 py-5 text-left text-sm text-gray-500">
                      Transaction ID
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredPayments.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50">

                      {/* DATE */}
                      <td className="px-8 py-6 text-gray-600 text-sm">
                        {p.date
                          ? new Date(p.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* STUDENT */}
                      <td className="px-8 py-6 font-medium text-gray-900">
                        {p.student}
                      </td>

                      {/* AMOUNT */}
                      <td className="px-8 py-6">
                        <span className="font-semibold text-emerald-600">
                          ₦{p.amount?.toLocaleString() || "0"}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-8 py-6">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Paid
                        </span>
                      </td>

                      {/* TRANSACTION ID */}
                      <td className="px-8 py-6 text-gray-500 text-sm">
                        {p.transactionId || p._id}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>

            )}
          </div>
        )}
      </div>
    </div>
  );
}