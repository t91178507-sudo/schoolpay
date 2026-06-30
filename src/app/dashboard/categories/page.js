"use client";

import { useCallback, useEffect, useState } from "react";
import AddCustomerModal from "../../../components/AddCustomerModal";
import { authFetch } from "../../../lib/authFetch";
import { getCustomerLabels } from "../../../lib/businessLabels";
import { useBusinessSession } from "../../../lib/clientSession";
import {
  calculateInvoiceTotal,
  generateInvoiceNumber,
  generateInvoiceToken,
  sanitizeInvoiceItems,
} from "../../../lib/invoiceUtils";

function createEmptyInvoiceItem() {
  return {
    id: `item_${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    quantity: 1,
    unitPrice: "",
  };
}

export default function CategoriesPage() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const isSchoolBusiness = String(session.businessType || "").toLowerCase() === "school";
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState(null);
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [invoiceItems, setInvoiceItems] = useState([createEmptyInvoiceItem()]);
  const [invoiceError, setInvoiceError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkItems, setBulkItems] = useState([createEmptyInvoiceItem()]);
  const [bulkError, setBulkError] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await authFetch("/api/customers");
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(`Failed to fetch ${customerLabels.plural}`, error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [customerLabels.plural]);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      fetchCustomers();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, [fetchCustomers]);

  const grouped = customers.reduce((acc, customer) => {
    const category = customer.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(customer);
    return acc;
  }, {});

  const categoryList = Object.keys(grouped).sort();
  const selectedCustomers = selectedCategory ? grouped[selectedCategory] || [] : [];
  const getBusinessInvoiceItems = (items, description, editable) => {
    if (editable) {
      return items;
    }

    const firstItem = items[0] || createEmptyInvoiceItem();

    return [
      {
        ...firstItem,
        description: description.trim() || "Invoice payment",
        quantity: 1,
      },
    ];
  };

  const invoiceTotal = calculateInvoiceTotal(
    getBusinessInvoiceItems(invoiceItems, invoiceDescription, isSchoolBusiness)
  );

  const createInvoicePayload = (
    customer,
    items,
    description,
    businessName,
    businessLogo
  ) => {
    const token = generateInvoiceToken("inv");
    const customerToken = customer.token || generateInvoiceToken("cust");
    const sanitizedItems = sanitizeInvoiceItems(items);
    const amount = calculateInvoiceTotal(sanitizedItems);

    return {
      invoiceNumber: generateInvoiceNumber(),
      customer: customer.name,
      customerName: customer.name,
      category: customer.category,
      description,
      items: sanitizedItems,
      subtotal: amount,
      email: customer.email || "",
      amount,
      status: "Unpaid",
      token,
      customerToken,
      phone: customer.phone || customer.customerPhone || customer.parentPhone || "",
      businessName,
      businessLogo: businessLogo || "",
      date: new Date().toISOString(),
    };
  };

  const deleteCustomer = async (id) => {
    if (!confirm(`Delete this ${customerLabels.singular}?`)) return;
    try {
      const res = await authFetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) fetchCustomers();
    } catch {
      alert(`Failed to delete ${customerLabels.singular}`);
    }
  };

  const openInvoiceModal = (customer) => {
    setInvoiceCustomer(customer);
    setInvoiceDescription(
      customer.category ? `${customer.category} invoice` : "Invoice payment"
    );
    setInvoiceItems([createEmptyInvoiceItem()]);
    setInvoiceError("");
  };

  const closeInvoiceModal = () => {
    setInvoiceCustomer(null);
    setInvoiceDescription("");
    setInvoiceItems([createEmptyInvoiceItem()]);
    setInvoiceError("");
  };

  const updateInvoiceItem = (itemId, field, value) => {
    setInvoiceItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]:
                field === "quantity" && (value === "" || Number(value) < 1)
                  ? 1
                  : value,
            }
          : item
      )
    );
    setInvoiceError("");
  };

  const addInvoiceItem = () => {
    setInvoiceItems((current) => [...current, createEmptyInvoiceItem()]);
  };

  const removeInvoiceItem = (itemId) => {
    setInvoiceItems((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((item) => item.id !== itemId);
    });
    setInvoiceError("");
  };

  const updateBulkItem = (itemId, field, value) => {
    setBulkItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]:
                field === "quantity" && (value === "" || Number(value) < 1)
                  ? 1
                  : value,
            }
          : item
      )
    );
    setBulkError("");
  };

  const addBulkItem = () => {
    setBulkItems((current) => [...current, createEmptyInvoiceItem()]);
  };

  const removeBulkItem = (itemId) => {
    setBulkItems((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((item) => item.id !== itemId);
    });
    setBulkError("");
  };

  const confirmGenerateInvoice = async () => {
    const customer = invoiceCustomer;
    if (!customer) return;

    setGenerating(true);
    setInvoiceError("");

    try {
      const invoiceItemsForBusiness = getBusinessInvoiceItems(
        invoiceItems,
        invoiceDescription,
        isSchoolBusiness
      );
      const sanitizedItems = sanitizeInvoiceItems(invoiceItemsForBusiness);
      const amount = calculateInvoiceTotal(sanitizedItems);

      if (!invoiceDescription.trim()) {
        setInvoiceError("Add an invoice description");
        setGenerating(false);
        return;
      }

      if (sanitizedItems.length === 0 || amount <= 0) {
        setInvoiceError("Add at least one valid item with quantity and unit price");
        setGenerating(false);
        return;
      }

      const phone =
        customer.phone ||
        customer.customerPhone ||
        customer.parentPhone ||
        "";

      if (!phone) {
        setInvoiceError(`This ${customerLabels.singular} has no phone number`);
        setGenerating(false);
        return;
      }

      const businessName =
        typeof window !== "undefined"
          ? localStorage.getItem("businessName") || ""
          : "";
      const businessLogo =
        typeof window !== "undefined"
          ? localStorage.getItem("businessLogo") || ""
          : "";

      const payload = createInvoicePayload(
        customer,
        sanitizedItems,
        invoiceDescription.trim(),
        businessName,
        businessLogo
      );

      const res = await authFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Invoice failed");
      const invoiceData = await res.json();
      const notificationRes = await authFetch("/api/notifications/whatsapp/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: String(invoiceData.insertedId || ""),
          origin: window.location.origin,
        }),
      });
      const notificationData = notificationRes.ok
        ? await notificationRes.json()
        : await notificationRes.json().catch(() => ({}));

      if (notificationData?.delivery?.fallbackUrl) {
        window.open(notificationData.delivery.fallbackUrl, "_blank");
      }

      closeInvoiceModal();
    } catch (error) {
      console.error(error);
      setInvoiceError("Failed to generate invoice. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const confirmBulkGenerate = async () => {
    const bulkItemsForBusiness = getBusinessInvoiceItems(
      bulkItems,
      bulkDescription,
      isSchoolBusiness
    );
    const sanitizedBulkItems = sanitizeInvoiceItems(bulkItemsForBusiness);
    const amount = calculateInvoiceTotal(sanitizedBulkItems);

    if (!bulkDescription.trim()) {
      setBulkError("Add an invoice description");
      return;
    }

    if (sanitizedBulkItems.length === 0 || amount <= 0) {
      setBulkError("Add at least one valid item with quantity and unit price");
      return;
    }

    setBulkGenerating(true);
    setBulkError("");

    const businessName =
      typeof window !== "undefined"
        ? localStorage.getItem("businessName") || ""
        : "";
    const businessLogo =
      typeof window !== "undefined"
        ? localStorage.getItem("businessLogo") || ""
        : "";

    let savedCount = 0;
    let notificationCount = 0;
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
        const payload = createInvoicePayload(
          customer,
          sanitizedBulkItems,
          bulkDescription.trim(),
          businessName,
          businessLogo
        );

        const res = await authFetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) continue;
        const invoiceData = await res.json();
        savedCount++;
        const notificationRes = await authFetch("/api/notifications/whatsapp/invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: String(invoiceData.insertedId || ""),
            origin: window.location.origin,
          }),
        });
        const notificationData = notificationRes.ok
          ? await notificationRes.json()
          : await notificationRes.json().catch(() => ({}));

        if (notificationData?.delivery) {
          notificationCount++;
        }

        if (notificationData?.delivery?.fallbackUrl) {
          const opened = window.open(notificationData.delivery.fallbackUrl, "_blank");
          if (opened) whatsappOpenedCount++;
        }
      } catch (error) {
        console.error("Bulk invoice failed for", customer.name, error);
      }
    }

    setBulkGenerating(false);
    setShowBulkModal(false);
    setBulkDescription("");
    setBulkItems([createEmptyInvoiceItem()]);
    setBulkError("");

    alert(
      `Created ${savedCount} invoice${savedCount !== 1 ? "s" : ""}.\n` +
        `${notificationCount} notification${notificationCount !== 1 ? "s" : ""} prepared` +
        (whatsappOpenedCount > 0
          ? `\n${whatsappOpenedCount} WhatsApp tab${whatsappOpenedCount !== 1 ? "s" : ""} opened`
          : "") +
        (whatsappOpenedCount < savedCount
          ? " (some may have been blocked by your browser)."
          : ".") +
        (skippedNoPhone > 0
          ? `\n${skippedNoPhone} ${skippedNoPhone !== 1 ? customerLabels.plural : customerLabels.singular} skipped because no phone number was saved.`
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
      `Delete the "${category}" category? This will permanently delete all ${customersInCategory.length} ${customersInCategory.length !== 1 ? customerLabels.plural : customerLabels.singular} in it. Existing invoices will be kept.`
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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-slate-100">{customerLabels.singularTitle} categories</h1>
            <p className="text-gray-600 dark:text-slate-400 mt-1">
              Organize {customerLabels.singular} groups and generate invoices from one shared billing view.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <div className="text-left sm:text-right">
              <p className="text-sm text-gray-500 dark:text-slate-400">Total {customerLabels.plural}</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-slate-100 sm:text-4xl">
                {customers.length}
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-medium flex items-center gap-2 transition"
            >
              + Add New {customerLabels.singularTitle}
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
            <h2 className="text-xl font-medium text-gray-700 dark:text-slate-300 mb-6">
              All categories ({categoryList.length})
            </h2>

            {categoryList.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-slate-400">
                No {customerLabels.plural} yet. Add your first {customerLabels.singular} to create a category.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryList.map((category) => {
                  const count = grouped[category]?.length || 0;

                  return (
                    <div
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:p-8"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center text-3xl dark:bg-slate-800 dark:text-slate-300">
                          C
                        </div>
                        <div>
                          <h3 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
                            {category}
                          </h3>
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{customerLabels.pluralTitle}</p>
                          <p className="mt-1 text-4xl font-bold text-slate-800 dark:text-slate-100 sm:text-5xl">
                            {count}
                          </p>
                        </div>
                        <div className="text-slate-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                          View {customerLabels.pluralTitle} →
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="bg-slate-800 dark:bg-slate-900 px-5 py-6 text-white sm:px-8 lg:px-10">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-semibold">
                    C
                  </div>
                  <div>
                      <h2 className="text-3xl font-semibold sm:text-4xl">{selectedCategory}</h2>
                    <p className="text-slate-300 mt-1 text-lg">
                      {selectedCustomers.length} {selectedCustomers.length === 1 ? customerLabels.singularTitle : customerLabels.pluralTitle}
                    </p>
                  </div>
                </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={() => {
                      setBulkDescription(
                        selectedCategory ? `${selectedCategory} invoice` : "Category invoice"
                      );
                      setBulkItems([createEmptyInvoiceItem()]);
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

            <div className="divide-y divide-gray-100 dark:divide-slate-800 lg:hidden">
              {selectedCustomers.map((customer) => (
                <div key={customer._id} className="space-y-4 p-5">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900 dark:text-slate-100">{customer.name}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{customer.phone || "-"}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-400">{customer.email || "-"}</p>
                    <p className="break-all font-mono text-xs text-gray-500 dark:text-slate-500">
                      {customer.token ? `${customer.token.substring(0, 15)}...` : "-"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => openInvoiceModal(customer)}
                      className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
                    >
                      Generate Invoice
                    </button>
                    <button
                      onClick={() => deleteCustomer(customer._id)}
                      className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">
                      {customerLabels.singularTitle} Name
                    </th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">
                      Phone Number
                    </th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">
                      Email
                    </th>
                    <th className="px-10 py-5 text-left text-sm font-medium text-gray-500">
                      Token
                    </th>
                    <th className="px-10 py-5 text-right text-sm font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {selectedCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50 dark:hover:bg-slate-950/60 transition-colors">
                      <td className="px-10 py-6 font-medium text-gray-900 dark:text-slate-100">
                        {customer.name}
                      </td>
                      <td className="px-10 py-6 text-gray-600 dark:text-slate-400">
                        {customer.phone || "—"}
                      </td>
                      <td className="px-10 py-6 text-gray-600 dark:text-slate-400">
                        {customer.email || "—"}
                      </td>
                      <td className="px-10 py-6">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 dark:text-slate-300 px-3 py-1 rounded-full">
                          {customer.token ? `${customer.token.substring(0, 15)}...` : "—"}
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="px-8 py-6 border-b dark:border-slate-800">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Generate Invoice</h2>
              <p className="text-gray-500 dark:text-slate-400 mt-1">
                For {invoiceCustomer.name} · {invoiceCustomer.category}
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={invoiceDescription}
                  onChange={(e) => {
                    setInvoiceDescription(e.target.value);
                    setInvoiceError("");
                  }}
                  autoFocus
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What is this invoice for?"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      {isSchoolBusiness ? "Items" : "Invoice amount"}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {isSchoolBusiness
                        ? "The invoice total is calculated from the line items below."
                        : "Enter the fixed amount for this invoice."}
                    </p>
                  </div>
                  {isSchoolBusiness && (
                    <button
                      type="button"
                      onClick={addInvoiceItem}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium"
                    >
                      Add item
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {isSchoolBusiness ? (
                    invoiceItems.map((item, index) => {
                    const quantity = Number(item.quantity || 0);
                    const unitPrice = Number(item.unitPrice || 0);
                    const lineTotal =
                      Number.isFinite(quantity) && Number.isFinite(unitPrice)
                        ? quantity * unitPrice
                        : 0;

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 md:grid-cols-[1.8fr_0.7fr_0.8fr_auto] gap-3 items-end border border-gray-200 dark:border-slate-800 rounded-2xl p-4"
                      >
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
                            Item {index + 1}
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              updateInvoiceItem(item.id, "description", e.target.value)
                            }
                            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Description"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateInvoiceItem(item.id, "quantity", e.target.value)
                            }
                            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
                            Unit price
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateInvoiceItem(item.id, "unitPrice", e.target.value)
                            }
                            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </div>

                        <div className="flex items-center gap-3 md:pb-3">
                          <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 min-w-[90px] text-right">
                            N{lineTotal.toLocaleString()}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeInvoiceItem(item.id)}
                            disabled={invoiceItems.length === 1}
                            className="text-red-600 text-sm font-medium disabled:text-gray-300 dark:disabled:text-slate-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                    })
                  ) : (
                    <div className="rounded-2xl border border-gray-200 p-4 dark:border-slate-800">
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
                        Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={invoiceItems[0]?.unitPrice || ""}
                        onChange={(e) =>
                          updateInvoiceItem(invoiceItems[0].id, "unitPrice", e.target.value)
                        }
                        className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Invoice total</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isSchoolBusiness
                      ? "Calculated from valid line items only"
                      : "Based on the invoice amount above"}
                  </p>
                </div>
                <p className="text-2xl font-semibold text-slate-900">
                  N{invoiceTotal.toLocaleString()}
                </p>
              </div>

              {invoiceError && (
                <p className="text-red-600 text-sm">{invoiceError}</p>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="flex-1 py-3.5 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 transition"
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="px-8 py-6 border-b">
              <h2 className="text-2xl font-semibold text-slate-900">
                Generate Invoice for All
              </h2>
              <p className="text-slate-500 mt-1">
                {selectedCustomers.length} {selectedCustomers.length === 1 ? customerLabels.singular : customerLabels.plural} in {selectedCategory}
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={bulkDescription}
                  onChange={(e) => {
                    setBulkDescription(e.target.value);
                    setBulkError("");
                  }}
                  autoFocus
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="What is this invoice for?"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {isSchoolBusiness ? "Items" : "Invoice amount"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {isSchoolBusiness
                        ? `Every ${customerLabels.singular} in this category will receive the same item list.`
                        : `Every ${customerLabels.singular} in this category will receive the same fixed amount.`}
                    </p>
                  </div>
                  {isSchoolBusiness && (
                    <button
                      type="button"
                      onClick={addBulkItem}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium"
                    >
                      Add item
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {isSchoolBusiness ? (
                    bulkItems.map((item, index) => {
                    const quantity = Number(item.quantity || 0);
                    const unitPrice = Number(item.unitPrice || 0);
                    const lineTotal =
                      Number.isFinite(quantity) && Number.isFinite(unitPrice)
                        ? quantity * unitPrice
                        : 0;

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 md:grid-cols-[1.8fr_0.7fr_0.8fr_auto] gap-3 items-end border border-slate-200 rounded-2xl p-4"
                      >
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-2">
                            Item {index + 1}
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              updateBulkItem(item.id, "description", e.target.value)
                            }
                            className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                            placeholder="Description"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-2">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateBulkItem(item.id, "quantity", e.target.value)
                            }
                            className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-2">
                            Unit price
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateBulkItem(item.id, "unitPrice", e.target.value)
                            }
                            className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                            placeholder="0"
                          />
                        </div>

                        <div className="flex items-center gap-3 md:pb-3">
                          <div className="text-sm font-semibold text-slate-900 min-w-[90px] text-right">
                            N{lineTotal.toLocaleString()}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBulkItem(item.id)}
                            disabled={bulkItems.length === 1}
                            className="text-red-600 text-sm font-medium disabled:text-gray-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                    })
                  ) : (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <label className="block text-xs font-medium text-slate-500 mb-2">
                        Amount per {customerLabels.singular}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={bulkItems[0]?.unitPrice || ""}
                        onChange={(e) =>
                          updateBulkItem(bulkItems[0].id, "unitPrice", e.target.value)
                        }
                        className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Amount per {customerLabels.singular}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isSchoolBusiness
                      ? "Calculated from the shared line items"
                      : "Based on the fixed amount above"}
                  </p>
                </div>
                <p className="text-2xl font-semibold text-slate-900">
                  N{calculateInvoiceTotal(
                    getBusinessInvoiceItems(bulkItems, bulkDescription, isSchoolBusiness)
                  ).toLocaleString()}
                </p>
              </div>

              {bulkError && (
                <p className="text-red-600 text-sm">{bulkError}</p>
              )}

              <p className="text-xs text-slate-400">
                Every {customerLabels.singular} in this category will get a WhatsApp message with the same description and items, but their own invoice number and payment link.
              </p>

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
