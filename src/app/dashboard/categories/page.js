"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import AddCustomerModal from "../../../components/AddCustomerModal";
import { useConfirm, useToast } from "../../../components/AppFeedback";
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
  const toast = useToast();
  const confirm = useConfirm();
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const isSchoolBusiness = String(session.businessType || "").toLowerCase() === "school";
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
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
  const [importingStudents, setImportingStudents] = useState(false);
  const [renameModal, setRenameModal] = useState({ open: false, category: "", value: "" });
  const [renamingCategory, setRenamingCategory] = useState(false);

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

  const searchMatches = (values, query) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;

    return values
      .filter((value) => value !== undefined && value !== null)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  };

  const categoryList = Object.keys(grouped).sort();
  const visibleCategoryList = categoryList.filter((category) => {
    const categoryCustomers = grouped[category] || [];

    return (
      searchMatches([category], searchQuery) ||
      categoryCustomers.some((customer) =>
        searchMatches(
          [
            customer.name,
            customer.phone,
            customer.customerPhone,
            customer.parentPhone,
            customer.email,
            customer.token,
          ],
          searchQuery
        )
      )
    );
  });
  const selectedCustomers = selectedCategory ? grouped[selectedCategory] || [] : [];
  const visibleSelectedCustomers = selectedCustomers.filter((customer) =>
    searchMatches(
      [
        customer.name,
        customer.phone,
        customer.customerPhone,
        customer.parentPhone,
        customer.email,
        customer.token,
        customer.category,
      ],
      searchQuery
    )
  );
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
    const confirmed = await confirm({
      title: `Delete ${customerLabels.singularTitle}`,
      message: `Delete this ${customerLabels.singular}? This action cannot be undone.`, 
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    try {
      const res = await authFetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) fetchCustomers();
    } catch {
      toast("error", `Failed to delete ${customerLabels.singular}`);
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

    toast(
      "success",
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
    const confirmed = await confirm({
      title: "Delete category",
      message: `Delete the "${category}" category? ${customerLabels.pluralTitle} and invoices will be moved to Uncategorized.`,
      confirmLabel: "Delete",
    });

    if (!confirmed) return;

    try {
      const res = await authFetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete category");
      }

      setSelectedCategory(null);
      fetchCustomers();
    } catch (error) {
      console.error(error);
      toast("error", error.message || "Failed to delete category");
    }
  };

  const renameCategory = (category) => {
    setRenameModal({ open: true, category, value: category });
  };

  const closeRenameModal = () => {
    if (renamingCategory) return;
    setRenameModal({ open: false, category: "", value: "" });
  };

  const submitRenameCategory = async (event) => {
    event.preventDefault();
    const category = renameModal.category;
    const trimmedCategory = String(renameModal.value || "").trim();

    if (!trimmedCategory || trimmedCategory === category) {
      closeRenameModal();
      return;
    }

    setRenamingCategory(true);

    try {
      const res = await authFetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCategory: category,
          newCategory: trimmedCategory,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to rename category");
      }

      if (selectedCategory === category) {
        setSelectedCategory(trimmedCategory);
      }

      closeRenameModal();
      toast("success", "Category renamed.");
      fetchCustomers();
    } catch (error) {
      console.error(error);
      toast("error", error.message || "Failed to rename category");
    } finally {
      setRenamingCategory(false);
    }
  };

  const normalizeImportKey = (key) =>
    String(key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const getImportValue = (row, keys) => {
    const normalizedRow = Object.entries(row || {}).reduce((acc, [key, value]) => {
      acc[normalizeImportKey(key)] = value;
      return acc;
    }, {});

    for (const key of keys) {
      const value = normalizedRow[normalizeImportKey(key)];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return "";
  };

  const parseImportRows = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

    return rows.map((row) => ({
      name: getImportValue(row, [
        "student name",
        "student",
        "name",
        "customer name",
        "first name",
        "firstname",
        "full name",
        "fullname",
      ]),
      phone: getImportValue(row, ["phone number", "phone", "mobile", "telephone"]),
      email: getImportValue(row, ["email", "email address"]),
      guardianName: getImportValue(row, [
        "guardian name",
        "guardian",
        "parent name",
        "parent",
        "father name",
        "mother name",
      ]),
      location: getImportValue(row, ["location", "address"]),
    }));
  };

  const importStudentsFromFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !selectedCategory) return;

    setImportingStudents(true);

    try {
      const students = await parseImportRows(file);

      if (students.length === 0) {
        toast("warning", "No rows found in the selected file.");
        return;
      }

      const businessName =
        typeof window !== "undefined"
          ? localStorage.getItem("businessName") || ""
          : "";

      const res = await authFetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          businessName,
          students,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to import students");
      }

      await fetchCustomers();
      toast(
        "success",
        `Imported ${data.insertedCount || 0} ${customerLabels.plural}.` +
          (data.skippedCount ? ` ${data.skippedCount} row(s) skipped.` : "")
      );
    } catch (error) {
      console.error(error);
      toast("error", error.message || "Unable to import students");
    } finally {
      setImportingStudents(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const totalCategories = categoryList.length;
  const uncategorizedCount = grouped.Uncategorized?.length || 0;
  const currentViewCount = selectedCategory
    ? visibleSelectedCustomers.length
    : customers.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-4 sm:py-5">
      <div className="w-full px-3 sm:px-4 lg:px-5">
        <div className="mb-4 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_20px_50px_-36px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/70 px-5 py-4 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 sm:px-6 lg:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Category workspace
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50 sm:text-3xl">
                  {customerLabels.singularTitle} categories
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Organize {customerLabels.plural} into billing groups, import records faster,
                  and generate individual or category-wide invoices from one clean view.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row xl:flex-col xl:items-end">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  Add new {customerLabels.singular}
                </button>
                <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-2.5 text-left shadow-sm dark:border-slate-800 dark:bg-slate-950/60 xl:min-w-[11rem]">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Total {customerLabels.plural}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                    {customers.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 px-5 py-3.5 sm:grid-cols-2 xl:grid-cols-4 sm:px-6 lg:px-7">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Categories
              </p>
              <p className="mt-1.5 text-2xl font-semibold text-slate-950 dark:text-white">
                {totalCategories}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Visible now
              </p>
              <p className="mt-1.5 text-2xl font-semibold text-slate-950 dark:text-white">
                {currentViewCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Uncategorized
              </p>
              <p className="mt-1.5 text-2xl font-semibold text-slate-950 dark:text-white">
                {uncategorizedCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Current view
              </p>
              <p className="mt-1.5 truncate text-base font-semibold text-slate-950 dark:text-white">
                {selectedCategory || "All categories"}
              </p>
            </div>
          </div>
        </div>

        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            ← Back to All Categories
          </button>
        )}

        <div className="mb-4 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
            <div className="min-w-0 flex-1">
              <label htmlFor="student-category-search" className="sr-only">
                Search {selectedCategory ? customerLabels.plural : "categories"}
              </label>
              <input
                id="student-category-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  selectedCategory
                    ? `Search ${customerLabels.plural}, phone, email, or token`
                    : `Search categories or ${customerLabels.plural}`
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {visibleCategoryList.length} categories
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {selectedCategory
                  ? `${visibleSelectedCustomers.length} visible ${customerLabels.plural}`
                  : `${customers.length} total ${customerLabels.plural}`}
              </span>
            </div>
          </div>
        </div>

        {!selectedCategory ? (
          <div>
            <h2 className="mb-4 text-lg font-medium text-gray-700 dark:text-slate-300">
              All categories ({visibleCategoryList.length})
            </h2>

            {visibleCategoryList.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {customerLabels.singularTitle.slice(0, 1)}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">
                  {categoryList.length === 0
                    ? `No ${customerLabels.plural} added yet`
                    : "No matching categories found"}
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {categoryList.length === 0
                    ? `Add your first ${customerLabels.singular} and InvoiceHub will automatically group them into categories.`
                    : "Try another search term or clear the current filter to show more category groups."}
                </p>
                {categoryList.length === 0 ? (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    Add first {customerLabels.singular}
                  </button>
                ) : null}
              </div>
            ) : (
               <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleCategoryList.map((category) => {
                  const count = grouped[category]?.length || 0;

                  return (
                    <div
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="group cursor-pointer overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-0 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                    >
                      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 sm:px-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white dark:bg-slate-800">
                          {category.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Category
                          </p>
                          <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {category}
                          </h3>
                        </div>
                      </div>

                      <div className="px-5 pb-4 sm:px-6">
                        <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{customerLabels.pluralTitle}</p>
                          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
                            {count}
                          </p>
                        </div>
                        <div className="hidden text-right text-slate-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                          View {customerLabels.pluralTitle} →
                        </div>
                      </div>

                        <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                          <span>Shared billing view</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Open
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800 sm:px-6">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            renameCategory(category);
                          }}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteCategory(category);
                          }}
                          className="flex-1 rounded-xl border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-6 text-white sm:px-8 lg:px-10">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold">
                    {selectedCategory.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                        Selected category
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{selectedCategory}</h2>
                    <p className="text-slate-300 mt-1 text-lg">
                      {visibleSelectedCustomers.length} {visibleSelectedCustomers.length === 1 ? customerLabels.singularTitle : customerLabels.pluralTitle}
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
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
                  >
                    Generate Invoice for All
                  </button>
                  <button
                    onClick={() => renameCategory(selectedCategory)}
                    className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
                  >
                    Rename Category
                  </button>
                  <button
                    onClick={() => deleteCategory(selectedCategory)}
                    className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500/80"
                  >
                    Delete Category
                  </button>
                  <label className="cursor-pointer rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20">
                    {importingStudents ? "Importing..." : "Import"}
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={importStudentsFromFile}
                      disabled={importingStudents}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {visibleSelectedCustomers.length === 0 ? (
              <div className="p-10 text-center text-gray-500 dark:text-slate-400">
                No matching {customerLabels.plural} found.
              </div>
            ) : (
              <>
            <div className="divide-y divide-gray-100 dark:divide-slate-800 lg:hidden">
              {visibleSelectedCustomers.map((customer) => (
                <div key={customer._id} className="space-y-3 p-4">
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
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="w-[24%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      {customerLabels.singularTitle} Name
                    </th>
                    <th className="w-[18%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Phone Number
                    </th>
                    <th className="w-[24%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Email
                    </th>
                    <th className="w-[16%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Token
                    </th>
                    <th className="w-[18%] px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {visibleSelectedCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50 dark:hover:bg-slate-950/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">
                        {customer.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {customer.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {customer.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 dark:text-slate-300 px-3 py-1 rounded-full">
                          {customer.token ? `${customer.token.substring(0, 15)}...` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => openInvoiceModal(customer)}
                            className="whitespace-nowrap rounded-xl border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                          >
                            Invoice
                          </button>
                          <button
                            onClick={() => deleteCustomer(customer._id)}
                            className="whitespace-nowrap rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </>
            )}
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
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
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
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
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
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmGenerateInvoice}
                  disabled={generating}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-emerald-300"
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden dark:bg-slate-900">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Generate Invoice for All
              </h2>
              <p className="text-slate-500 mt-1 dark:text-slate-400">
                {selectedCustomers.length} {selectedCustomers.length === 1 ? customerLabels.singular : customerLabels.plural} in {selectedCategory}
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="What is this invoice for?"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {isSchoolBusiness ? "Items" : "Invoice amount"}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {isSchoolBusiness
                        ? `Every ${customerLabels.singular} in this category will receive the same item list.`
                        : `Every ${customerLabels.singular} in this category will receive the same fixed amount.`}
                    </p>
                  </div>
                  {isSchoolBusiness && (
                    <button
                      type="button"
                      onClick={addBulkItem}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
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
                        className="grid grid-cols-1 md:grid-cols-[1.8fr_0.7fr_0.8fr_auto] gap-3 items-end border border-slate-200 rounded-2xl p-4 dark:border-slate-800"
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
                            className="w-full px-4 py-3 border border-slate-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                            className="w-full px-4 py-3 border border-slate-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                            className="w-full px-4 py-3 border border-slate-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            placeholder="0"
                          />
                        </div>

                        <div className="flex items-center gap-3 md:pb-3">
                          <div className="text-sm font-semibold text-slate-900 min-w-[90px] text-right dark:text-white">
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
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
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
                        className="w-full px-4 py-3 border border-slate-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between dark:border-slate-800 dark:bg-slate-950/60">
                <div>
                  <p className="text-sm text-slate-500">Amount per {customerLabels.singular}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isSchoolBusiness
                      ? "Calculated from the shared line items"
                      : "Based on the fixed amount above"}
                  </p>
                </div>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">
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
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBulkGenerate}
                  disabled={bulkGenerating}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-emerald-300"
                >
                  {bulkGenerating ? "Generating..." : "Generate All"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {renameModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitRenameCategory}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Rename category</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Update the category name for existing records.
            </p>
            <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Category name
            </label>
            <input
              type="text"
              value={renameModal.value}
              onChange={(event) =>
                setRenameModal((current) => ({ ...current, value: event.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-slate-800"
              autoFocus
            />
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRenameModal}
                disabled={renamingCategory}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renamingCategory}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                {renamingCategory ? "Renaming..." : "Rename"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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






