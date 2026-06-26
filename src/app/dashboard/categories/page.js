"use client";

import { useEffect, useState } from "react";
import AddCustomerModal from "../../../components/AddCustomerModal";
import { authFetch } from "../../../lib/authFetch";
import {
  buildInvoiceMessage,
  generateInvoiceToken,
  toWhatsAppNumber,
} from "../../../lib/invoiceUtils";

export default function CategoriesPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await authFetch("/api/customers");
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch customers", error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      fetchCustomers();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const grouped = customers.reduce((acc, customer) => {
    const category = customer.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(customer);
    return acc;
  }, {});

  const categoryList = Object.keys(grouped).sort();
  const selectedCustomers = selectedCategory ? grouped[selectedCategory] || [] : [];

  const createInvoicePayload = (customer, amount, businessName) => {
    const token = generateInvoiceToken("inv");
    const customerToken = customer.token || generateInvoiceToken("cust");

    return {
      customer: customer.name,
      customerName: customer.name,
      category: customer.category,
      email: customer.email || "",
      amount,
      status: "Unpaid",
      token,
      customerToken,
      phone: customer.phone || customer.customerPhone || customer.parentPhone || "",
      businessName,
      date: new Date().toISOString(),
    };
  };

  const deleteCustomer = async (id) => {
    if (!confirm("Delete this customer?")) return;
    try {
      const res = await authFetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) fetchCustomers();
    } catch {
      alert("Failed to delete customer");
    }
  };

  const openInvoiceModal = (customer) => {
    setInvoiceCustomer(customer);
    setInvoiceAmount("");
    setInvoiceError("");
  };

  const closeInvoiceModal = () => {
    setInvoiceCustomer(null);
    setInvoiceAmount("");
    setInvoiceError("");
  };

  const confirmGenerateInvoice = async () => {
    const customer = invoiceCustomer;
    if (!customer) return;

    const amount = Number(invoiceAmount);

    if (!invoiceAmount || Number.isNaN(amount) || amount <= 0) {
      setInvoiceError("Enter a valid amount greater than 0");
      return;
    }

    setGenerating(true);
    setInvoiceError("");

    try {
      const phone =
        customer.phone ||
        customer.customerPhone ||
        customer.parentPhone ||
        "";

      if (!phone) {
        setInvoiceError("This customer has no phone number");
        setGenerating(false);
        return;
      }

      const businessName =
        typeof window !== "undefined"
          ? localStorage.getItem("businessName") || ""
          : "";

      const payload = createInvoicePayload(customer, amount, businessName);

      const res = await authFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Invoice failed");

      const whatsappPhone = toWhatsAppNumber(phone);
      const paymentLink = `${window.location.origin}/pay/${payload.token}`;
      const message = buildInvoiceMessage({
        customerName: customer.name,
        category: customer.category,
        amount,
        paymentLink,
      });

      window.open(
        `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
        "_blank"
      );

      closeInvoiceModal();
    } catch (error) {
      console.error(error);
      setInvoiceError("Failed to generate invoice. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const confirmBulkGenerate = async () => {
    const amount = Number(bulkAmount);

    if (!bulkAmount || Number.isNaN(amount) || amount <= 0) {
      setBulkError("Enter a valid amount greater than 0");
      return;
    }

    setBulkGenerating(true);
    setBulkError("");

    const businessName =
      typeof window !== "undefined"
        ? localStorage.getItem("businessName") || ""
        : "";

    let savedCount = 0;
    let whatsappOpenedCount = 0;
    let skippedNoPhone = 0;

    for (const customer of selectedCustomers) {
      const phone =
        customer.phone ||
        customer.customerPhone ||
        customer.parentPhone ||
        "";

      if (!phone) {
        skippedNoPhone++;
        continue;
      }

      try {
        const payload = createInvoicePayload(customer, amount, businessName);
        const res = await authFetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) continue;
        savedCount++;

        const whatsappPhone = toWhatsAppNumber(phone);
        const paymentLink = `${window.location.origin}/pay/${payload.token}`;
        const message = buildInvoiceMessage({
          customerName: customer.name,
          category: customer.category,
          amount,
          paymentLink,
        });

        const opened = window.open(
          `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
          "_blank"
        );

        if (opened) whatsappOpenedCount++;
      } catch (error) {
        console.error("Bulk invoice failed for", customer.name, error);
      }
    }

    setBulkGenerating(false);
    setShowBulkModal(false);
    setBulkAmount("");
    setBulkError("");

    alert(
      `Created ${savedCount} invoice${savedCount !== 1 ? "s" : ""}.\n` +
        `${whatsappOpenedCount} WhatsApp tab${whatsappOpenedCount !== 1 ? "s" : ""} opened` +
        (whatsappOpenedCount < savedCount
          ? " (some may have been blocked by your browser)."
          : ".") +
        (skippedNoPhone > 0
          ? `\n${skippedNoPhone} customer${skippedNoPhone !== 1 ? "s" : ""} skipped because no phone number was saved.`
          : "")
    );
  };

  const deleteCategory = async (category) => {
    const customersInCategory = grouped[category] || [];
    if (customersInCategory.length === 0) {
      setSelectedCategory(null);
      return;
    }

    const confirmed = confirm(
      `Delete the "${category}" category? This will permanently delete all ${customersInCategory.length} customer${customersInCategory.length !== 1 ? "s" : ""} in it. Existing invoices will be kept.`
    );

    if (!confirmed) return;

    try {
      await Promise.all(
        customersInCategory.map((customer) =>
          authFetch(`/api/customers/${customer._id}`, { method: "DELETE" })
        )
      );

      setSelectedCategory(null);
      fetchCustomers();
    } catch (error) {
      console.error(error);
      alert("Failed to delete category");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Categories</h1>
            <p className="text-gray-600 mt-1">Organize customers and generate invoices by category</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-4xl font-semibold text-gray-900">{customers.length}</p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-medium flex items-center gap-2 transition"
            >
              + Add New Customer
            </button>
          </div>
        </div>

        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to All Categories
          </button>
        )}

        {!selectedCategory ? (
          <div>
            <h2 className="text-xl font-medium text-gray-700 mb-6">
              All Categories ({categoryList.length})
            </h2>

            {categoryList.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No customers yet. Add your first customer to create a category.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryList.map((category) => {
                  const count = grouped[category]?.length || 0;
                  return (
                    <div
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="bg-white border border-slate-200 rounded-3xl p-8 hover:shadow-md hover:border-slate-300 transition-all duration-300 cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center text-3xl">
                          👤
                        </div>
                        <div>
                          <h3 className="text-2xl font-semibold text-slate-800">{category}</h3>
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm text-slate-500">Customers</p>
                          <p className="text-5xl font-bold text-slate-800 mt-1">{count}</p>
                        </div>
                        <div className="text-slate-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                          View Customers →
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 px-10 py-8 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-4xl">
                    👥
                  </div>
                  <div>
                    <h2 className="text-4xl font-semibold">{selectedCategory}</h2>
                    <p className="text-slate-300 mt-1 text-lg">
                      {selectedCustomers.length} Customers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setBulkAmount("");
                      setBulkError("");
                      setShowBulkModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                  >
                    Generate Invoice for All
                  </button>
                  <button
                    onClick={() => deleteCategory(selectedCategory)}
                    className="bg-white/10 hover:bg-red-500/80 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                  >
                    Delete Category
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Customer Name</th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Phone Number</th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Email</th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">Token</th>
                    <th className="px-10 py-5 text-right text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-10 py-6 font-medium text-gray-900">{customer.name}</td>
                      <td className="px-10 py-6 text-gray-600">{customer.phone || "—"}</td>
                      <td className="px-10 py-6 text-gray-600">{customer.email || "—"}</td>
                      <td className="px-10 py-6">
                        <span className="font-mono text-xs bg-gray-100 px-3 py-1 rounded-full">
                          {customer.token ? customer.token.substring(0, 15) + "..." : "—"}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right space-x-4">
                        <button
                          onClick={() => openInvoiceModal(customer)}
                          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                          Generate Invoice
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer._id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {invoiceCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-8 py-6 border-b">
              <h2 className="text-2xl font-semibold text-gray-900">Generate Invoice</h2>
              <p className="text-gray-500 mt-1">
                For {invoiceCustomer.name} · {invoiceCustomer.category}
              </p>
            </div>

            <div className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Amount (₦)
                </label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => {
                    setInvoiceAmount(e.target.value);
                    setInvoiceError("");
                  }}
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 45000"
                />
                {invoiceError && (
                  <p className="text-red-600 text-sm mt-2">{invoiceError}</p>
                )}
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="flex-1 py-3.5 text-gray-700 font-medium border border-gray-300 rounded-2xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmGenerateInvoice}
                  disabled={generating}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-medium rounded-2xl transition"
                >
                  {generating ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-8 py-6 border-b">
              <h2 className="text-2xl font-semibold text-slate-900">Generate Invoice for All</h2>
              <p className="text-slate-500 mt-1">
                {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? "s" : ""} in {selectedCategory}
              </p>
            </div>

            <div className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount per customer (₦)
                </label>
                <input
                  type="number"
                  value={bulkAmount}
                  onChange={(e) => {
                    setBulkAmount(e.target.value);
                    setBulkError("");
                  }}
                  autoFocus
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="e.g. 45000"
                />
                {bulkError && (
                  <p className="text-red-600 text-sm mt-2">{bulkError}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  This amount will be applied to every customer in this category, and a WhatsApp message will be prepared for each.
                </p>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-3.5 text-slate-700 font-medium border border-slate-300 rounded-2xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBulkGenerate}
                  disabled={bulkGenerating}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-medium rounded-2xl transition"
                >
                  {bulkGenerating ? "Generating..." : "Generate All"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AddCustomerModal
        key={`${showAddModal}-${selectedCategory || ""}`}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCustomerAdded={fetchCustomers}
        defaultCategory={selectedCategory || ""}
      />
    </div>
  );
}
