"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatCard,
  StatGrid,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";
import { labelPermission, PERMISSION_GROUPS } from "../../../lib/staffPermissions";

const tabs = [
  { key: "accounts", label: "Staff Accounts" },
  { key: "roles", label: "Roles & Permissions" },
  { key: "activity", label: "Activity Logs" },
];

function permissionEntries() {
  return Object.entries(PERMISSION_GROUPS).flatMap(([group, permissions]) =>
    permissions.map((permission) => ({
      group,
      permission,
      label: labelPermission(permission),
    }))
  );
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function summarizeAssignments(account, businesses) {
  if (account.assignedAllBusinesses) {
    return "All businesses";
  }

  if (!account.assignedBusinessIds?.length) {
    return "No business assigned";
  }

  return account.assignedBusinessIds
    .map((businessId) => businesses.find((business) => business._id === businessId)?.name)
    .filter(Boolean)
    .join(", ");
}

function buildEditableAccount(account) {
  return {
    _id: account._id,
    fullName: account.fullName || "",
    phoneNumber: account.phoneNumber || "",
    email: account.email || "",
    username: account.username || "",
    roleId: account.roleId || "",
    assignedBusinessIds: Array.isArray(account.assignedBusinessIds)
      ? account.assignedBusinessIds
      : [],
    assignedAllBusinesses: Boolean(account.assignedAllBusinesses),
    status: account.status || "active",
    lastLoginAt: account.lastLoginAt || "",
  };
}

export default function StaffManagementPage() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [staffForm, setStaffForm] = useState(emptyStaffForm());
  const [roleForm, setRoleForm] = useState(emptyRoleForm());
  const [businessForm, setBusinessForm] = useState({ name: "", type: "" });
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [accountDrafts, setAccountDrafts] = useState({});
  const [filters, setFilters] = useState({
    businessId: "all",
    roleId: "all",
    query: "",
    status: "all",
  });
  const permissionOptions = useMemo(() => permissionEntries(), []);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [accountsRes, rolesRes, logsRes, businessesRes] = await Promise.all([
        authFetch("/api/staff/accounts"),
        authFetch("/api/staff/roles"),
        authFetch("/api/staff/activity?limit=80"),
        authFetch("/api/businesses"),
      ]);

      const accountsData = await accountsRes.json().catch(() => ({}));
      const rolesData = await rolesRes.json().catch(() => []);
      const logsData = await logsRes.json().catch(() => []);
      const businessesData = await businessesRes.json().catch(() => []);

      if (!accountsRes.ok) {
        throw new Error(accountsData.error || "Unable to load staff accounts");
      }

      if (!rolesRes.ok) {
        throw new Error(rolesData.error || "Unable to load roles");
      }

      if (!logsRes.ok) {
        throw new Error(logsData.error || "Unable to load activity logs");
      }

      if (!businessesRes.ok) {
        throw new Error(businessesData.error || "Unable to load businesses");
      }

      const nextAccounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
      setAccounts(nextAccounts);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setBusinesses(Array.isArray(businessesData) ? businessesData : []);
      setAccountDrafts(
        Object.fromEntries(nextAccounts.map((account) => [account._id, buildEditableAccount(account)]))
      );

      setSelectedAccountId((current) => {
        if (current && nextAccounts.some((account) => account._id === current)) {
          return current;
        }
        return nextAccounts[0]?._id || "";
      });
    } catch (loadError) {
      setError(loadError.message || "Unable to load staff workspace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      loadAll();
    }, 0);

    return () => clearTimeout(loadTimer);
  }, []);

  async function createStaff() {
    setSaving("staff");
    setMessage("");
    setError("");

    try {
      const res = await authFetch("/api/staff/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffForm),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to create staff account");
      }

      setMessage("Staff account created.");
      setStaffForm(emptyStaffForm());
      setShowCreateStaff(false);
      await loadAll();
    } catch (createError) {
      setError(createError.message || "Unable to create staff account");
    } finally {
      setSaving("");
    }
  }

  async function updateStaff(id, payload, options = {}) {
    setSaving(id);
    setMessage("");
    setError("");

    try {
      const res = await authFetch(`/api/staff/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to update staff account");
      }

      setMessage("Staff account updated.");
      await loadAll();
      if (options.closeOnSuccess) {
        setShowEditPanel(false);
      }
    } catch (updateError) {
      setError(updateError.message || "Unable to update staff account");
    } finally {
      setSaving("");
    }
  }

  async function deleteStaff(id) {
    setSaving(id);
    setMessage("");
    setError("");

    try {
      const res = await authFetch(`/api/staff/accounts/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to delete staff account");
      }

      setMessage("Staff account deleted.");
      await loadAll();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete staff account");
    } finally {
      setSaving("");
    }
  }

  async function createRole() {
    setSaving("role");
    setMessage("");
    setError("");

    try {
      const res = await authFetch("/api/staff/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleForm),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to create role");
      }

      setMessage("Role created.");
      setRoleForm(emptyRoleForm());
      await loadAll();
    } catch (roleError) {
      setError(roleError.message || "Unable to create role");
    } finally {
      setSaving("");
    }
  }

  async function createBusiness() {
    setSaving("business");
    setMessage("");
    setError("");

    try {
      const res = await authFetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(businessForm),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to create business");
      }

      setBusinessForm({ name: "", type: "" });
      setShowCreateBusiness(false);
      setMessage("Business created.");
      await loadAll();
    } catch (businessError) {
      setError(businessError.message || "Unable to create business");
    } finally {
      setSaving("");
    }
  }

  const stats = {
    active: accounts.filter((account) => account.status === "active").length,
    suspended: accounts.filter((account) => account.status !== "active").length,
    roles: roles.length,
    onlineToday: logs.filter((entry) => entry.action === "Login").length,
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesBusiness =
        filters.businessId === "all" ||
        account.assignedAllBusinesses ||
        account.assignedBusinessIds?.includes(filters.businessId);
      const matchesRole = filters.roleId === "all" || account.roleId === filters.roleId;
      const matchesStatus = filters.status === "all" || account.status === filters.status;
      const haystack = [
        account.fullName,
        account.username,
        account.email,
        account.phoneNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = haystack.includes(filters.query.trim().toLowerCase());
      return matchesBusiness && matchesRole && matchesStatus && matchesQuery;
    });
  }, [accounts, filters]);

  const selectedAccount = filteredAccounts.find((account) => account._id === selectedAccountId);
  const selectedDraft = selectedAccountId ? accountDrafts[selectedAccountId] : null;

  return (
    <PageShell>
      <PageHeader
        title="Users & Staff"
        description="Manage staff accounts, branches, permissions, and audit visibility from one operations workspace."
        actions={
          activeTab === "accounts" ? (
            <>
              <button
                onClick={() => setShowCreateBusiness((current) => !current)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {showCreateBusiness ? "Close business form" : "Add business"}
              </button>
              <button
                onClick={() => setShowCreateStaff((current) => !current)}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {showCreateStaff ? "Close staff form" : "Create staff"}
              </button>
            </>
          ) : null
        }
      />

      <StatGrid>
        <StatCard label="Active staff" value={stats.active} tone="emerald" />
        <StatCard label="Suspended staff" value={stats.suspended} tone="orange" />
        <StatCard label="Roles" value={stats.roles} tone="blue" />
        <StatCard label="Recent logins" value={stats.onlineToday} tone="violet" />
      </StatGrid>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "bg-slate-900 text-white dark:bg-blue-600"
                : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {activeTab === "accounts" ? (
        <div className="space-y-6">
          {(showCreateBusiness || showCreateStaff) && (
            <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
              {showCreateBusiness ? (
                <SurfaceCard className="p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Add Business
                  </h2>
                  <div className="mt-4 space-y-4">
                    <LabeledInput
                      label="Business Name"
                      value={businessForm.name}
                      onChange={(event) =>
                        setBusinessForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="ABC Pharmacy"
                    />
                    <LabeledInput
                      label="Business Type"
                      value={businessForm.type}
                      onChange={(event) =>
                        setBusinessForm((current) => ({ ...current, type: event.target.value }))
                      }
                      placeholder="Pharmacy"
                    />
                    <button
                      onClick={createBusiness}
                      disabled={saving === "business"}
                      className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white dark:bg-blue-600"
                    >
                      {saving === "business" ? "Creating..." : "Create Business"}
                    </button>
                  </div>
                </SurfaceCard>
              ) : null}

              {showCreateStaff ? (
                <SurfaceCard className="p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Create Staff
                  </h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <LabeledInput
                      label="Full Name"
                      value={staffForm.fullName}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, fullName: event.target.value }))
                      }
                      placeholder="John Doe"
                    />
                    <LabeledInput
                      label="Phone Number"
                      value={staffForm.phoneNumber}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, phoneNumber: event.target.value }))
                      }
                      placeholder="080..."
                    />
                    <LabeledInput
                      label="Email"
                      value={staffForm.email}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="john@business.com"
                    />
                    <LabeledInput
                      label="Username"
                      value={staffForm.username}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, username: event.target.value }))
                      }
                      placeholder="john.cashier"
                    />
                    <LabeledInput
                      label="Password"
                      type="password"
                      value={staffForm.password}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Temporary password"
                    />
                    <LabeledSelect
                      label="Role"
                      value={staffForm.roleId}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, roleId: event.target.value }))
                      }
                    >
                      <option value="">Select role</option>
                      {roles.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.name}
                        </option>
                      ))}
                    </LabeledSelect>
                    <LabeledSelect
                      label="Status"
                      value={staffForm.status}
                      onChange={(event) =>
                        setStaffForm((current) => ({ ...current, status: event.target.value }))
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </LabeledSelect>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Assigned Businesses
                      </p>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={staffForm.assignedAllBusinesses}
                          onChange={(event) =>
                            setStaffForm((current) => ({
                              ...current,
                              assignedAllBusinesses: event.target.checked,
                            }))
                          }
                        />
                        All businesses
                      </label>
                    </div>

                    {!staffForm.assignedAllBusinesses ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {businesses.map((business) => (
                          <label
                            key={business._id}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={staffForm.assignedBusinessIds.includes(business._id)}
                              onChange={() =>
                                setStaffForm((current) => ({
                                  ...current,
                                  assignedBusinessIds: current.assignedBusinessIds.includes(
                                    business._id
                                  )
                                    ? current.assignedBusinessIds.filter(
                                        (id) => id !== business._id
                                      )
                                    : [...current.assignedBusinessIds, business._id],
                                }))
                              }
                            />
                            {business.name}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={createStaff}
                    disabled={saving === "staff"}
                    className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving === "staff" ? "Creating..." : "Create Staff"}
                  </button>
                </SurfaceCard>
              ) : null}
            </div>
          )}

          <SurfaceCard className="overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_220px]">
                <LabeledSelect
                  label="Business"
                  value={filters.businessId}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, businessId: event.target.value }))
                  }
                >
                  <option value="all">All businesses</option>
                  {businesses.map((business) => (
                    <option key={business._id} value={business._id}>
                      {business.name}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label="Role"
                  value={filters.roleId}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, roleId: event.target.value }))
                  }
                >
                  <option value="all">All roles</option>
                  {roles.map((role) => (
                    <option key={role._id} value={role._id}>
                      {role.name}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledInput
                  label="Search staff"
                  value={filters.query}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="Username, name, email, phone"
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <LabeledSelect
                    label="Status"
                    value={filters.status}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </LabeledSelect>
                  <div className="flex items-end">
                    <button
                      onClick={() =>
                        setFilters({
                          businessId: "all",
                          roleId: "all",
                          query: "",
                          status: "all",
                        })
                      }
                      className="h-11 w-full rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading staff accounts...
              </div>
            ) : filteredAccounts.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-left dark:border-slate-800 dark:bg-slate-950/30">
                    <tr className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-4 font-semibold">User</th>
                      <th className="px-4 py-4 font-semibold">Username</th>
                      <th className="px-4 py-4 font-semibold">Role</th>
                      <th className="px-4 py-4 font-semibold">Phone</th>
                      <th className="px-4 py-4 font-semibold">Email</th>
                      <th className="px-4 py-4 font-semibold">Business</th>
                      <th className="px-4 py-4 font-semibold">Last Login</th>
                      <th className="px-4 py-4 font-semibold">Status</th>
                      <th className="px-4 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => {
                      const isSelected = selectedAccountId === account._id;
                      const role = roles.find((item) => item._id === account.roleId);
                      return (
                        <tr
                          key={account._id}
                          className={`border-b border-slate-100 transition dark:border-slate-800 ${
                            isSelected ? "bg-sky-50/70 dark:bg-sky-950/20" : "bg-white dark:bg-slate-900"
                          }`}
                        >
                          <td className="px-5 py-4">
                            <button
                              onClick={() => setSelectedAccountId(account._id)}
                              className="flex items-center gap-3 text-left"
                            >
                              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                                {getInitials(account.fullName)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                                  {account.fullName}
                                </span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                  {account.assignedAllBusinesses ? "All businesses" : "Selected access"}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                            {account.username || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                            {role?.name || "No role"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                            {account.phoneNumber || "-"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                            <span className="block max-w-[220px] truncate">{account.email || "-"}</span>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                            <span className="block max-w-[220px] truncate">
                              {summarizeAssignments(account, businesses)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(account.lastLoginAt)}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() =>
                                updateStaff(account._id, {
                                  action: account.status === "active" ? "suspend" : "activate",
                                })
                              }
                              disabled={saving === account._id}
                              className={`inline-flex h-7 w-14 items-center rounded-full px-1 transition ${
                                account.status === "active"
                                  ? "bg-emerald-500"
                                  : "bg-slate-300 dark:bg-slate-700"
                              }`}
                              aria-label={`Set ${account.fullName} ${
                                account.status === "active" ? "inactive" : "active"
                              }`}
                            >
                              <span
                                className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
                                  account.status === "active" ? "translate-x-7" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedAccountId(account._id);
                                  setShowEditPanel(true);
                                }}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  const password = window.prompt(
                                    `New password for ${account.fullName}`
                                  );
                                  if (password) {
                                    updateStaff(account._id, {
                                      action: "resetPassword",
                                      password,
                                    });
                                  }
                                }}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-200"
                              >
                                Reset
                              </button>
                              <button
                                onClick={() => deleteStaff(account._id)}
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No staff matched your filter"
                description="Try a different business, role, or status selection."
              />
            )}
          </SurfaceCard>

          {showEditPanel && selectedAccount && selectedDraft ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto">
                <SurfaceCard className="p-6 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-base font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                    {getInitials(selectedAccount.fullName)}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Edit Staff Account
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {selectedAccount.fullName} • {selectedAccount.username}
                    </p>
                  </div>
                </div>
                <StatusBadge tone={selectedAccount.status === "active" ? "green" : "orange"}>
                  {selectedAccount.status}
                </StatusBadge>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <LabeledInput
                  label="Full Name"
                  value={selectedDraft.fullName}
                  onChange={(event) =>
                    setAccountDrafts((current) => ({
                      ...current,
                      [selectedAccountId]: {
                        ...current[selectedAccountId],
                        fullName: event.target.value,
                      },
                    }))
                  }
                />
                <LabeledInput
                  label="Phone Number"
                  value={selectedDraft.phoneNumber}
                  onChange={(event) =>
                    setAccountDrafts((current) => ({
                      ...current,
                      [selectedAccountId]: {
                        ...current[selectedAccountId],
                        phoneNumber: event.target.value,
                      },
                    }))
                  }
                />
                <LabeledInput
                  label="Email"
                  value={selectedDraft.email}
                  onChange={(event) =>
                    setAccountDrafts((current) => ({
                      ...current,
                      [selectedAccountId]: {
                        ...current[selectedAccountId],
                        email: event.target.value,
                      },
                    }))
                  }
                />
                <LabeledInput
                  label="Username"
                  value={selectedDraft.username}
                  onChange={(event) =>
                    setAccountDrafts((current) => ({
                      ...current,
                      [selectedAccountId]: {
                        ...current[selectedAccountId],
                        username: event.target.value,
                      },
                    }))
                  }
                />
                <LabeledSelect
                  label="Role"
                  value={selectedDraft.roleId}
                  onChange={(event) =>
                    setAccountDrafts((current) => ({
                      ...current,
                      [selectedAccountId]: {
                        ...current[selectedAccountId],
                        roleId: event.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role._id} value={role._id}>
                      {role.name}
                    </option>
                  ))}
                </LabeledSelect>
                <LabeledSelect
                  label="Status"
                  value={selectedDraft.status}
                  onChange={(event) =>
                    setAccountDrafts((current) => ({
                      ...current,
                      [selectedAccountId]: {
                        ...current[selectedAccountId],
                        status: event.target.value,
                      },
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </LabeledSelect>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Assigned Businesses
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Limit what this staff member can see after login.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedDraft.assignedAllBusinesses}
                      onChange={(event) =>
                        setAccountDrafts((current) => ({
                          ...current,
                          [selectedAccountId]: {
                            ...current[selectedAccountId],
                            assignedAllBusinesses: event.target.checked,
                          },
                        }))
                      }
                    />
                    All businesses
                  </label>
                </div>

                {!selectedDraft.assignedAllBusinesses ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {businesses.map((business) => (
                      <label
                        key={business._id}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDraft.assignedBusinessIds.includes(business._id)}
                          onChange={() =>
                            setAccountDrafts((current) => {
                              const activeIds =
                                current[selectedAccountId]?.assignedBusinessIds || [];
                              const nextIds = activeIds.includes(business._id)
                                ? activeIds.filter((id) => id !== business._id)
                                : [...activeIds, business._id];

                              return {
                                ...current,
                                [selectedAccountId]: {
                                  ...current[selectedAccountId],
                                  assignedBusinessIds: nextIds,
                                },
                              };
                            })
                          }
                        />
                        {business.name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    updateStaff(
                      selectedAccountId,
                      {
                        fullName: selectedDraft.fullName,
                        phoneNumber: selectedDraft.phoneNumber,
                        email: selectedDraft.email,
                        username: selectedDraft.username,
                        roleId: selectedDraft.roleId,
                        assignedBusinessIds: selectedDraft.assignedBusinessIds,
                        assignedAllBusinesses: selectedDraft.assignedAllBusinesses,
                        status: selectedDraft.status,
                      },
                      { closeOnSuccess: true }
                    )
                  }
                  disabled={saving === selectedAccountId}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white dark:bg-blue-600"
                >
                  {saving === selectedAccountId ? "Saving..." : "Save changes"}
                </button>
                <button
                  onClick={() =>
                    updateStaff(selectedAccountId, { action: "suspend" }, { closeOnSuccess: true })
                  }
                  disabled={saving === selectedAccountId}
                  className="rounded-xl border border-orange-200 px-5 py-3 text-sm font-medium text-orange-600"
                >
                  Suspend
                </button>
                <button
                  onClick={() => setShowEditPanel(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const password = window.prompt(
                      `New password for ${selectedAccount.fullName}`
                    );
                    if (password) {
                      updateStaff(selectedAccountId, {
                        action: "resetPassword",
                        password,
                      });
                    }
                  }}
                  disabled={saving === selectedAccountId}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-200"
                >
                  Reset password
                </button>
              </div>
                </SurfaceCard>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "roles" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
          <SurfaceCard className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Custom Role
            </h2>
            <div className="mt-4 space-y-4">
              <LabeledInput
                label="Role Name"
                value={roleForm.name}
                onChange={(event) =>
                  setRoleForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Branch Supervisor"
              />
              <LabeledInput
                label="Description"
                value={roleForm.description}
                onChange={(event) =>
                  setRoleForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="What this role should manage"
              />

              <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                {Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {group}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {permissions.map((permission) => (
                        <label
                          key={permission}
                          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={roleForm.permissions[permission] === true}
                            onChange={(event) =>
                              setRoleForm((current) => ({
                                ...current,
                                permissions: {
                                  ...current.permissions,
                                  [permission]: event.target.checked,
                                },
                              }))
                            }
                          />
                          {labelPermission(permission)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={createRole}
                disabled={saving === "role"}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-blue-600"
              >
                {saving === "role" ? "Creating..." : "Create Role"}
              </button>
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Available Roles
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {roles.map((role) => (
                <div key={role._id} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{role.name}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {role.description || "No description"}
                      </p>
                    </div>
                    <StatusBadge tone={role.system ? "blue" : "slate"}>
                      {role.system ? "Default role" : "Custom role"}
                    </StatusBadge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {permissionOptions
                      .filter((item) => role.permissions[item.permission])
                      .map((item) => (
                        <span
                          key={item.permission}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {item.label}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {activeTab === "activity" ? (
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Activity Logs
            </h2>
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading activity...</div>
          ) : logs.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log) => (
                <div
                  key={log._id}
                  className="grid gap-3 px-6 py-4 md:grid-cols-[140px_1fr_180px]"
                >
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(log.createdAt)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{log.action}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {log.description}
                    </p>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    <p>{log.actorName || "-"}</p>
                    <p>{log.businessName || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No activity logs yet"
              description="Staff logins, invoice actions, payments, and branch updates will appear here."
            />
          )}
        </SurfaceCard>
      ) : null}
    </PageShell>
  );
}

function emptyStaffForm() {
  return {
    fullName: "",
    phoneNumber: "",
    email: "",
    username: "",
    password: "",
    roleId: "",
    assignedBusinessIds: [],
    assignedAllBusinesses: false,
    status: "active",
  };
}

function emptyRoleForm() {
  return {
    name: "",
    description: "",
    permissions: {},
  };
}

function LabeledInput({ label, className = "", ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        {...props}
        className={`h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white ${className}`.trim()}
      />
    </label>
  );
}

function LabeledSelect({ label, className = "", children, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <select
        {...props}
        className={`h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white ${className}`.trim()}
      >
        {children}
      </select>
    </label>
  );
}
