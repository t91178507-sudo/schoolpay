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
  twilioManaged: {
    configured: false,
    accountSidConfigured: false,
    authTokenConfigured: false,
    apiKeySidConfigured: false,
    apiKeySecretConfigured: false,
    credentialType: "apiKey",
    accountSidHint: "",
    apiKeySidHint: "",
    accountSid: "",
    authToken: "",
    apiKeySid: "",
    apiKeySecret: "",
    verifiedAt: null,
    updatedAt: null,
  },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTwilio, setSavingTwilio] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);

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
          twilioManaged: {
            ...EMPTY_SETTINGS.twilioManaged,
            ...(data.twilioManaged || {}),
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

  const updateTwilioField = (field, value) => {
    setSettings((current) => ({
      ...current,
      twilioManaged: {
        ...current.twilioManaged,
        [field]: value,
      },
    }));
    setMessage("");
    setError("");
  };

  const handleSaveTwilio = async (event) => {
    event.preventDefault();
    setSavingTwilio(true);
    setMessage("");
    setError("");

    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "twilioManaged",
          twilioManaged: {
            credentialType: settings.twilioManaged.credentialType || "apiKey",
            accountSid: settings.twilioManaged.accountSid || "",
            authToken: settings.twilioManaged.authToken || "",
            apiKeySid: settings.twilioManaged.apiKeySid || "",
            apiKeySecret: settings.twilioManaged.apiKeySecret || "",
          },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to verify Twilio account");
      }

      setSettings((current) => ({
        ...current,
        twilioManaged: {
          ...EMPTY_SETTINGS.twilioManaged,
          ...(data.settings?.twilioManaged || {}),
        },
      }));
      setMessage(data.message || "Twilio platform account verified.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save Twilio settings");
    } finally {
      setSavingTwilio(false);
    }
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
        body: JSON.stringify({ ...settings, section: "whatsappBridge" }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to save settings");
      }

      setSettings((current) => ({
        ...current,
        whatsappBridge: {
          ...EMPTY_SETTINGS.whatsappBridge,
          ...(data.settings?.whatsappBridge || {}),
        },
      }));
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

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSaveTwilio} className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Twilio managed WhatsApp</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Connect InvoiceHub's parent Twilio account. Verified businesses can then create an isolated subaccount and register their own WhatsApp sender.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${settings.twilioManaged.configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {settings.twilioManaged.configured ? "Ready for subaccounts" : "Setup required"}
          </span>
        </div>

        <div className="mt-6">
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Authentication method</legend>
            <div className="mt-2 inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => updateTwilioField("credentialType", "authToken")}
                className={`min-h-10 rounded-md px-4 text-sm font-semibold transition ${
                  settings.twilioManaged.credentialType === "authToken"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Account Auth Token
              </button>
              <button
                type="button"
                onClick={() => updateTwilioField("credentialType", "apiKey")}
                className={`min-h-10 rounded-md px-4 text-sm font-semibold transition ${
                  settings.twilioManaged.credentialType !== "authToken"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                Main API Key
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Use the Account Auth Token for the simplest setup. For key-based access, create a Main API Key; Restricted and Standard keys cannot create subaccounts.
            </p>
          </fieldset>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Parent Account SID</label>
              <input
                type="text"
                required={!settings.twilioManaged.accountSidConfigured}
                value={settings.twilioManaged.accountSid || ""}
                onChange={(event) => updateTwilioField("accountSid", event.target.value)}
                placeholder={settings.twilioManaged.accountSidConfigured ? `Saved securely (${settings.twilioManaged.accountSidHint})` : "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-slate-500"
              />
              {settings.twilioManaged.accountSidConfigured ? <p className="mt-2 text-xs text-emerald-700">Account SID saved securely. Leave blank to keep it.</p> : null}
            </div>

            {settings.twilioManaged.credentialType === "authToken" ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Account Auth Token</label>
                <div className="flex min-h-12 rounded-lg border border-slate-300 focus-within:border-slate-500">
                  <input
                    type={showTwilioToken ? "text" : "password"}
                    required={!settings.twilioManaged.authTokenConfigured}
                    value={settings.twilioManaged.authToken || ""}
                    onChange={(event) => updateTwilioField("authToken", event.target.value)}
                    placeholder={settings.twilioManaged.authTokenConfigured ? "Saved securely" : "Enter the live Auth Token"}
                    className="min-w-0 flex-1 rounded-l-lg px-4 text-sm outline-none"
                  />
                  <button type="button" onClick={() => setShowTwilioToken((visible) => !visible)} className="px-4 text-sm font-medium text-slate-500 hover:text-slate-900">
                    {showTwilioToken ? "Hide" : "Show"}
                  </button>
                </div>
                {settings.twilioManaged.authTokenConfigured ? <p className="mt-2 text-xs text-emerald-700">Auth Token saved securely. Leave blank to keep it.</p> : null}
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Main API Key SID</label>
                  <input
                    type="text"
                    required={!settings.twilioManaged.apiKeySidConfigured}
                    value={settings.twilioManaged.apiKeySid || ""}
                    onChange={(event) => updateTwilioField("apiKeySid", event.target.value)}
                    placeholder={settings.twilioManaged.apiKeySidConfigured ? `Saved securely (${settings.twilioManaged.apiKeySidHint})` : "SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                    className="min-h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-slate-500"
                  />
                  {settings.twilioManaged.apiKeySidConfigured ? <p className="mt-2 text-xs text-emerald-700">API Key SID saved securely. Leave blank to keep it.</p> : null}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Main API Key Secret</label>
                  <div className="flex min-h-12 rounded-lg border border-slate-300 focus-within:border-slate-500">
                    <input
                      type={showTwilioToken ? "text" : "password"}
                      required={!settings.twilioManaged.apiKeySecretConfigured}
                      value={settings.twilioManaged.apiKeySecret || ""}
                      onChange={(event) => updateTwilioField("apiKeySecret", event.target.value)}
                      placeholder={settings.twilioManaged.apiKeySecretConfigured ? "Saved securely" : "Enter API Key Secret"}
                      className="min-w-0 flex-1 rounded-l-lg px-4 text-sm outline-none"
                    />
                    <button type="button" onClick={() => setShowTwilioToken((visible) => !visible)} className="px-4 text-sm font-medium text-slate-500 hover:text-slate-900">
                      {showTwilioToken ? "Hide" : "Show"}
                    </button>
                  </div>
                  {settings.twilioManaged.apiKeySecretConfigured ? <p className="mt-2 text-xs text-emerald-700">API Key Secret saved securely. Leave blank to keep it.</p> : null}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
          <p className="text-xs text-slate-500">
            {settings.twilioManaged.verifiedAt ? `Last verified ${new Date(settings.twilioManaged.verifiedAt).toLocaleString()}` : "Credentials are verified with Twilio before they are saved."}
          </p>
          <button type="submit" disabled={savingTwilio} className="min-h-11 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
            {savingTwilio ? "Verifying..." : settings.twilioManaged.configured ? "Verify or replace" : "Save and verify"}
          </button>
        </div>
      </form>
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
