"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { authFetch } from "../../../lib/authFetch";
import {
  emitSessionChange,
  setDarkModePreference,
  useBusinessSession,
  useDarkModePreference,
} from "../../../lib/clientSession";

const GATEWAYS = [
  {
    key: "monnify",
    name: "Monnify",
    blurb: "Inline checkout and server-side verification are already wired in.",
    fields: [
      { key: "apiKey", label: "API Key", type: "text" },
      { key: "secretKey", label: "Secret Key", type: "password" },
      { key: "contractCode", label: "Contract Code", type: "text" },
      { key: "webhookUrl", label: "Webhook URL", type: "url" },
      { key: "callbackUrl", label: "Redirect URL", type: "url" },
    ],
  },
  {
    key: "payaza",
    name: "PayAza",
    blurb: "Configure PayAza test credentials, webhook URL, and callback URL.",
    fields: [
      { key: "publicKey", label: "Public Key", type: "text" },
      { key: "secretKey", label: "Secret Key", type: "password" },
      { key: "webhookUrl", label: "Webhook URL", type: "url" },
      { key: "callbackUrl", label: "Redirect URL", type: "url" },
    ],
  },
  {
    key: "touchpay",
    name: "TouchPay",
    blurb: "Keep merchant credentials and webhook information in one place.",
    fields: [
      { key: "publicKey", label: "Public Key", type: "text" },
      { key: "secretKey", label: "Secret Key", type: "password" },
      { key: "merchantId", label: "Merchant ID", type: "text" },
      { key: "webhookUrl", label: "Webhook URL", type: "url" },
      { key: "callbackUrl", label: "Redirect URL", type: "url" },
    ],
  },
  {
    key: "receiptUpload",
    name: "Receipt Upload",
    blurb: "Let customers transfer to your bank account and upload proof for manual validation.",
    fields: [
      { key: "bankName", label: "Bank Name", type: "text" },
      { key: "accountName", label: "Account Name", type: "text" },
      { key: "accountNumber", label: "Account Number", type: "text" },
      { key: "paymentInstructions", label: "Payment Instructions", type: "textarea" },
    ],
  },
];

const WHATSAPP_PROVIDERS = [
  {
    key: "browser",
    name: "Browser WhatsApp",
    blurb: "Fallback option that opens a prepared WhatsApp message in the browser.",
  },
  {
    key: "whatsappWeb",
    name: "WhatsApp Web",
    blurb: "Connect a scanned WhatsApp number through your own session bridge so invoice messages go out from that number.",
    fields: [
      { key: "senderPhoneNumber", label: "Scanned WhatsApp Number", type: "tel" },
      { key: "bridgeBaseUrl", label: "Bridge Base URL", type: "url" },
      { key: "sessionName", label: "Session Name", type: "text" },
      { key: "apiKey", label: "Bridge API Key", type: "password" },
      { key: "qrConnectUrl", label: "QR Connect URL", type: "url" },
      { key: "statusWebhookUrl", label: "Status Webhook URL", type: "url" },
    ],
  },
];

const EMPTY_SETTINGS = {
  businessName: "",
  businessType: "",
  businessLogo: "",
  businessEmail: "",
  businessPhone: "",
  businessAddress: "",
  website: "",
  taxId: "",
  defaultPaymentGateway: "monnify",
  defaultWhatsAppProvider: "browser",
  paymentGateways: {
    monnify: {
      enabled: true,
      environment: "sandbox",
      apiKey: "",
      secretKey: "",
      contractCode: "",
      webhookUrl: "",
      callbackUrl: "",
    },
    payaza: {
      enabled: false,
      environment: "test",
      publicKey: "",
      secretKey: "",
      webhookUrl: "",
      callbackUrl: "",
    },
    touchpay: {
      enabled: false,
      environment: "test",
      publicKey: "",
      secretKey: "",
      merchantId: "",
      webhookUrl: "",
      callbackUrl: "",
    },
    receiptUpload: {
      enabled: false,
      environment: "manual",
      bankName: "",
      accountName: "",
      accountNumber: "",
      paymentInstructions: "",
      autoWhatsAppAcknowledgement: true,
    },
  },
  whatsappProviders: {
    browser: {
      enabled: true,
    },
    whatsappWeb: {
      enabled: false,
      senderPhoneNumber: "",
      bridgeBaseUrl: "http://localhost:8787",
      sessionName: "",
      apiKey: "invoicehub-bridge-local",
      qrConnectUrl: "",
      statusWebhookUrl: "",
    },
  },
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Unable to read logo file"));
    reader.readAsDataURL(file);
  });
}

function getPublicAppOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || "";

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

function getQuickPayUrl(token) {
  const origin = getPublicAppOrigin();
  return origin ? `${origin}/pay/qr/${token}` : `/pay/qr/${token}`;
}

