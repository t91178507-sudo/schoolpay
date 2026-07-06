import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";
import { getPlatformWhatsAppBridgeSettings } from "../../../../lib/paymentGatewaySettings";

function parseMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getOutstandingAmount(invoice) {
  const balanceDue = parseMoney(invoice.balanceDue);
  if (balanceDue > 0) return balanceDue;

  const total = parseMoney(invoice.amount);
  const paid = parseMoney(invoice.paidAmount);
  return Math.max(total - paid, 0);
}

async function checkBridgeHealth(platformBridge = {}) {
  if (!platformBridge.enabled || !platformBridge.bridgeBaseUrl) {
    return {
      configured: false,
      online: false,
      status: "Not configured",
      url: platformBridge.bridgeBaseUrl || "",
      error: "",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${platformBridge.bridgeBaseUrl}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    const online = response.ok && data.ok === true;

    return {
      configured: true,
      online,
      status: online ? "Online" : "Offline",
      url: platformBridge.bridgeBaseUrl,
      sessions: Number(data.totalSessions || 0),
      error: online ? "" : data.error || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      online: false,
      status: "Offline",
      url: platformBridge.bridgeBaseUrl,
      sessions: 0,
      error: error.name === "AbortError" ? "Health check timed out" : error.message || "Health check failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const [users, totalCustomers, totalInvoices, allInvoices, platformBridge] =
      await Promise.all([
        db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
        db.collection("customers").countDocuments(),
        db.collection("invoices").countDocuments(),
        db.collection("invoices").find({}).toArray(),
        getPlatformWhatsAppBridgeSettings(db),
      ]);

    const totalRevenue = allInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.amount),
      0
    );
    const paidInvoices = allInvoices.filter((invoice) => invoice.status === "Paid");
    const partialInvoices = allInvoices.filter(
      (invoice) => invoice.status === "Partially Paid"
    );
    const paidRevenue = paidInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.paidAmount || invoice.amount),
      0
    );
    const partialRevenue = partialInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.paidAmount),
      0
    );
    const outstandingRevenue = allInvoices.reduce(
      (sum, invoice) => sum + getOutstandingAmount(invoice),
      0
    );
    const preparedNotificationCount = allInvoices.filter((invoice) => {
      const status = String(invoice.customerNotificationStatus || "").toLowerCase();
      return status === "prepared" || status === "pending-whatsapp";
    }).length;
    const unavailableNotificationCount = allInvoices.filter(
      (invoice) =>
        String(invoice.customerNotificationStatus || "").toLowerCase() === "unavailable"
    ).length;
    const whatsappWebBusinesses = platformBridge.enabled
      ? users.length
      : users.filter(
          (user) =>
            user.defaultWhatsAppProvider === "whatsappWeb" &&
            user.whatsappProviders?.whatsappWeb?.enabled === true
        ).length;
    const monnifyConfiguredBusinesses = users.filter((user) => {
      const gateway = user.paymentGateways?.monnify || {};
      return Boolean(gateway.enabled && gateway.apiKey && gateway.secretKey && gateway.contractCode);
    }).length;
    const whatsappBridgeHealth = await checkBridgeHealth(platformBridge);

    return Response.json({
      totalBusinesses: users.length,
      totalCustomers,
      totalInvoices,
      totalRevenue,
      paidRevenue,
      partialRevenue,
      collectedRevenue: paidRevenue + partialRevenue,
      outstandingRevenue,
      paidCount: paidInvoices.length,
      partialCount: partialInvoices.length,
      unpaidCount: allInvoices.filter(
        (invoice) => invoice.status !== "Paid" && invoice.status !== "Partially Paid"
      ).length,
      preparedNotificationCount,
      unavailableNotificationCount,
      whatsappWebBusinesses,
      monnifyConfiguredBusinesses,
      whatsappBridgeHealth,
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
