"use client";

import { useEffect, useMemo, useState } from "react";
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
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search customer"
        className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
      />

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {filtered.map((customer) => (
          <div key={customer._id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <p className="font-semibold text-white">
              {customer.name || customer.customerName || customer.student || "Customer"}
            </p>
            <p className="mt-1 text-sm text-slate-500">{customer.phone || "-"}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
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
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
