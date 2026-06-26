"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../../../lib/authFetch";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadPayments = async () => {
    try {
      const res = await authFetch("/api/invoices");
      const data = res.ok ? await res.json() : [];

      const paidInvoices = data
        .filter((inv) => inv.status?.toLowerCase() === "paid")
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      setPayments(paidInvoices);
    } catch (error) {
      console.error("Failed to load payments", error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadPayments();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const filteredPayments = payments.filter((payment) =>
    (payment.customer || payment.customerName || payment.student || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalCollected = filteredPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Payments</h1>
            <p className="text-gray-600 mt-1">
              Review confirmed invoice payments
            </p>
          </div>

          <div className="mt-6 sm:mt-0 flex items-center gap-8">
            <div>
              <p className="text-sm text-gray-500">Total Collected</p>
              <p className="text-4xl font-semibold text-emerald-600">
                ₦{totalCollected.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-4xl font-semibold text-gray-900">
                {filteredPayments.length}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-5 py-3 border border-gray-300 rounded-2xl"
          />
        </div>

        {loading ? (
          <div className="text-center py-20">Loading...</div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No payments found
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-8 py-5 text-left text-sm text-gray-500">Date</th>
                    <th className="px-8 py-5 text-left text-sm text-gray-500">Customer Name</th>
                    <th className="px-8 py-5 text-left text-sm text-gray-500">Category</th>
                    <th className="px-8 py-5 text-left text-sm text-gray-500">Amount</th>
                    <th className="px-8 py-5 text-left text-sm text-gray-500">Status</th>
                    <th className="px-8 py-5 text-left text-sm text-gray-500">Reference</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredPayments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-gray-50">
                      <td className="px-8 py-6 text-gray-600 text-sm">
                        {payment.date
                          ? new Date(payment.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      <td className="px-8 py-6 font-medium text-gray-900">
                        {payment.customer || payment.customerName || payment.student}
                      </td>

                      <td className="px-8 py-6 text-gray-600">
                        {payment.category || payment.class || "—"}
                      </td>

                      <td className="px-8 py-6">
                        <span className="font-semibold text-emerald-600">
                          ₦{Number(payment.amount || 0).toLocaleString()}
                        </span>
                      </td>

                      <td className="px-8 py-6">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Paid
                        </span>
                      </td>

                      <td className="px-8 py-6 text-gray-500 text-sm">
                        {payment.paymentReference || payment.transactionId || payment.token || payment._id}
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
