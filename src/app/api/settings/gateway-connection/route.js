import { ObjectId } from "mongodb";
import { requireAuth } from "../../../../lib/auth";
import {
  getMonnifyAccessToken,
  getMonnifyBaseUrl,
} from "../../../../lib/monnify";
import { connectDB } from "../../../../lib/mongodb";
import {
  buildPayazaHeaders,
  PAYAZA_DEFAULT_BASE_URL,
} from "../../../../lib/payaza";
import {
  resolveMonnifyConfig,
  resolvePayazaConfig,
  sanitizeSettingsInput,
} from "../../../../lib/paymentGatewaySettings";

const SUPPORTED_GATEWAYS = ["monnify", "payaza", "touchpay"];

function getGatewayName(gateway) {
  return {
    monnify: "Monnify",
    payaza: "PayAza",
    touchpay: "TouchPay",
  }[gateway] || "Payment gateway";
}

async function verifyMonnify(user = {}) {
  const config = resolveMonnifyConfig(user);

  if (!config.apiKey || !config.secretKey || !config.contractCode) {
    throw new Error("Monnify API key, secret key, and contract code are required.");
  }

  const baseUrl = getMonnifyBaseUrl(config.apiKey, config.environment);
  await getMonnifyAccessToken({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    baseUrl,
    environment: config.environment,
  });

  return {
    environment: config.environment,
    message: "Monnify accepted the API key and secret key.",
  };
}

function isPayazaAuthorizationError(data = {}, responseStatus = 0) {
  const message = String(data?.message || data?.error || "").toLowerCase();
  return responseStatus === 401 || responseStatus === 403 || message.includes("authorization");
}

async function verifyPayaza(user = {}) {
  const config = resolvePayazaConfig(user);

  if (!config.publicKey || !config.secretKey) {
    throw new Error("PayAza public key and secret key are required.");
  }

  const response = await fetch(
    `${PAYAZA_DEFAULT_BASE_URL}/merchant-collection/transfer_notification_controller/transaction-query?transaction_reference=invoicehub_connection_test`,
    {
      headers: buildPayazaHeaders(config.publicKey, config.environment),
      cache: "no-store",
    }
  );
  const data = await response.json().catch(() => ({}));

  if (isPayazaAuthorizationError(data, response.status)) {
    throw new Error(data?.message || "PayAza rejected these credentials.");
  }

  return {
    environment: config.environment,
    message: "PayAza accepted the public key for API requests.",
  };
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json().catch(() => ({}));
    const gateway = String(body.gateway || "").trim().toLowerCase();

    if (!SUPPORTED_GATEWAYS.includes(gateway)) {
      return Response.json({ error: "Unsupported payment gateway" }, { status: 400 });
    }

    if (gateway === "touchpay") {
      return Response.json(
        {
          success: false,
          gateway,
          message: "TouchPay connection verification is not available yet.",
        },
        { status: 501 }
      );
    }

    const existingUser = await db.collection("users").findOne({
      _id: new ObjectId(userId),
    });

    if (!existingUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const candidateUser = {
      ...existingUser,
      ...sanitizeSettingsInput(body.settings || {}, existingUser),
    };
    const result =
      gateway === "payaza"
        ? await verifyPayaza(candidateUser)
        : await verifyMonnify(candidateUser);

    return Response.json({
      success: true,
      gateway,
      provider: getGatewayName(gateway),
      ...result,
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      {
        error: error.message || "Unable to verify gateway connection",
        code: error.code || "GATEWAY_CONNECTION_ERROR",
        details: error.details || undefined,
      },
      { status }
    );
  }
}

