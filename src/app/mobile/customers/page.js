"use client";

import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiUser } from "react-icons/fi";
import { authFetch } from "../../../lib/authFetch";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

export default function MobileCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch("/api/mobile/customers");
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          throw new Error(data.error || "Unable to load customers");
        }

        setCustomers(Array.isArray(data) ? data : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load customers");
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    return customers.filter((customer) =>
      `${customer.name || customer.customerName || customer.student || ""} ${customer.phone || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [customers, search]);

  return (
    <div className="space-y-4">
      <label className="relative block">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer"
          className="min-h-11 w-full rounded-lg border border-slate-800 bg-slate-900 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
        />
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-2">
        {filtered.map((customer) => (
          <div key={customer._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-slate-300">
                <FiUser className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {customer.name || customer.customerName || customer.student || "Customer"}
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">{customer.phone || "-"}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Info label="Category" value={customer.category || "-"} />
              <Info label="Outstanding" value={formatCurrency(customer.outstandingBalance || 0)} />
              <Info label="Email" value={customer.email || "-"} />
              <Info label="Status" value={customer.status || "Active"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white">{value}</p>
    </div>
  );
}
