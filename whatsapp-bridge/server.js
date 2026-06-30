import cors from "cors";
import { execFile } from "child_process";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import QRCode from "qrcode";
import pkg from "whatsapp-web.js";

const { Client, LocalAuth } = pkg;

const PORT = Number(process.env.WHATSAPP_BRIDGE_PORT || 8787);
const API_KEY = process.env.WHATSAPP_BRIDGE_API_KEY || "invoicehub-bridge-local";
const DEFAULT_SESSION_NAME =
  process.env.WHATSAPP_BRIDGE_SESSION_NAME || "invoicehub-scan";
const BASE_URL = process.env.WHATSAPP_BRIDGE_BASE_URL || `http://localhost:${PORT}`;
const BROWSER_PATH =
  process.env.WHATSAPP_BRIDGE_BROWSER_PATH ||
  (process.platform === "win32"
    ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    : "/usr/bin/chromium");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const sessions = new Map();
const execFileAsync = promisify(execFile);

process.on("unhandledRejection", (error) => {
  console.error("Unhandled bridge promise rejection:", error);
});

function normalizeSessionName(rawSessionName) {
  const value = String(rawSessionName || "").trim();
  return value || DEFAULT_SESSION_NAME;
}

function buildSessionState(sessionName) {
  return {
    sessionName,
    client: null,
    initializingPromise: null,
    status: "idle",
    qrDataUrl: "",
    pairingCode: "",
    pairingPhoneNumber: "",
    pairingRequestedAt: "",
    connectedNumber: "",
    lastError: "",
    lastUpdatedAt: new Date().toISOString(),
    restartTimer: null,
    messageLogs: [],
    logoutRequested: false,
  };
}

function getSessionState(sessionName) {
  const normalized = normalizeSessionName(sessionName);

  if (!sessions.has(normalized)) {
    sessions.set(normalized, buildSessionState(normalized));
  }

  return sessions.get(normalized);
}

function touchSession(sessionState, nextStatus) {
  if (nextStatus) {
    sessionState.status = nextStatus;
  }

  sessionState.lastUpdatedAt = new Date().toISOString();
}

function addMessageLog(sessionState, entry) {
  sessionState.messageLogs = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    },
    ...sessionState.messageLogs,
  ].slice(0, 50);
}

function isRecoverableBrowserError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    message.includes("detached frame") ||
    message.includes("execution context was destroyed") ||
    message.includes("target closed") ||
    message.includes("session closed") ||
    message.includes("page crashed")
  );
}

function getSessionStoragePath(sessionName) {
  return path.join(process.cwd(), ".sessions", `session-${sessionName}`);
}