export default function SettingsPage() {
  const session = useBusinessSession();
  const darkMode = useDarkModePreference();
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [quickPayProfiles, setQuickPayProfiles] = useState([]);
  const [quickPayForm, setQuickPayForm] = useState({
    description: "",
  });
  const [whatsAppTestPhone, setWhatsAppTestPhone] = useState("");
  const [quickPayQrMap, setQuickPayQrMap] = useState({});
  const [quickPaySaving, setQuickPaySaving] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [visibleSecrets, setVisibleSecrets] = useState({});
  const [verifyingGateway, setVerifyingGateway] = useState("");
  const [gatewayConnectionStatus, setGatewayConnectionStatus] = useState({});
  const [whatsAppWebStatus, setWhatsAppWebStatus] = useState(null);
  const [whatsAppWebLogs, setWhatsAppWebLogs] = useState([]);
  const [loadingWhatsAppWebStatus, setLoadingWhatsAppWebStatus] = useState(false);
  const [disconnectingWhatsAppWeb, setDisconnectingWhatsAppWeb] = useState(false);
  const [deletingWhatsAppWebSession, setDeletingWhatsAppWebSession] = useState(false);
  const [pairingPhoneNumber, setPairingPhoneNumber] = useState("");
  const [requestingPairingCode, setRequestingPairingCode] = useState(false);
  const [editingBusinessProfile, setEditingBusinessProfile] = useState(false);
  const [openSections, setOpenSections] = useState({
    appearance: false,
    gateway: false,
    whatsapp: false,
    compliance: false,
    quickPay: false,
  });
  const selectedGateway =
    GATEWAYS.find((gateway) => gateway.key === settings.defaultPaymentGateway) ||
    GATEWAYS[0];
  const selectedWhatsAppProvider =
    WHATSAPP_PROVIDERS.find((provider) => provider.key === settings.defaultWhatsAppProvider) ||
    WHATSAPP_PROVIDERS[0];

  const applyResolvedWhatsAppWebState = useCallback((data = {}) => {
    setWhatsAppWebStatus(data.status || null);
    setWhatsAppWebLogs(Array.isArray(data.logs) ? data.logs : []);

    const resolvedConfig = data.resolvedConfig || {};
    const connectedNumber =
      data.status?.connectedNumber || resolvedConfig.senderPhoneNumber || "";
    const resolvedSessionName =
      resolvedConfig.sessionName || data.status?.sessionName || "";
    const resolvedBridgeBaseUrl = resolvedConfig.bridgeBaseUrl || "";
    const resolvedQrConnectUrl =
      resolvedConfig.qrConnectUrl || data.status?.qrConnectUrl || "";

    setSettings((current) => {
      const currentProvider = current.whatsappProviders?.whatsappWeb || {};
      const nextProvider = {
        ...currentProvider,
        ...(connectedNumber ? { senderPhoneNumber: connectedNumber } : {}),
        ...(resolvedSessionName ? { sessionName: resolvedSessionName } : {}),
        ...(resolvedBridgeBaseUrl ? { bridgeBaseUrl: resolvedBridgeBaseUrl } : {}),
        ...(resolvedQrConnectUrl ? { qrConnectUrl: resolvedQrConnectUrl } : {}),
      };

      const hasChanged =
        nextProvider.senderPhoneNumber !== currentProvider.senderPhoneNumber ||
        nextProvider.sessionName !== currentProvider.sessionName ||
        nextProvider.bridgeBaseUrl !== currentProvider.bridgeBaseUrl ||
        nextProvider.qrConnectUrl !== currentProvider.qrConnectUrl;

      if (!hasChanged) {
        return current;
      }

      return {
        ...current,
        whatsappProviders: {
          ...current.whatsappProviders,
          whatsappWeb: nextProvider,
        },
      };
    });

    if (!pairingPhoneNumber && (connectedNumber || data.status?.pairingPhoneNumber)) {
      setPairingPhoneNumber(connectedNumber || data.status?.pairingPhoneNumber || "");
    }
  }, [pairingPhoneNumber]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [settingsRes, profilesRes] = await Promise.all([
          authFetch("/api/settings"),
          authFetch("/api/quick-pay-profiles"),
        ]);

        const data = settingsRes.ok ? await settingsRes.json() : null;
        const profilesData = profilesRes.ok ? await profilesRes.json() : [];

        if (!settingsRes.ok || !data) {
          throw new Error(data?.error || "Unable to load settings");
        }

        setSettings({
          ...EMPTY_SETTINGS,
          ...data,
          paymentGateways: {
            ...EMPTY_SETTINGS.paymentGateways,
            ...(data.paymentGateways || {}),
          },
          whatsappProviders: {
            ...EMPTY_SETTINGS.whatsappProviders,
            ...(data.whatsappProviders || {}),
          },
        });
        setQuickPayProfiles(Array.isArray(profilesData) ? profilesData : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const buildQrCodes = async () => {
      if (typeof window === "undefined" || quickPayProfiles.length === 0) {
        setQuickPayQrMap({});
        return;
      }

      const entries = await Promise.all(
        quickPayProfiles.map(async (profile) => [
          profile.token,
          await QRCode.toDataURL(getQuickPayUrl(profile.token), {
            width: 220,
            margin: 1,
          }),
        ])
      );

      if (!cancelled) {
        setQuickPayQrMap(Object.fromEntries(entries));
      }
    };

    buildQrCodes().catch(() => {
      if (!cancelled) {
        setQuickPayQrMap({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [quickPayProfiles]);

  useEffect(() => {
    if (selectedWhatsAppProvider.key !== "whatsappWeb") {
      return undefined;
    }

    const bridgeBaseUrl = settings.whatsappProviders?.whatsappWeb?.bridgeBaseUrl;

    if (!bridgeBaseUrl) {
      return undefined;
    }

    let cancelled = false;

    const loadBridgeStatus = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoadingWhatsAppWebStatus(true);
      }

      try {
        const res = await authFetch("/api/notifications/whatsapp/bridge/status", {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Unable to load WhatsApp Web status");
        }

        if (cancelled) {
          return;
        }

        applyResolvedWhatsAppWebState(data);
      } catch (statusError) {
        if (!cancelled) {
          setWhatsAppWebStatus(null);
          setWhatsAppWebLogs([]);
          setError(statusError.message || "Unable to load WhatsApp Web status");
        }
      } finally {
        if (!cancelled && !silent) {
          setLoadingWhatsAppWebStatus(false);
        }
      }
    };

    loadBridgeStatus();

    return () => {
      cancelled = true;
    };
  }, [
    applyResolvedWhatsAppWebState,
    selectedWhatsAppProvider.key,
    settings.whatsappProviders?.whatsappWeb?.bridgeBaseUrl,
    settings.whatsappProviders?.whatsappWeb?.sessionName,
  ]);

  const suggestedWebhookUrls = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        monnify: "/api/monnify/webhook",
        payaza: "/api/payaza/webhook",
        touchpay: "/api/touchpay/webhook",
      };
    }

    return {
      monnify: `${window.location.origin}/api/monnify/webhook`,
      payaza: `${window.location.origin}/api/payaza/webhook`,
      touchpay: `${window.location.origin}/api/touchpay/webhook`,
    };
  }, []);

  const updateField = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateGatewayField = (gatewayKey, field, value) => {
    setSettings((current) => ({
      ...current,
      paymentGateways: {
        ...current.paymentGateways,
        [gatewayKey]: {
          ...current.paymentGateways[gatewayKey],
          [field]: value,
        },
      },
    }));
  };

  const updateWhatsAppProviderField = (providerKey, field, value) => {
    setSettings((current) => ({
      ...current,
      whatsappProviders: {
        ...current.whatsappProviders,
        [providerKey]: {
          ...current.whatsappProviders[providerKey],
          [field]: value,
        },
      },
    }));
  };

  const toggleSection = (sectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateField("businessLogo", dataUrl);
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload logo");
    }
  };

  const toggleSecretVisibility = (key) => {
    setVisibleSecrets((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok || !data?.settings) {
        throw new Error(data?.error || "Unable to save settings");
      }

      setSettings({
        ...EMPTY_SETTINGS,
        ...data.settings,
        paymentGateways: {
          ...EMPTY_SETTINGS.paymentGateways,
          ...(data.settings.paymentGateways || {}),
        },
        whatsappProviders: {
          ...EMPTY_SETTINGS.whatsappProviders,
          ...(data.settings.whatsappProviders || {}),
        },
      });

      localStorage.setItem("businessName", data.settings.businessName || "");
      localStorage.setItem("businessType", data.settings.businessType || "");
      localStorage.setItem("businessLogo", data.settings.businessLogo || "");
      emitSessionChange();

      setMessage("Settings saved successfully.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  const verifyGatewayConnection = async (gatewayKey) => {
    setVerifyingGateway(gatewayKey);
    setMessage("");
    setError("");
    setGatewayConnectionStatus((current) => ({
      ...current,
      [gatewayKey]: null,
    }));

    try {
      const res = await authFetch("/api/settings/gateway-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway: gatewayKey,
          settings,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Unable to verify connection");
      }

      setGatewayConnectionStatus((current) => ({
        ...current,
        [gatewayKey]: {
          ok: true,
          message: data.message || `${data.provider || "Gateway"} connection verified.`,
        },
      }));
      setMessage(`${data.provider || "Gateway"} connection verified.`);
    } catch (verifyError) {
      setGatewayConnectionStatus((current) => ({
        ...current,
        [gatewayKey]: {
          ok: false,
          message: verifyError.message || "Connection verification failed.",
        },
      }));
      setError(verifyError.message || "Connection verification failed.");
    } finally {
      setVerifyingGateway("");
    }
  };

  const handleQuickPayChange = (key, value) => {
    setQuickPayForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
    setMessage("");
  };

  const handleCreateQuickPay = async () => {
    setQuickPaySaving(true);
    setError("");
    setMessage("");

    try {
      const res = await authFetch("/api/quick-pay-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quickPayForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to create QR payment profile");
      }

      const profilesRes = await authFetch("/api/quick-pay-profiles");
      const profilesData = profilesRes.ok ? await profilesRes.json() : [];
      setQuickPayProfiles(Array.isArray(profilesData) ? profilesData : []);
      setQuickPayForm({
        description: "",
      });
      setMessage("QR payment profile created successfully.");
    } catch (quickPayError) {
      setError(quickPayError.message || "Unable to create QR payment profile");
    } finally {
      setQuickPaySaving(false);
    }
  };

  const handleDeleteQuickPay = async (profileId) => {
    try {
      const res = await authFetch(`/api/quick-pay-profiles/${profileId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Unable to delete QR payment profile");
      }

      setQuickPayProfiles((current) =>
        current.filter((profile) => String(profile._id) !== String(profileId))
      );
      setMessage("QR payment profile deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete QR payment profile");
    }
  };

  const copyQuickPayLink = async (token) => {
    if (typeof window === "undefined") return;

    await navigator.clipboard.writeText(getQuickPayUrl(token));
    setMessage("QR payment page copied.");
  };

  const handleSendWhatsAppTest = async () => {
    setTestingWhatsApp(true);
    setError("");
    setMessage("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: whatsAppTestPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to send test message");
      }

      const providerLabel = data.provider === "whatsappWeb" ? "WhatsApp Web" : "Browser WhatsApp";
      setMessage(`Test message sent successfully through ${providerLabel}.`);
    } catch (testError) {
      setError(testError.message || "Unable to send test message");
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const refreshWhatsAppWebStatus = async () => {
    setLoadingWhatsAppWebStatus(true);
    setError("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bridge/status", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to refresh WhatsApp Web status");
      }

      applyResolvedWhatsAppWebState(data);
    } catch (statusError) {
      setError(statusError.message || "Unable to refresh WhatsApp Web status");
    } finally {
      setLoadingWhatsAppWebStatus(false);
    }
  };

  const requestWhatsAppPairingCode = async () => {
    const phoneNumber = pairingPhoneNumber.trim();

    if (!phoneNumber) {
      setError("Enter the WhatsApp phone number to connect.");
      return;
    }

    setRequestingPairingCode(true);
    setError("");
    setMessage("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bridge/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to request WhatsApp pairing code");
      }

      setWhatsAppWebStatus(data || null);
      if (data?.sessionName) {
        updateWhatsAppProviderField("whatsappWeb", "sessionName", data.sessionName);
        updateWhatsAppProviderField(
          "whatsappWeb",
          "qrConnectUrl",
          `http://localhost:8787/qr?sessionName=${encodeURIComponent(data.sessionName)}`
        );
      }
      setMessage("Pairing code generated. Enter it in WhatsApp linked devices.");
    } catch (pairingError) {
      setError(pairingError.message || "Unable to request WhatsApp pairing code");
    } finally {
      setRequestingPairingCode(false);
    }
  };

  const disconnectWhatsAppWeb = async () => {
    setDisconnectingWhatsAppWeb(true);
    setError("");
    setMessage("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bridge/disconnect", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to disconnect WhatsApp Web");
      }

      setWhatsAppWebStatus((current) =>
        current
          ? { ...current, status: "logged_out", connectedNumber: "", qrAvailable: false }
          : null
      );
      updateWhatsAppProviderField("whatsappWeb", "senderPhoneNumber", "");
      setMessage("WhatsApp Web session disconnected.");
    } catch (disconnectError) {
      setError(disconnectError.message || "Unable to disconnect WhatsApp Web");
    } finally {
      setDisconnectingWhatsAppWeb(false);
    }
  };

  const deleteWhatsAppWebSession = async () => {
    if (!confirm("Delete this WhatsApp Web session? You will need to connect the phone again.")) {
      return;
    }

    setDeletingWhatsAppWebSession(true);
    setError("");
    setMessage("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bridge/disconnect", {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to delete WhatsApp Web session");
      }

      setWhatsAppWebStatus((current) => ({
        ...(current || {}),
        status: "deleted",
        connectedNumber: "",
        pairingCode: "",
        pairingPhoneNumber: "",
        qrAvailable: false,
        lastError: "",
        lastUpdatedAt: new Date().toISOString(),
      }));
      updateWhatsAppProviderField("whatsappWeb", "senderPhoneNumber", "");
      setPairingPhoneNumber("");
      setMessage("WhatsApp Web session deleted. Generate a new pairing code to connect again.");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete WhatsApp Web session");
    } finally {
      setDeletingWhatsAppWebSession(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-slate-400">
          Configure your business identity and connect the payment gateway details each business needs before taking payments.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Business profile</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Keep the business name and logo consistent across the dashboard and public invoice pages.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {settings.businessLogo ? (
              <Image
                src={settings.businessLogo}
                alt={settings.businessName || "Business logo"}
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-2xl border border-gray-200 object-cover dark:border-slate-700"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {(settings.businessName || session.businessName || "I").charAt(0).toUpperCase()}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setEditingBusinessProfile((current) => !current)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {editingBusinessProfile ? "Minimize" : "Edit profile"}
              </button>
              {editingBusinessProfile ? (
                <label className="inline-flex cursor-pointer items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </label>
              ) : null}
              {editingBusinessProfile && settings.businessLogo ? (
                <button
                  type="button"
                  onClick={() => updateField("businessLogo", "")}
                  className="block text-sm text-red-600 dark:text-red-400"
                >
                  Remove logo
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {editingBusinessProfile ? (
          <>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label="Business name"
                value={settings.businessName}
                onChange={(value) => updateField("businessName", value)}
                placeholder="InvoiceHub Limited"
              />
              <Field
                label="Business type"
                value={settings.businessType}
                onChange={(value) => updateField("businessType", value)}
                placeholder="Professional Service"
              />
              <Field
                label="Business email"
                type="email"
                value={settings.businessEmail}
                onChange={(value) => updateField("businessEmail", value)}
                placeholder="billing@yourbusiness.com"
              />
              <Field
                label="Business phone"
                value={settings.businessPhone}
                onChange={(value) => updateField("businessPhone", value)}
                placeholder="+234 801 234 5678"
              />
              <Field
                label="Website"
                type="url"
                value={settings.website}
                onChange={(value) => updateField("website", value)}
                placeholder="https://yourbusiness.com"
              />
              <Field
                label="Tax ID"
                value={settings.taxId}
                onChange={(value) => updateField("taxId", value)}
                placeholder="Optional"
              />
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">Business address</label>
              <textarea
                value={settings.businessAddress}
                onChange={(event) => updateField("businessAddress", event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="12 Marina Road, Lagos"
              />
            </div>
          </>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryItem label="Business name" value={settings.businessName || session.businessName || "-"} />
            <SummaryItem label="Business type" value={settings.businessType || session.businessType || "-"} />
            <SummaryItem label="Business email" value={settings.businessEmail || "-"} />
            <SummaryItem label="Business phone" value={settings.businessPhone || "-"} />
            <SummaryItem label="Website" value={settings.website || "-"} />
            <SummaryItem label="Tax ID" value={settings.taxId || "-"} />
            <div className="md:col-span-2 xl:col-span-3">
              <SummaryItem label="Business address" value={settings.businessAddress || "-"} multiline />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Appearance</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Switch the dashboard between light mode and dark mode.
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleSection("appearance")}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {openSections.appearance ? "Minimize" : "Edit"}
          </button>
        </div>

        {openSections.appearance ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setDarkModePreference(!darkMode)}
              className={`inline-flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                darkMode
                  ? "border-slate-700 bg-slate-950 text-white hover:bg-slate-900"
                  : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  darkMode ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    darkMode ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
              {darkMode ? "Dark mode enabled" : "Light mode enabled"}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <SummaryItem
              label="Current appearance"
              value={darkMode ? "Dark mode enabled" : "Light mode enabled"}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gateway setup</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Save your provider credentials here so each business can manage its own payment account instead of relying on one global platform key.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleSection("gateway")}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {openSections.gateway ? "Minimize" : "Edit"}
          </button>
        </div>

        {openSections.gateway ? (
          <>
            <div className="mt-6 max-w-xl">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Preferred payment gateway
              </label>
              <select
                value={settings.defaultPaymentGateway}
                onChange={(event) => updateField("defaultPaymentGateway", event.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {GATEWAYS.map((gateway) => {
                  const gatewayConfig = settings.paymentGateways[gateway.key];

                  return (
                    <option key={gateway.key} value={gateway.key}>
                      {gateway.name} - {gatewayConfig.enabled ? "Enabled" : "Saved only"}
                    </option>
                  );
                })}
              </select>
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                {selectedGateway.blurb}
              </p>
            </div>

            <div className="space-y-6 mt-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/60 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedGateway.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  {selectedGateway.blurb}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {selectedGateway.key !== "receiptUpload" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => verifyGatewayConnection(selectedGateway.key)}
                      disabled={verifyingGateway === selectedGateway.key}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {verifyingGateway === selectedGateway.key
                        ? "Verifying..."
                        : "Verify connection"}
                    </button>

                    <select
                      value={
                        settings.paymentGateways[selectedGateway.key].environment
                      }
                      onChange={(event) =>
                        updateGatewayField(
                          selectedGateway.key,
                          "environment",
                          event.target.value
                        )
                      }
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      <option
                        value={selectedGateway.key === "monnify" ? "sandbox" : "test"}
                      >
                        {selectedGateway.key === "monnify" ? "Sandbox" : "Test"}
                      </option>
                      <option value="live">Live</option>
                    </select>
                  </>
                ) : null}

                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings.paymentGateways[selectedGateway.key].enabled}
                    onChange={(event) =>
                      updateGatewayField(
                        selectedGateway.key,
                        "enabled",
                        event.target.checked
                      )
                    }
                    className="w-4 h-4 accent-blue-600"
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {selectedGateway.fields.map((field) => {
                  const secretKeyId = `${selectedGateway.key}.${field.key}`;
                  const isSecret = field.type === "password";
                  const isSensitiveField = [
                    "apiKey",
                    "publicKey",
                    "secretKey",
                    "contractCode",
                    "merchantId",
                  ].includes(field.key);
                  const isConfigured = Boolean(
                    settings.paymentGateways[selectedGateway.key][`${field.key}Configured`]
                  );

                  return (
                    <div key={field.key}>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                          {field.label}
                        </label>
                      <div className="relative">
                        {field.type === "textarea" ? (
                          <textarea
                            value={
                              settings.paymentGateways[selectedGateway.key][field.key] || ""
                            }
                            onChange={(event) =>
                              updateGatewayField(
                                selectedGateway.key,
                                field.key,
                                event.target.value
                              )
                            }
                            rows={4}
                            placeholder={field.label}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        ) : (
                          <input
                          type={
                            isSecret && !visibleSecrets[secretKeyId]
                              ? "password"
                              : field.type
                          }
                          value={
                            settings.paymentGateways[selectedGateway.key][field.key] || ""
                          }
                          onChange={(event) =>
                            updateGatewayField(
                              selectedGateway.key,
                              field.key,
                              event.target.value
                            )
                          }
                          placeholder={
                            isSensitiveField && isConfigured
                              ? `${field.label} saved securely`
                              : field.label
                          }
                          className="w-full rounded-2xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        )}
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleSecretVisibility(secretKeyId)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-slate-400"
                          >
                            {visibleSecrets[secretKeyId] ? "Hide" : "Show"}
                          </button>
                        )}
                      </div>
                      {isSensitiveField && isConfigured && (
                        <p className="mt-2 text-xs text-emerald-700">
                          Saved securely on the server. Leave blank to keep the current value.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedGateway.key === "receiptUpload" ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  When enabled, customer invoice links will show these bank details and collect receipt uploads instead of launching online checkout.
                  <label className="mt-4 flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={
                        settings.paymentGateways.receiptUpload
                          ?.autoWhatsAppAcknowledgement !== false
                      }
                      onChange={(event) =>
                        updateGatewayField(
                          "receiptUpload",
                          "autoWhatsAppAcknowledgement",
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Auto WhatsApp acknowledgement
                  </label>
                </div>
              ) : (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Suggested webhook URL</p>
                <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-300">
                  {suggestedWebhookUrls[selectedGateway.key]}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Copy this into your {selectedGateway.name} dashboard if you want this app to receive server-side updates for that provider.
                </p>
              </div>
              )}
              {gatewayConnectionStatus[selectedGateway.key] && (
                <div
                  className={`mt-5 rounded-2xl border-2 px-5 py-4 ${
                    gatewayConnectionStatus[selectedGateway.key].ok
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100"
                      : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-bold">
                        {gatewayConnectionStatus[selectedGateway.key].ok
                          ? "Connection verified"
                          : "Connection failed"}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {gatewayConnectionStatus[selectedGateway.key].message}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        gatewayConnectionStatus[selectedGateway.key].ok
                          ? "bg-emerald-600 text-white"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {gatewayConnectionStatus[selectedGateway.key].ok ? "Verified" : "Check details"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-900">
          Monnify and PayAza are wired into checkout. TouchPay settings are saved here so that flow can be connected later.
        </div>
          </>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryItem label="Preferred gateway" value={selectedGateway.name} />
            <SummaryItem
              label="Mode"
              value={settings.paymentGateways[selectedGateway.key]?.environment || "-"}
            />
            <SummaryItem
              label="Status"
              value={settings.paymentGateways[selectedGateway.key]?.enabled ? "Enabled" : "Saved only"}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">WhatsApp delivery</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Choose how invoice messages and paid confirmations should be delivered to customers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleSection("whatsapp")}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {openSections.whatsapp ? "Minimize" : "Edit"}
          </button>
        </div>

        {openSections.whatsapp ? (
          <>
        <div className="mt-6 max-w-xl">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
            WhatsApp delivery method
          </label>
          <select
            value={settings.defaultWhatsAppProvider}
            onChange={(event) => updateField("defaultWhatsAppProvider", event.target.value)}
            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            {WHATSAPP_PROVIDERS.map((provider) => {
              const providerConfig = settings.whatsappProviders?.[provider.key] || {
                enabled: false,
              };

              return (
                <option key={provider.key} value={provider.key}>
                  {provider.name} - {providerConfig.enabled ? "Enabled" : "Disabled"}
                </option>
              );
            })}
          </select>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            {selectedWhatsAppProvider.blurb}
          </p>
        </div>

        {selectedWhatsAppProvider.key === "browser" && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/60">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Browser WhatsApp</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Open a prepared WhatsApp message in the browser when you want manual sending as your delivery method.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={settings.whatsappProviders.browser.enabled}
                  onChange={(event) =>
                    updateWhatsAppProviderField("browser", "enabled", event.target.checked)
                  }
                  className="h-4 w-4 accent-blue-600"
                />
                Enabled
              </label>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-sm font-medium text-slate-900 dark:text-white">How this behaves</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  When enabled, InvoiceHub can open a ready-made WhatsApp message in the browser. When disabled, Browser WhatsApp will no longer be used as the selected delivery method.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedWhatsAppProvider.key === "whatsappWeb" && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-slate-50 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/60">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">WhatsApp Web</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Connect your own scanned WhatsApp number through a session bridge so InvoiceHub can send from that number.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={settings.whatsappProviders.whatsappWeb.enabled}
                  onChange={(event) =>
                    updateWhatsAppProviderField("whatsappWeb", "enabled", event.target.checked)
                  }
                  className="h-4 w-4 accent-blue-600"
                />
                Enabled
              </label>
            </div>

            <div className="p-6">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-[#f7f2e8] p-6 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">WhatsApp connection</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Enter your WhatsApp number and use the pairing code in linked devices.
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        whatsAppWebStatus?.status === "ready"
                          ? "bg-emerald-100 text-emerald-700"
                          : whatsAppWebStatus?.status === "qr" ||
                              whatsAppWebStatus?.status === "authenticated" ||
                              whatsAppWebStatus?.status === "loading" ||
                              whatsAppWebStatus?.status === "retrying"
                            ? "bg-amber-100 text-amber-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {whatsAppWebStatus?.status === "ready"
                        ? "Ready to send"
                        : whatsAppWebStatus?.status === "pairing_code"
                          ? "Pairing code ready"
                        : whatsAppWebStatus?.status === "qr"
                          ? "Waiting for scan"
                          : whatsAppWebStatus?.status || "Bridge idle"}
                    </span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      WhatsApp phone number
                    </label>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                      <input
                        type="tel"
                        value={pairingPhoneNumber}
                        onChange={(event) => setPairingPhoneNumber(event.target.value)}
                        placeholder="2348012345678"
                        className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={requestWhatsAppPairingCode}
                        disabled={requestingPairingCode || whatsAppWebStatus?.status === "ready"}
                        className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {requestingPairingCode ? "Generating..." : "Get pairing code"}
                      </button>
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                      {whatsAppWebStatus?.status === "ready" ? (
                        <div>
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            WhatsApp is connected.
                          </p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Connected number: {whatsAppWebStatus.connectedNumber}
                          </p>
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Delete the current session before generating a code for another number.
                          </p>
                        </div>
                      ) : whatsAppWebStatus?.pairingCode ? (
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            In WhatsApp, open Linked devices, choose Link with phone number instead, then enter:
                          </p>
                          <div className="mt-4 rounded-xl border border-slate-300 bg-white px-5 py-4 text-center text-3xl font-semibold tracking-[0.3em] text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                            {whatsAppWebStatus.pairingCode}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Use the international format without + or spaces, then generate a pairing code.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={refreshWhatsAppWebStatus}
                      disabled={loadingWhatsAppWebStatus}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {loadingWhatsAppWebStatus ? "Checking..." : "Check status"}
                    </button>
                    <button
                      type="button"
                      onClick={disconnectWhatsAppWeb}
                      disabled={disconnectingWhatsAppWeb || deletingWhatsAppWebSession}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      {disconnectingWhatsAppWeb ? "Disconnecting..." : "Disconnect"}
                    </button>
                    <button
                      type="button"
                      onClick={deleteWhatsAppWebSession}
                      disabled={deletingWhatsAppWebSession || disconnectingWhatsAppWeb}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingWhatsAppWebSession ? "Deleting..." : "Delete session"}
                    </button>
                    {settings.whatsappProviders.whatsappWeb.qrConnectUrl ? (
                      <a
                        href={settings.whatsappProviders.whatsappWeb.qrConnectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Open QR fallback
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Connection details</p>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">Ongoing session</dt>
                        <dd className="text-right font-medium text-slate-900 dark:text-white">
                          {whatsAppWebStatus?.sessionName ||
                            settings.whatsappProviders.whatsappWeb.sessionName ||
                            "invoicehub-scan"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">Current status</dt>
                        <dd className="text-right font-medium text-slate-900 dark:text-white">
                          {whatsAppWebStatus?.status || "Unknown"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">Connected number</dt>
                        <dd className="text-right font-medium text-slate-900 dark:text-white">
                          {whatsAppWebStatus?.connectedNumber ||
                            settings.whatsappProviders.whatsappWeb.senderPhoneNumber ||
                            "Not connected yet"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">Configured session</dt>
                        <dd className="text-right font-medium text-slate-900 dark:text-white">
                          {settings.whatsappProviders.whatsappWeb.sessionName || "invoicehub-scan"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">Bridge URL</dt>
                        <dd className="max-w-[16rem] break-all text-right font-medium text-slate-900 dark:text-white">
                          {settings.whatsappProviders.whatsappWeb.bridgeBaseUrl || "Not set"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">Last update</dt>
                        <dd className="text-right font-medium text-slate-900 dark:text-white">
                          {whatsAppWebStatus?.lastUpdatedAt
                            ? new Date(whatsAppWebStatus.lastUpdatedAt).toLocaleString()
                            : "-"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Recent bridge activity</p>
                    {whatsAppWebLogs.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        No recent message activity yet.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {whatsAppWebLogs.slice(0, 5).map((log) => (
                          <div
                            key={log.id}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {log.status === "sent" ? "Sent" : "Failed"} to {log.to || "-"}
                              </p>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ""}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {log.preview || log.error || "No preview"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">How to use</p>
                    <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <li>1. Start your WhatsApp Web bridge and keep the bridge URL saved below.</li>
                      <li>2. Enter the WhatsApp number in international format and generate a pairing code.</li>
                      <li>3. In WhatsApp, open Linked devices and choose Link with phone number instead.</li>
                      <li>4. Use the test button before sending live customer messages.</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-sm font-medium text-slate-900 dark:text-white">How this behaves</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  This option is designed for a WhatsApp Web bridge that keeps a scanned session alive outside InvoiceHub. Once that bridge is connected, invoice messages and paid confirmations can be sent from the scanned WhatsApp number.
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Send test message</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  This checks whether InvoiceHub can reach your WhatsApp Web bridge and dispatch a message through the connected session.
                </p>

                <div className="mt-4 flex flex-col gap-3 md:flex-row">
                  <input
                    type="tel"
                    value={whatsAppTestPhone}
                    onChange={(event) => setWhatsAppTestPhone(event.target.value)}
                    placeholder="08103902471"
                    className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSendWhatsAppTest}
                    disabled={testingWhatsApp}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    {testingWhatsApp ? "Sending..." : "Send test message"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

          </>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryItem label="Delivery method" value={selectedWhatsAppProvider.name} />
            <SummaryItem
              label="Provider status"
              value={
                settings.whatsappProviders?.[selectedWhatsAppProvider.key]?.enabled
                  ? "Enabled"
                  : "Disabled"
              }
            />
            <SummaryItem
              label="Sending number"
              value={
                settings.whatsappProviders?.whatsappWeb?.senderPhoneNumber ||
                whatsAppWebStatus?.connectedNumber ||
                "Not connected"
              }
            />
          </div>
        )}

      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-8 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Platform compliance posture</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              InvoiceHub should be presented as invoicing software, not as the entity receiving,
              pooling, or resettling customer funds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleSection("compliance")}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {openSections.compliance ? "Minimize" : "Edit"}
          </button>
        </div>

        {openSections.compliance ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-white">Operational checklist</p>
            <ul className="mt-3 space-y-2">
              <li>Use each business&apos;s own payment gateway credentials and settlement account.</li>
              <li>Do not describe InvoiceHub as the fund holder or settlement agent.</li>
              <li>Keep business contact details accurate for customer notices and support.</li>
              <li>Verify paid status from gateway webhook or verification response before treating an invoice as settled.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-white">Public notices now available</p>
            <ul className="mt-3 space-y-2">
              <li>Privacy notice: <span className="font-mono text-xs">/privacy</span></li>
              <li>Platform terms: <span className="font-mono text-xs">/terms</span></li>
              <li>Public payment pages now display software-role and data-use disclosures.</li>
              <li>Customer continuation now requires acknowledgment on payment screens.</li>
            </ul>
          </div>
        </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryItem label="Operational checklist" value="4 guidance items saved" />
            <SummaryItem label="Public notices" value="Privacy, terms, and payment disclosures active" />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-8 space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">QR payment setup</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Create reusable QR payment links. When someone scans one, they enter their phone number and amount, complete payment in Monnify, and a paid invoice is created automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleSection("quickPay")}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {openSections.quickPay ? "Minimize" : "Edit"}
          </button>
        </div>

        {openSections.quickPay ? (
          <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field
            label="Description"
            value={quickPayForm.description}
            onChange={(value) => handleQuickPayChange("description", value)}
            placeholder="Fuel payment for pump 1"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCreateQuickPay}
            disabled={quickPaySaving}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:bg-emerald-300"
          >
            {quickPaySaving ? "Generating..." : "Generate QR code"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {quickPayProfiles.map((profile) => (
            <div
              key={profile._id}
              className="border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-5 dark:border-slate-800"
            >
              <div className="flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:w-[220px]">
                {quickPayQrMap[profile.token] ? (
                  <Image
                    src={quickPayQrMap[profile.token]}
                    alt={`QR code for ${profile.description}`}
                    width={200}
                    height={200}
                    unoptimized
                    className="h-auto w-full max-w-[200px]"
                  />
                ) : (
                  <div className="flex aspect-square w-full max-w-[200px] items-center justify-center text-center text-sm text-slate-400">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3 min-w-0">
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {profile.description}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Scanning this QR opens the payment page where the customer enters phone number and amount.
                  </p>
                </div>

                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  QR destination: payment form
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => copyQuickPayLink(profile.token)}
                    className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Copy link
                  </button>
                  <a
                    href={getQuickPayUrl(profile.token)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Open page
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuickPay(profile._id)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {quickPayProfiles.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No QR payment profiles yet.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          This flow currently uses Monnify account transfer checkout. The scanned page asks for phone number and amount, then creates a paid invoice from the successful webhook or verify callback. When the WhatsApp bridge is configured, payment confirmations can be sent automatically from the connected session.
        </div>
          </>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryItem label="QR profiles" value={String(quickPayProfiles.length)} />
            <SummaryItem
              label="Current flow"
              value="Customer enters phone number and amount"
            />
            <SummaryItem label="Gateway" value="Monnify transfer checkout" />
          </div>
        )}
      </section>

      {(error || message) && (
        <div
          className={`rounded-2xl px-5 py-4 text-sm ${
            error
              ? "bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
              : "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-300"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </div>
  );
}

function SummaryItem({ label, value, multiline = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-2 text-sm font-medium text-slate-900 dark:text-white ${
          multiline ? "whitespace-pre-wrap break-words" : "truncate"
        }`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </p>
    </div>
  );
}
