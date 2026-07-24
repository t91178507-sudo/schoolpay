"use client";

import { useState } from "react";
import { authFetch } from "../lib/authFetch";
import { generateInvoiceToken } from "../lib/invoiceUtils";
import { useToast } from "./AppFeedback";

export default function CreateInvoiceModal({ isOpen, onClose, onInvoiceAdded }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    customer: "",
    amount: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer || !formData.amount) {
      toast("warning", "Customer name and amount are required");
      return;
    }

    setLoading(true);

    try {
      const token = generateInvoiceToken("inv");

      const res = await authFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
          status: "Unpaid",
          token,
        }),
      });

      if (res.ok) {
        const newInvoice = await res.json();
        onInvoiceAdded?.(newInvoice);
        onClose();
        setFormData({
          customer: "",
          amount: "",
          category: "",
          date: new Date().toISOString().split("T")[0],
        });
      } else {
        toast("error", "Failed to create invoice");
      }
    } catch (error) {
      console.error(error);
      toast("error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden dark:bg-slate-900">
        <div className="px-8 py-6 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Create New Invoice</h2>
          <p className="text-gray-500 mt-1 dark:text-slate-400">Generate an invoice for a customer</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
              Customer Name
            </label>
            <input
              type="text"
              name="customer"
              value={formData.customer}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                Amount (₦)
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="45000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                Category
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Consulting"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
              Due Date
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-300"
            >
              {loading ? "Creating Invoice..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


