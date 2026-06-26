"use client";

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Platform administration settings</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-sm font-medium text-slate-500 uppercase mb-4">
          Admin Account
        </h2>
        <p className="text-slate-900 font-medium">admin@invoicehub.com</p>
        <p className="text-slate-500 text-sm mt-1">
          To change the admin password, update the hashed password in{" "}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
            src/lib/adminAuth.js
          </code>
          .
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-sm font-medium text-slate-500 uppercase mb-4">
          Platform
        </h2>
        <p className="text-slate-500 text-sm">
          Additional billing controls, platform feature toggles, and reporting settings can be added here as InvoiceHub grows.
        </p>
      </div>
    </div>
  );
}
