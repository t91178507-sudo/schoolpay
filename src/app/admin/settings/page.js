"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

const EMPTY_SETTINGS = {
  whatsappBridge: {
    bridgeBaseUrl: "",
    bridgePort: "",
    apiKey: "",
    updatedAt: null,
  },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await adminFetch("/api/admin/settings");
        const data = res.ok ? await res.json() : EMPTY_SETTINGS;
        setSettings({
          whatsappBridge: {
            ...EMPTY_SETTINGS.whatsappBridge,
            ...(data.whatsappBridge || {}),
          },
        });
      } catch {
        setError("Unable to load admin settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateBridgeField = (field, value) => {
    setSettings((current) => ({
      ...current,
      whatsappBridge: {
        ...current.whatsappBridge,
        [field]: value,
      },
    }));
    setMessage("");
    setError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to save settings");
      }

      setSettings({
        whatsappBridge: {
          ...EMPTY_SETTINGS.whatsappBridge,
          ...(data.settings?.whatsappBridge || {}),
        },
      });
      setMessage(`WhatsApp bridge updated for ${data.updatedUsers || 0} user account${data.updatedUsers === 1 ? "" : "s"}.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to save admin settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">Platform administration settings</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <h2 className="mb-4 text-sm font-medium uppercase text-slate-500">
          Admin Account
        </h2>
        <p className="font-medium text-slate-900">Configured with environment variables</p>
        <p className="mt-1 text-sm text-slate-500">
          To change the admin login, update{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            ADMIN_EMAIL
          </code>
          {" "}and{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            ADMIN_PASSWORD_HASH
          </code>
          {" "}in your environment variables.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-8">
        <div className="mb-6">
          <h2 className="text-sm font-medium uppercase text-slate-500">
            WhatsApp Bridge
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Changes here are applied to every business user and make WhatsApp Web the default provider.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">
              Public bridge base URL
            </label>
            <input
              type="url"
              required
              value={settings.whatsappBridge.bridgeBaseUrl}
              onChange={(event) => updateBridgeField("bridgeBaseUrl", event.target.value)}
              placeholder="https://your-whatsapp-bridge.onrender.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Bridge port
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={settings.whatsappBridge.bridgePort}
              onChange={(event) => updateBridgeField("bridgePort", event.target.value)}
              placeholder="8787"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Bridge API key
            </label>
            <div className="flex rounded-xl border border-slate-300 focus-within:border-slate-500">
              <input
                type={showApiKey ? "text" : "password"}
                required
                value={settings.whatsappBridge.apiKey}
                onChange={(event) => updateBridgeField("apiKey", event.target.value)}
                placeholder="Shared bridge API key"
                className="min-w-0 flex-1 rounded-l-xl px-4 py-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((visible) => !visible)}
                className="rounded-r-xl px-4 text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        {settings.whatsappBridge.updatedAt ? (
          <p className="mt-4 text-xs text-slate-400">
            Last updated {new Date(settings.whatsappBridge.updatedAt).toLocaleString()}
          </p>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Applying..." : "Apply to all users"}
          </button>
        </div>
      </form>
    </div>
  );
}