async function stopSessionBrowserProcesses(sessionName) {
  if (process.platform !== "win32") {
    return;
  }

  const storagePath = getSessionStoragePath(sessionName).replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$target = '${storagePath}'`,
    "Get-CimInstance Win32_Process |",
    "Where-Object { $_.Name -eq 'msedge.exe' -and $_.CommandLine -like ('*' + $target + '*') } |",
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
  ].join("; ");

  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
    windowsHide: true,
  }).catch(() => {});
}

async function clearStoredSession(sessionName) {
  await stopSessionBrowserProcesses(sessionName);
  await fs.rm(getSessionStoragePath(sessionName), {
    recursive: true,
    force: true,
  });
}

function clearSessionRuntime(sessionState, nextStatus = "deleted") {
  sessionState.client = null;
  sessionState.initializingPromise = null;
  sessionState.qrDataUrl = "";
  sessionState.pairingCode = "";
  sessionState.pairingPhoneNumber = "";
  sessionState.pairingRequestedAt = "";
  sessionState.connectedNumber = "";
  sessionState.lastError = "";
  touchSession(sessionState, nextStatus);
}

function clearRestartTimer(sessionState) {
  if (sessionState.restartTimer) {
    clearTimeout(sessionState.restartTimer);
    sessionState.restartTimer = null;
  }
}

function serializeSessionState(sessionState) {
  return {
    status: sessionState.status,
    sessionName: sessionState.sessionName,
    connectedNumber: sessionState.connectedNumber,
    pairingCode: sessionState.pairingCode,
    pairingPhoneNumber: sessionState.pairingPhoneNumber,
    pairingRequestedAt: sessionState.pairingRequestedAt,
    qrAvailable: Boolean(sessionState.qrDataUrl),
    lastError: sessionState.lastError,
    lastUpdatedAt: sessionState.lastUpdatedAt,
    qrConnectUrl: `${BASE_URL}/qr?sessionName=${encodeURIComponent(sessionState.sessionName)}`,
  };
}

function getSessionSnapshot(sessionName, { bootstrap = false } = {}) {
  const sessionState = getSessionState(sessionName);

  if (
    bootstrap &&
    !sessionState.client &&
    !sessionState.initializingPromise &&
    !sessionState.restartTimer &&
    sessionState.status !== "ready"
  ) {
    ensureSession(sessionState.sessionName).catch(() => {});
  }

  return sessionState;
}

async function buildClient(sessionState) {
  const nextClient = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionState.sessionName,
      dataPath: "./.sessions",
    }),
    ...(sessionState.pairingPhoneNumber
      ? {
          pairWithPhoneNumber: {
            phoneNumber: sessionState.pairingPhoneNumber,
            showNotification: true,
            intervalMs: 180000,
          },
        }
      : {}),
    puppeteer: {
      executablePath: BROWSER_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  });

  nextClient.on("qr", async (qr) => {
    sessionState.logoutRequested = false;
    sessionState.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
    sessionState.pairingCode = "";
    sessionState.pairingPhoneNumber = "";
    sessionState.pairingRequestedAt = "";
    sessionState.connectedNumber = "";
    sessionState.lastError = "";
    touchSession(sessionState, "qr");
  });

  nextClient.on("code", (code) => {
    sessionState.pairingCode = String(code || "");
    sessionState.pairingRequestedAt = new Date().toISOString();
    sessionState.qrDataUrl = "";
    sessionState.lastError = "";
    touchSession(sessionState, "pairing_code");
  });

  nextClient.on("loading_screen", () => touchSession(sessionState, "loading"));
  nextClient.on("authenticated", () => touchSession(sessionState, "authenticated"));
  nextClient.on("ready", async () => {
    sessionState.logoutRequested = false;
    sessionState.qrDataUrl = "";
    sessionState.pairingCode = "";
    sessionState.pairingPhoneNumber = "";
    sessionState.pairingRequestedAt = "";
    sessionState.lastError = "";
    sessionState.connectedNumber = nextClient.info?.wid?.user || "";
    touchSession(sessionState, "ready");
  });

  nextClient.on("auth_failure", (message) => {
    sessionState.lastError = String(message || "Authentication failed");
    sessionState.connectedNumber = "";
    touchSession(sessionState, sessionState.logoutRequested ? "logged_out" : "auth_failure");

    if (!sessionState.logoutRequested) {
      scheduleRestart(sessionState, sessionState.lastError);
    }
  });

  nextClient.on("disconnected", (reason) => {
    sessionState.lastError = String(reason || "Disconnected");
    sessionState.connectedNumber = "";
    touchSession(sessionState, sessionState.logoutRequested ? "logged_out" : "disconnected");

    if (!sessionState.logoutRequested) {
      scheduleRestart(sessionState, sessionState.lastError);
    }
  });

  await nextClient.initialize();
  sessionState.client = nextClient;
  return nextClient;
}

function scheduleRestart(sessionState, reason) {
  if (sessionState.logoutRequested) {
    return;
  }

  sessionState.lastError = reason || sessionState.lastError;
  touchSession(sessionState, "retrying");

  if (sessionState.restartTimer) {
    return;
  }

  sessionState.restartTimer = setTimeout(async () => {
    sessionState.restartTimer = null;

    try {
      if (sessionState.client) {
        await sessionState.client.destroy().catch(() => {});
      }

      sessionState.client = null;
      sessionState.initializingPromise = null;
      await ensureSession(sessionState.sessionName);
    } catch (error) {
      scheduleRestart(sessionState, error.message || "Failed to restart WhatsApp bridge");
    }
  }, 5000);
}

async function restartSessionImmediately(sessionState, reason) {
  clearRestartTimer(sessionState);
  sessionState.lastError = reason || sessionState.lastError || "Restarting WhatsApp session";
  touchSession(sessionState, "retrying");

  if (sessionState.client) {
    await sessionState.client.destroy().catch(() => {});
  }

  sessionState.client = null;
  sessionState.initializingPromise = null;
  await ensureSession(sessionState.sessionName);
}

async function ensureSession(sessionName) {
  const sessionState = getSessionState(sessionName);

  if (sessionState.client) {
    return sessionState;
  }

  if (!sessionState.initializingPromise) {
    touchSession(sessionState, "starting");
    sessionState.initializingPromise = buildClient(sessionState)
      .catch((error) => {
        scheduleRestart(sessionState, error.message || "Failed to start WhatsApp session");
        throw error;
      })
      .finally(() => {
        sessionState.initializingPromise = null;
      });
  }

  try {
    await sessionState.initializingPromise;
  } catch {
    // retry path handled by scheduleRestart
  }

  return sessionState;
}

function waitForPairingCode(sessionState, timeoutMs = 45000) {
  if (sessionState.pairingCode) {
    return Promise.resolve(sessionState.pairingCode);
  }

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (sessionState.pairingCode) {
        clearInterval(interval);
        resolve(sessionState.pairingCode);
        return;
      }

      if (sessionState.lastError) {
        clearInterval(interval);
        reject(new Error(sessionState.lastError));
        return;
      }

      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Timed out waiting for WhatsApp pairing code"));
      }
    }, 500);
  });
}

function waitForReadySession(sessionState, timeoutMs = 20000) {
  if (sessionState.client && sessionState.status === "ready") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (sessionState.client && sessionState.status === "ready") {
        clearInterval(interval);
        resolve();
        return;
      }

      if (["qr", "pairing_code", "auth_failure", "logged_out", "deleted"].includes(sessionState.status)) {
        clearInterval(interval);
        reject(new Error(`WhatsApp session is ${sessionState.status}`));
        return;
      }

      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Timed out waiting for WhatsApp session to recover"));
      }
    }, 500);
  });
}

async function sendTextWithRecovery(sessionState, chatId, text) {
  try {
    return await sessionState.client.sendMessage(chatId, text);
  } catch (error) {
    if (!isRecoverableBrowserError(error)) {
      throw error;
    }

    await restartSessionImmediately(
      sessionState,
      error.message || "WhatsApp browser context detached"
    );
    await waitForReadySession(sessionState);

    return sessionState.client.sendMessage(chatId, text);
  }
}

function requireApiKey(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (token !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

function readSessionName(req) {
  return (
    req.query.sessionName ||
    req.body?.sessionName ||
    DEFAULT_SESSION_NAME
  );
}

app.get("/health", (_req, res) => {
  const payload = Array.from(sessions.values()).map((sessionState) =>
    serializeSessionState(sessionState)
  );

  res.json({
    ok: true,
    sessions: payload,
    totalSessions: payload.length,
    baseUrl: BASE_URL,
  });
});

app.get("/api/session/status", async (req, res) => {
  const sessionState = getSessionSnapshot(readSessionName(req), { bootstrap: true });
  res.json(serializeSessionState(sessionState));
});

app.get("/api/session/qr", async (req, res) => {
  const sessionState = await ensureSession(readSessionName(req));
  res.json({
    ...serializeSessionState(sessionState),
    qrDataUrl: sessionState.qrDataUrl,
  });
});

app.post("/api/session/pairing-code", requireApiKey, async (req, res) => {
  const sessionName = normalizeSessionName(readSessionName(req));
  const sessionState = getSessionState(sessionName);
  const phoneNumber = String(req.body?.phoneNumber || "").trim().replace(/\D/g, "");

  if (!phoneNumber) {
    res.status(400).json({ error: "phoneNumber is required" });
    return;
  }

  try {
    if (sessionState.status === "ready") {
      res.status(409).json({ error: "WhatsApp session is already connected" });
      return;
    }

    sessionState.logoutRequested = true;
    clearRestartTimer(sessionState);

    if (sessionState.client) {
      await sessionState.client.destroy().catch(() => {});
    }

    await clearStoredSession(sessionName);
    sessionState.client = null;
    sessionState.initializingPromise = null;
    sessionState.logoutRequested = false;
    sessionState.pairingPhoneNumber = phoneNumber;
    sessionState.pairingCode = "";
    sessionState.pairingRequestedAt = "";
    sessionState.qrDataUrl = "";
    sessionState.lastError = "";

    await ensureSession(sessionName);
    await waitForPairingCode(sessionState);

    res.json({
      success: true,
      ...serializeSessionState(sessionState),
    });
  } catch (error) {
    sessionState.lastError = error.message || "Unable to request pairing code";
    touchSession(sessionState);
    res.status(500).json({ error: sessionState.lastError });
  }
});

app.get("/api/messages/logs", requireApiKey, async (req, res) => {
  const sessionState = await ensureSession(readSessionName(req));
  res.json({
    success: true,
    logs: sessionState.messageLogs,
  });
});

app.post("/api/messages/send-text", requireApiKey, async (req, res) => {
  const sessionState = await ensureSession(readSessionName(req));

  try {
    if (!sessionState.client || sessionState.status !== "ready") {
      res.status(409).json({ error: "WhatsApp session is not ready" });
      return;
    }

    const to = String(req.body?.to || "").trim().replace(/\D/g, "");
    const text = String(req.body?.text || "").trim();

    if (!to || !text) {
      res.status(400).json({ error: "to and text are required" });
      return;
    }

    const chatId = `${to}@c.us`;
    const result = await sendTextWithRecovery(sessionState, chatId, text);
    touchSession(sessionState);
    addMessageLog(sessionState, {
      direction: "outbound",
      status: "sent",
      to,
      preview: text.slice(0, 120),
      provider: "whatsappWeb",
    });

    res.json({
      success: true,
      id: result?.id?._serialized || "",
      to,
      sessionName: sessionState.sessionName,
    });
  } catch (error) {
    sessionState.lastError = error.message || "Unable to send message";
    touchSession(sessionState);
    addMessageLog(sessionState, {
      direction: "outbound",
      status: "failed",
      to: String(req.body?.to || "").trim().replace(/\D/g, ""),
      preview: String(req.body?.text || "").trim().slice(0, 120),
      provider: "whatsappWeb",
      error: sessionState.lastError,
    });
    res.status(500).json({ error: sessionState.lastError });
  }
});

app.post("/api/session/logout", requireApiKey, async (req, res) => {
  const sessionState = await ensureSession(readSessionName(req));

  try {
    sessionState.logoutRequested = true;
    clearRestartTimer(sessionState);

    if (sessionState.client) {
      await sessionState.client.logout();
      await sessionState.client.destroy().catch(() => {});
    }

    await clearStoredSession(sessionState.sessionName);
    clearSessionRuntime(sessionState, "logged_out");

    ensureSession(sessionState.sessionName).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    sessionState.logoutRequested = false;
    sessionState.lastError = error.message || "Unable to logout";
    touchSession(sessionState);
    res.status(500).json({ error: sessionState.lastError });
  }
});

app.delete("/api/session", requireApiKey, async (req, res) => {
  const sessionName = normalizeSessionName(readSessionName(req));
  const sessionState = getSessionState(sessionName);

  try {
    sessionState.logoutRequested = true;
    clearRestartTimer(sessionState);

    if (sessionState.client) {
      await sessionState.client.logout().catch(() => {});
      await sessionState.client.destroy().catch(() => {});
    }

    await clearStoredSession(sessionName);
    clearSessionRuntime(sessionState, "deleted");
    sessions.delete(sessionName);

    res.json({
      success: true,
      sessionName,
      status: "deleted",
    });
  } catch (error) {
    sessionState.logoutRequested = false;
    sessionState.lastError = error.message || "Unable to delete session";
    touchSession(sessionState);
    res.status(500).json({ error: sessionState.lastError });
  }
});

app.get("/qr", async (req, res) => {
  const sessionName = normalizeSessionName(req.query.sessionName);
  await ensureSession(sessionName);

  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>InvoiceHub WhatsApp Bridge</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f6f1e6; color: #0f172a; margin: 0; }
      .wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px; }
      .card { background: #fff; border: 1px solid #d7dbe3; border-radius: 24px; padding: 24px; }
      .grid { display: grid; gap: 24px; grid-template-columns: 1.1fr 0.9fr; align-items: center; }
      .qr { display: flex; align-items: center; justify-content: center; min-height: 360px; border: 1px solid #d7dbe3; border-radius: 20px; background: #fff; }
      .status { display: inline-flex; padding: 8px 12px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; }
      img { max-width: 320px; width: 100%; height: auto; }
      .meta { font-size: 14px; color: #475569; }
      @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="grid">
          <div>
            <div id="status" class="status">Loading</div>
            <h1>Scan to connect WhatsApp</h1>
            <p>Open WhatsApp on your phone, go to linked devices, and scan the QR code.</p>
            <div class="meta" id="meta"></div>
          </div>
          <div class="qr" id="qr">Preparing QR...</div>
        </div>
      </div>
    </div>
    <script>
      const sessionName = ${JSON.stringify(sessionName)};
      async function refresh() {
        const response = await fetch('/api/session/qr?sessionName=' + encodeURIComponent(sessionName), { cache: 'no-store' });
        const data = await response.json();
        const qr = document.getElementById('qr');
        const status = document.getElementById('status');
        const meta = document.getElementById('meta');
        status.textContent = data.status || 'unknown';
        if (data.status === 'ready') {
          status.style.background = '#dcfce7';
          status.style.color = '#166534';
          qr.innerHTML = '<div>Connected successfully.</div>';
        } else if (data.qrDataUrl) {
          qr.innerHTML = '<img alt="WhatsApp QR" src="' + data.qrDataUrl + '" />';
        } else {
          qr.innerHTML = '<div>Waiting for QR...</div>';
        }
        meta.textContent = data.connectedNumber
          ? 'Connected number: ' + data.connectedNumber
          : (data.lastError || 'Session: ' + sessionName);
      }
      refresh();
      setInterval(refresh, 3000);
    </script>
  </body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`WhatsApp bridge listening on ${BASE_URL}`);
});
