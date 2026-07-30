"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FiArrowLeft,
  FiArrowRight,
  FiEdit2,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUsers,
  FiFileText,
  FiMail,
  FiPhone,
  FiHash,
  FiMoreHorizontal,
} from "react-icons/fi";
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

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name) {
  const colors = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getCategoryIconColor(category) {
  const colors = [
    "from-blue-500 to-blue-600",
    "from-emerald-500 to-emerald-600",
    "from-amber-500 to-amber-600",
    "from-rose-500 to-rose-600",
    "from-violet-500 to-violet-600",
    "from-cyan-500 to-cyan-600",
    "from-orange-500 to-orange-600",
    "from-indigo-500 to-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < (category || "").length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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
      toast("success", "Invoice generated and sent.");
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
      `Created ${savedCount} invoice${savedCount !== 1 ? "s" : ""}. ` +
        `${notificationCount} sent` +
        (whatsappOpenedCount > 0 ? `, ${whatsappOpenedCount} WhatsApp tabs opened` : "") +
        (skippedNoPhone > 0 ? `, ${skippedNoPhone} skipped (no phone)` : "")
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
      toast("success", "Category deleted.");
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-900 dark:text-white">Dashboard</span>
              <FiArrowRight className="h-3 w-3" />
              <span>
                {selectedCategory ? customerLabels.pluralTitle : "Categories"}
              </span>
              {selectedCategory && (
                <>
                  <FiArrowRight className="h-3 w-3" />
                  <span className="text-slate-900 dark:text-white">{selectedCategory}</span>
                </>
              )}
            </nav>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {selectedCategory ? selectedCategory : `${customerLabels.singularTitle} categories`}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {selectedCategory
                ? `${visibleSelectedCustomers.length} of ${selectedCustomers.length} ${customerLabels.plural} visible`
                : `Manage billing groups and create invoices for ${customerLabels.plural}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <FiArrowLeft className="h-4 w-4" />
                All categories
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <FiPlus className="h-4 w-4" />
              Add {customerLabels.singular}
            </button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  selectedCategory
                    ? `Search ${customerLabels.plural}...`
                    : "Search categories..."
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
              />
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <FiUsers className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {selectedCategory ? "In category" : "Categories"}
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selectedCategory ? selectedCustomers.length : visibleCategoryList.length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <FiUsers className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total {customerLabels.plural}
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">{customers.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        {!selectedCategory ? (
          <>
            {visibleCategoryList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <FiUsers className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">
                  {categoryList.length === 0
                    ? `No ${customerLabels.plural} added yet`
                    : "No matching categories"}
                </h3>
                <p className="mt-2 max-w-sm text-center text-sm text-slate-500 dark:text-slate-400">
                  {categoryList.length === 0
                    ? `Add your first ${customerLabels.singular} to create a billing category and start invoicing.`
                    : "Try a different search term."}
                </p>
                {categoryList.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    <FiPlus className="h-4 w-4" />
                    Add {customerLabels.singular}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCategoryList.map((category) => {
                  const count = grouped[category]?.length || 0;
                  const iconColor = getCategoryIconColor(category);

                  return (
                    <div
                      key={category}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className={`h-1.5 w-full bg-gradient-to-r ${iconColor}`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${iconColor} text-sm font-bold text-white shadow-sm`}
                            >
                              {category.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                {category}
                              </h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {count} {count === 1 ? customerLabels.singular : customerLabels.plural}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => renameCategory(category)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                              title="Rename"
                            >
                              <FiEdit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteCategory(category)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              title="Delete"
                            >
                              <FiTrash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center gap-3">
                          <button
                            onClick={() => setSelectedCategory(category)}
                            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                          >
                            View group
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Selected Category Detail */
          <div className="space-y-6">
            {/* Category Header Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${getCategoryIconColor(
                      selectedCategory
                    )} text-lg font-bold text-white shadow-sm`}
                  >
                    {selectedCategory.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedCategory}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {visibleSelectedCustomers.length} of {selectedCustomers.length} visible
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setBulkDescription(
                        selectedCategory ? `${selectedCategory} invoice` : "Category invoice"
                      );
                      setBulkItems([createEmptyInvoiceItem()]);
                      setBulkError("");
                      setShowBulkModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    <FiFileText className="h-4 w-4" />
                    Generate invoices
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                    <FiUpload className="h-4 w-4" />
                    {importingStudents ? "Importing..." : "Import"}
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={importStudentsFromFile}
                      disabled={importingStudents}
                      className="hidden"
                    />
                  </label>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                  <button
                    onClick={() => renameCategory(selectedCategory)}
                    className="rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    title="Rename category"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteCategory(selectedCategory)}
                    className="rounded-lg p-2.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    title="Delete category"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {visibleSelectedCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <FiSearch className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">
                    No matching {customerLabels.plural}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Try adjusting your search.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
                    {visibleSelectedCustomers.map((customer) => (
                      <div key={customer._id} className="p-5">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(
                              customer.name
                            )}`}
                          >
                            {getInitials(customer.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {customer.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              {customer.phone && (
                                <span className="flex items-center gap-1">
                                  <FiPhone className="h-3 w-3" />
                                  {customer.phone}
                                </span>
                              )}
                              {customer.email && (
                                <span className="flex items-center gap-1">
                                  <FiMail className="h-3 w-3" />
                                  {customer.email}
                                </span>
                              )}
                            </div>
                            {customer.token && (
                              <p className="mt-1.5 font-mono text-[10px] text-slate-400">
                                <FiHash className="mr-1 inline h-3 w-3" />
                                {customer.token.slice(0, 20)}...
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => openInvoiceModal(customer)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 transition hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-500/20"
                              >
                                <FiFileText className="h-3 w-3" />
                                Invoice
                              </button>
                              <Link
                                href={`/dashboard/payments?student=${encodeURIComponent(
                                  customer.name
                                )}&category=${encodeURIComponent(selectedCategory)}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20 transition hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-500/20"
                              >
                                History
                              </Link>
                              <button
                                onClick={() => deleteCustomer(customer._id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20 transition hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-500/20"
                              >
                                <FiTrash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden lg:block">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                          <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {customerLabels.singularTitle}
                          </th>
                          <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Contact
                          </th>
                          <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Token
                          </th>
                          <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {visibleSelectedCustomers.map((customer) => (
                          <tr
                            key={customer._id}
                            className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-950/40"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(
                                    customer.name
                                  )}`}
                                >
                                  {getInitials(customer.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {customer.name}
                                  </p>
                                  {customer.guardianName && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      Guardian: {customer.guardianName}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                {customer.phone && (
                                  <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                                    <FiPhone className="h-3.5 w-3.5 text-slate-400" />
                                    {customer.phone}
                                  </div>
                                )}
                                {customer.email && (
                                  <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                                    <FiMail className="h-3.5 w-3.5 text-slate-400" />
                                    {customer.email}
                                  </div>
                                )}
                                {!customer.phone && !customer.email && (
                                  <span className="text-sm text-slate-400 dark:text-slate-500">
                                    No contact info
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {customer.token ? (
                                <span className="inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                                  {customer.token.slice(0, 18)}...
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openInvoiceModal(customer)}
                                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 transition hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-500/20"
                                >
                                  Invoice
                                </button>
                                <Link
                                  href={`/dashboard/payments?student=${encodeURIComponent(
                                    customer.name
                                  )}&category=${encodeURIComponent(selectedCategory)}`}
                                  className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20 transition hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-500/20"
                                >
                                  History
                                </Link>
                                <button
                                  onClick={() => deleteCustomer(customer._id)}
                                  className="rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                >
                                  <FiTrash2 className="h-4 w-4" />
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
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {invoiceCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="border-b border-slate-100 px-8 py-6 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(
                    invoiceCustomer.name
                  )}`}
                >
                  {getInitials(invoiceCustomer.name)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Generate Invoice
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {invoiceCustomer.name} · {invoiceCustomer.category}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Description
                  </label>
                  <textarea
                    value={invoiceDescription}
                    onChange={(e) => {
                      setInvoiceDescription(e.target.value);
                      setInvoiceError("");
                    }}
                    autoFocus
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    placeholder="What is this invoice for?"
                  />
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {isSchoolBusiness ? "Line items" : "Invoice amount"}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isSchoolBusiness
                          ? "Add each charge as a separate line item"
                          : "Enter the fixed amount for this invoice"}
                      </p>
                    </div>
                    {isSchoolBusiness && (
                      <button
                        type="button"
                        onClick={addInvoiceItem}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                      >
                        <FiPlus className="h-3.5 w-3.5" />
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
                            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                          >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_120px_auto] sm:items-end">
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Item {index + 1}
                                </label>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) =>
                                    updateInvoiceItem(item.id, "description", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                  placeholder="Description"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Qty
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateInvoiceItem(item.id, "quantity", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Unit price
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updateInvoiceItem(item.id, "unitPrice", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex items-center gap-3 sm:pb-0.5">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  N{lineTotal.toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeInvoiceItem(item.id)}
                                  disabled={invoiceItems.length === 1}
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                >
                                  <FiTrash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                        <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                          Amount
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={invoiceItems[0]?.unitPrice || ""}
                          onChange={(e) =>
                            updateInvoiceItem(invoiceItems[0].id, "unitPrice", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Invoice total
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isSchoolBusiness ? "Sum of all line items" : "Fixed amount"}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    N{invoiceTotal.toLocaleString()}
                  </p>
                </div>

                {invoiceError && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {invoiceError}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-8 py-5 dark:border-slate-800">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmGenerateInvoice}
                  disabled={generating}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {generating ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="border-b border-slate-100 px-8 py-6 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Generate Invoices for All
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedCustomers.length} {selectedCustomers.length === 1 ? customerLabels.singular : customerLabels.plural} in {selectedCategory}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Description
                  </label>
                  <textarea
                    value={bulkDescription}
                    onChange={(e) => {
                      setBulkDescription(e.target.value);
                      setBulkError("");
                    }}
                    autoFocus
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    placeholder="What is this invoice for?"
                  />
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {isSchoolBusiness ? "Line items" : "Invoice amount"}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isSchoolBusiness
                          ? "Shared across all recipients"
                          : "Fixed amount per customer"}
                      </p>
                    </div>
                    {isSchoolBusiness && (
                      <button
                        type="button"
                        onClick={addBulkItem}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                      >
                        <FiPlus className="h-3.5 w-3.5" />
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
                            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                          >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_120px_auto] sm:items-end">
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Item {index + 1}
                                </label>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) =>
                                    updateBulkItem(item.id, "description", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                  placeholder="Description"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Qty
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateBulkItem(item.id, "quantity", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Unit price
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updateBulkItem(item.id, "unitPrice", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex items-center gap-3 sm:pb-0.5">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  N{lineTotal.toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeBulkItem(item.id)}
                                  disabled={bulkItems.length === 1}
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                >
                                  <FiTrash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
                        <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                          Amount per {customerLabels.singular}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={bulkItems[0]?.unitPrice || ""}
                          onChange={(e) =>
                            updateBulkItem(bulkItems[0].id, "unitPrice", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Amount per {customerLabels.singular}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isSchoolBusiness ? "Sum of shared line items" : "Fixed amount"}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    N{calculateInvoiceTotal(
                      getBusinessInvoiceItems(bulkItems, bulkDescription, isSchoolBusiness)
                    ).toLocaleString()}
                  </p>
                </div>

                {bulkError && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    {bulkError}
                  </div>
                )}

                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Each {customerLabels.singular} will receive their own invoice number and payment link. WhatsApp messages will be sent automatically where possible.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-8 py-5 dark:border-slate-800">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBulkGenerate}
                  disabled={bulkGenerating}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {bulkGenerating ? "Generating..." : `Generate ${selectedCustomers.length} Invoices`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitRenameCategory}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Rename category</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Update the name for all records in this category.
            </p>
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Category name
              </label>
              <input
                type="text"
                value={renameModal.value}
                onChange={(event) =>
                  setRenameModal((current) => ({ ...current, value: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                autoFocus
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeRenameModal}
                disabled={renamingCategory}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renamingCategory}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {renamingCategory ? "Renaming..." : "Rename"}
              </button>
            </div>
          </form>
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