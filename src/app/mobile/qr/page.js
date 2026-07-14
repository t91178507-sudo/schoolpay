"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../../../lib/authFetch";

export default function MobileQrPage() {
  const [qrType, setQrType] = useState("static");
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [invoiceRes, customerRes] = await Promise.all([
          authFetch("/api/mobile/invoices"),
          authFetch("/api/mobile/customers"),
        ]);
        const invoiceData = await invoiceRes.json().catch(() => []);
        const customerData = await customerRes.json().catch(() => []);

        setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
        setCustomers(Array.isArray(customerData) ? customerData : []);
      } catch {}
    };

    load();
  }, []);

  const options = useMemo(() => {
    if (qrType === "invoice") {
      return invoices.map((invoice) => ({
        value: invoice.token,
        label: `${invoice.invoiceNumber} - ${invoice.customer || invoice.customerName || "Customer"}`,
      }));
    }

    if (qrType === "customer") {
      return customers.map((customer) => ({
        value: customer.token,
        label: customer.name || customer.customerName || customer.student || "Customer",
      }));
    }

    return [];
  }, [customers, invoices, qrType]);

  const generateQr = async () => {
    setError("");

    try {
      const baseUrl = window.location.origin;
      const value =
        qrType === "invoice"
          ? `${baseUrl}/pay/${selectedId}`
          : qrType === "customer"
            ? `${baseUrl}/pay/${selectedId}`
            : qrType === "dynamic"
              ? `${baseUrl}/pay/qr/demo`
              : `${baseUrl}/pay/qr/demo`;

      const res = await authFetch(`/api/mobile/qr?value=${encodeURIComponent(value)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to generate QR code");
      }

      setQrValue(value);
      setQrDataUrl(data.dataUrl || "");
    } catch (qrError) {
      setError(qrError.message || "Unable to generate QR code");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {["static", "dynamic", "invoice", "customer"].map((type) => (
          <button
            key={type}
            onClick={() => setQrType(type)}
            className={`rounded-2xl px-3 py-3 text-sm font-medium ${
              qrType === type ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {options.length ? (
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none"
        >
          <option value="">Select item</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      <button
        onClick={generateQr}
        className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
      >
        Generate QR
      </button>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {qrDataUrl ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
          <Image
            src={qrDataUrl}
            alt="Generated QR code"
            width={288}
            height={288}
            unoptimized
            className="mx-auto h-72 w-72 rounded-2xl bg-white p-4"
          />
          <p className="mt-4 break-all text-xs text-slate-500">{qrValue}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(qrValue)}
              className="rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-200"
            >
              Copy Link
            </button>
            <a
              href={qrDataUrl}
              download="invoicehub-qr.png"
              className="rounded-2xl border border-slate-700 px-3 py-2 text-center text-sm text-slate-200"
            >
              Download
            </a>
            <button
              onClick={() => navigator.share?.({ title: "QR Payment", url: qrValue })}
              className="rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-200"
            >
              Share
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
