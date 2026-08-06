import { ObjectId } from "mongodb";

const PLATFORM_SETTINGS_ID = "platform";
const BUSINESS_UNITS_COLLECTION = "businessUnits";
const UNIT_TRANSACTIONS_COLLECTION = "unitTransactions";

export const DEFAULT_BILLING_SETTINGS = Object.freeze({
  enabled: true,
  defaultUnitsForNewBusinesses: 100,
  costPerUnit: 0,
  unitsPerWhatsAppMessage: 1,
  lowUnitThreshold: 20,
});

function normalizeId(value) {
  return String(value || "").trim();
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

export function normalizeBillingSettings(settings = {}) {
  const billing = settings.billing || settings || {};

  return {
    enabled: billing.enabled !== false,
    defaultUnitsForNewBusinesses: normalizeNumber(
      billing.defaultUnitsForNewBusinesses,
      DEFAULT_BILLING_SETTINGS.defaultUnitsForNewBusinesses
    ),
    costPerUnit: Number.isFinite(Number(billing.costPerUnit))
      ? Math.max(0, Number(billing.costPerUnit))
      : DEFAULT_BILLING_SETTINGS.costPerUnit,
    unitsPerWhatsAppMessage: Math.max(
      1,
      normalizeNumber(
        billing.unitsPerWhatsAppMessage,
        DEFAULT_BILLING_SETTINGS.unitsPerWhatsAppMessage
      )
    ),
    lowUnitThreshold: normalizeNumber(
      billing.lowUnitThreshold,
      DEFAULT_BILLING_SETTINGS.lowUnitThreshold
    ),
  };
}

export async function getBillingSettings(db) {
  const settings =
    (await db.collection("platformSettings").findOne({
      _id: PLATFORM_SETTINGS_ID,
    })) || {};

  return normalizeBillingSettings(settings.billing || {});
}

export async function saveBillingSettings(db, input = {}) {
  const billing = normalizeBillingSettings(input);
  const now = new Date();

  await db.collection("platformSettings").updateOne(
    { _id: PLATFORM_SETTINGS_ID },
    {
      $set: { billing, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return billing;
}

export async function ensureBusinessUnitWallet(
  db,
  { ownerId, businessId = "", businessName = "" } = {}
) {
  const normalizedOwnerId = normalizeId(ownerId);
  if (!normalizedOwnerId) return null;

  const normalizedBusinessId = normalizeId(businessId);
  const existing = await db.collection(BUSINESS_UNITS_COLLECTION).findOne({
    ownerId: normalizedOwnerId,
  });

  if (existing) {
    return existing;
  }

  const now = new Date();
  const wallet = {
    ownerId: normalizedOwnerId,
    businessId: normalizedBusinessId,
    businessName: String(businessName || "").trim(),
    currentUnits: 0,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(BUSINESS_UNITS_COLLECTION).insertOne(wallet);

  return { ...wallet, _id: result.insertedId };
}

export async function recordUnitTransaction(
  db,
  {
    ownerId,
    businessId = "",
    businessName = "",
    type,
    units,
    reason,
    relatedWhatsAppMessageId = "",
    createdBy = "system",
  } = {}
) {
  const normalizedOwnerId = normalizeId(ownerId);
  const normalizedUnits = normalizeNumber(units);

  if (!normalizedOwnerId || !normalizedUnits) {
    throw new Error("A business and unit amount are required.");
  }

  const transactionType = String(type || "").toLowerCase();
  if (!["credit", "debit"].includes(transactionType)) {
    throw new Error("Unit transaction type must be credit or debit.");
  }

  const wallet = await ensureBusinessUnitWallet(db, {
    ownerId: normalizedOwnerId,
    businessId,
    businessName,
  });
  const currentUnits = normalizeNumber(wallet?.currentUnits);
  const nextBalance =
    transactionType === "credit"
      ? currentUnits + normalizedUnits
      : Math.max(0, currentUnits - normalizedUnits);
  const now = new Date();

  await db.collection(BUSINESS_UNITS_COLLECTION).updateOne(
    { ownerId: normalizedOwnerId },
    {
      $set: {
        businessId: normalizeId(businessId) || wallet.businessId || "",
        businessName: String(businessName || wallet.businessName || "").trim(),
        currentUnits: nextBalance,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  const transaction = {
    ownerId: normalizedOwnerId,
    businessId: normalizeId(businessId) || wallet.businessId || "",
    businessName: String(businessName || wallet.businessName || "").trim(),
    type: transactionType,
    units: normalizedUnits,
    reason: String(reason || "").trim() || "Unit adjustment",
    relatedWhatsAppMessageId: normalizeId(relatedWhatsAppMessageId),
    balanceAfterTransaction: nextBalance,
    createdBy: String(createdBy || "system").trim(),
    createdAt: now,
  };

  await db.collection(UNIT_TRANSACTIONS_COLLECTION).insertOne(transaction);

  return {
    wallet: {
      ...wallet,
      currentUnits: nextBalance,
      updatedAt: now,
    },
    transaction,
  };
}

export async function creditDefaultUnitsForBusiness(
  db,
  business = {},
  createdBy = "InvoiceHub Admin"
) {
  const settings = await getBillingSettings(db);
  const units = normalizeNumber(settings.defaultUnitsForNewBusinesses);
  const ownerId = normalizeId(business.ownerId);

  if (!ownerId || !units) {
    return null;
  }

  const existingDefaultCredit = await db
    .collection(UNIT_TRANSACTIONS_COLLECTION)
    .findOne({
      ownerId,
      type: "credit",
      reason: "Default units for verified business",
    });

  if (existingDefaultCredit) {
    return null;
  }

  return recordUnitTransaction(db, {
    ownerId,
    businessId: normalizeId(business._id),
    businessName: business.name || "",
    type: "credit",
    units,
    reason: "Default units for verified business",
    createdBy,
  });
}

export async function getBusinessUnitSummary(db, { ownerId, businessId = "" } = {}) {
  const settings = await getBillingSettings(db);
  const wallet = await ensureBusinessUnitWallet(db, { ownerId, businessId });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const transactions = await db
    .collection(UNIT_TRANSACTIONS_COLLECTION)
    .find({ ownerId: normalizeId(ownerId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  const usedThisMonth = transactions
    .filter(
      (transaction) =>
        transaction.type === "debit" &&
        new Date(transaction.createdAt).getTime() >= monthStart.getTime()
    )
    .reduce((sum, transaction) => sum + normalizeNumber(transaction.units), 0);
  const currentUnits = normalizeNumber(wallet?.currentUnits);

  return {
    enabled: settings.enabled,
    currentUnits,
    usedThisMonth,
    lowUnitThreshold: settings.lowUnitThreshold,
    lowUnits: settings.enabled && currentUnits <= settings.lowUnitThreshold,
    zeroUnits: settings.enabled && currentUnits <= 0,
    unitsPerWhatsAppMessage: settings.unitsPerWhatsAppMessage,
    transactions,
  };
}

export async function ensureCanSendWhatsAppMessage(
  db,
  { ownerId, businessId = "" } = {}
) {
  const settings = await getBillingSettings(db);

  if (!settings.enabled) {
    return { allowed: true, requiredUnits: 0, currentUnits: 0 };
  }

  const wallet = await ensureBusinessUnitWallet(db, { ownerId, businessId });
  const currentUnits = normalizeNumber(wallet?.currentUnits);
  const requiredUnits = settings.unitsPerWhatsAppMessage;

  if (currentUnits < requiredUnits) {
    return {
      allowed: false,
      requiredUnits,
      currentUnits,
      reason: "Insufficient units. Please contact the administrator to top up your account.",
    };
  }

  return { allowed: true, requiredUnits, currentUnits };
}

export async function consumeUnitsForWhatsAppMessage(
  db,
  { ownerId, businessId = "", businessName = "", messageId = "", createdBy = "system" } = {}
) {
  const settings = await getBillingSettings(db);

  if (!settings.enabled) {
    return null;
  }

  if (messageId) {
    const existing = await db.collection(UNIT_TRANSACTIONS_COLLECTION).findOne({
      relatedWhatsAppMessageId: normalizeId(messageId),
      type: "debit",
    });

    if (existing) {
      return null;
    }
  }

  return recordUnitTransaction(db, {
    ownerId,
    businessId,
    businessName,
    type: "debit",
    units: settings.unitsPerWhatsAppMessage,
    reason: "WhatsApp Message",
    relatedWhatsAppMessageId: messageId,
    createdBy,
  });
}

export async function getAdminUnitReports(db) {
  const settings = await getBillingSettings(db);
  const [wallets, transactions] = await Promise.all([
    db.collection(BUSINESS_UNITS_COLLECTION).find({}).toArray(),
    db.collection(UNIT_TRANSACTIONS_COLLECTION).find({}).toArray(),
  ]);

  const totalUnitsSold = transactions
    .filter((transaction) => transaction.type === "credit")
    .reduce((sum, transaction) => sum + normalizeNumber(transaction.units), 0);
  const totalUnitsConsumed = transactions
    .filter((transaction) => transaction.type === "debit")
    .reduce((sum, transaction) => sum + normalizeNumber(transaction.units), 0);
  const lowUnitWallets = wallets.filter(
    (wallet) =>
      normalizeNumber(wallet.currentUnits) > 0 &&
      normalizeNumber(wallet.currentUnits) <= settings.lowUnitThreshold
  );
  const zeroUnitWallets = wallets.filter(
    (wallet) => normalizeNumber(wallet.currentUnits) <= 0
  );
  const consumptionByOwner = new Map();

  transactions
    .filter((transaction) => transaction.type === "debit")
    .forEach((transaction) => {
      const ownerId = normalizeId(transaction.ownerId);
      const current = consumptionByOwner.get(ownerId) || {
        ownerId,
        businessName: transaction.businessName || "",
        units: 0,
      };
      current.units += normalizeNumber(transaction.units);
      current.businessName = current.businessName || transaction.businessName || "";
      consumptionByOwner.set(ownerId, current);
    });

  return {
    settings,
    totalUnitsSold,
    totalUnitsConsumed,
    businessesWithLowUnits: lowUnitWallets.length,
    businessesWithZeroUnits: zeroUnitWallets.length,
    topBusinessesByUnitConsumption: [...consumptionByOwner.values()]
      .sort((a, b) => b.units - a.units)
      .slice(0, 5),
  };
}

export function toObjectId(id) {
  return ObjectId.isValid(String(id || "")) ? new ObjectId(String(id)) : null;
}
