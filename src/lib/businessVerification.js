import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const BUSINESS_STATUSES = Object.freeze({
  DRAFT: "draft",
  PENDING: "pending_verification",
  UNDER_REVIEW: "under_review",
  VERIFIED: "verified",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
});

export const BUSINESS_STATUS_LABELS = Object.freeze({
  [BUSINESS_STATUSES.DRAFT]: "Draft",
  [BUSINESS_STATUSES.PENDING]: "Pending Verification",
  [BUSINESS_STATUSES.UNDER_REVIEW]: "Under Review",
  [BUSINESS_STATUSES.VERIFIED]: "Verified Business",
  [BUSINESS_STATUSES.REJECTED]: "Rejected",
  [BUSINESS_STATUSES.SUSPENDED]: "Suspended",
});

export const VERIFICATION_REQUIRED_CODE = "BUSINESS_VERIFICATION_REQUIRED";
export const MAX_VERIFICATION_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_VERIFICATION_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export function normalizeBusinessStatus(business = {}) {
  const status = String(business.verificationStatus || business.status || "")
    .trim()
    .toLowerCase();

  if (Object.values(BUSINESS_STATUSES).includes(status)) {
    return status;
  }

  // Businesses created before verification existed remain operational.
  return business.createdAt ? BUSINESS_STATUSES.VERIFIED : BUSINESS_STATUSES.DRAFT;
}

export function isBusinessVerified(business = {}) {
  return normalizeBusinessStatus(business) === BUSINESS_STATUSES.VERIFIED;
}

export function buildVerificationRequiredError() {
  const error = new Error(
    "This feature is available after your business has been verified."
  );
  error.status = 403;
  error.code = VERIFICATION_REQUIRED_CODE;
  error.verificationUrl = "/dashboard/verification";
  return error;
}

export async function requireVerifiedOwnerBusiness(db, ownerId, businessId = "") {
  const query = { ownerId: String(ownerId || ""), active: { $ne: false } };
  if (businessId) {
    const { ObjectId } = await import("mongodb");
    if (ObjectId.isValid(String(businessId))) query._id = new ObjectId(String(businessId));
  } else {
    query.isPrimary = true;
  }
  let business = await db.collection("businesses").findOne(query);
  if (!business && !businessId) {
    business = await db.collection("businesses").findOne({ ownerId: String(ownerId || ""), active: { $ne: false } });
  }
  if (!business || !isBusinessVerified(business)) throw buildVerificationRequiredError();
  return business;
}

export function requireVerifiedBusiness(context = {}) {
  if (!context.primaryBusiness || !isBusinessVerified(context.primaryBusiness)) {
    throw buildVerificationRequiredError();
  }

  return context.primaryBusiness;
}

export function verificationErrorResponse(error) {
  return Response.json(
    {
      error: error.message || "Unable to complete this action.",
      code: error.code || "",
      verificationUrl: error.verificationUrl || "",
    },
    { status: error.status || 500 }
  );
}

function getEncryptionKey() {
  return createHash("sha256")
    .update(
      process.env.BUSINESS_VERIFICATION_ENCRYPTION_KEY ||
        process.env.RECEIPT_UPLOAD_ENCRYPTION_KEY ||
        process.env.APP_SECRET ||
        process.env.JWT_SECRET ||
        "invoicehub-verification-local-secret-change-me"
    )
    .digest();
}

export function encryptVerificationDocument(buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return {
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    algorithm: "aes-256-gcm",
  };
}

export function decryptVerificationDocument(document) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(document.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(document.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(document.encryptedData, "base64")),
    decipher.final(),
  ]);
}

export function validateVerificationFile(file, label = "Document") {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    return;
  }

  if (!ALLOWED_VERIFICATION_FILE_TYPES.has(file.type)) {
    const error = new Error(`${label} must be a PDF, JPG, or PNG file.`);
    error.status = 400;
    throw error;
  }

  if (file.size > MAX_VERIFICATION_FILE_SIZE) {
    const error = new Error(`${label} must be 10 MB or less.`);
    error.status = 400;
    throw error;
  }
}

export function serializeBusinessVerification(business = {}, documents = []) {
  const verificationStatus = normalizeBusinessStatus(business);

  return {
    ...business,
    _id: business._id?.toString?.() || String(business._id || ""),
    ownerId: business.ownerId?.toString?.() || String(business.ownerId || ""),
    verificationStatus,
    verificationStatusLabel:
      BUSINESS_STATUS_LABELS[verificationStatus] || "Pending Verification",
    isVerified: verificationStatus === BUSINESS_STATUSES.VERIFIED,
    documents: documents.map((document) => ({
      _id: document._id?.toString?.() || String(document._id || ""),
      documentType: document.documentType,
      fileName: document.fileName,
      contentType: document.contentType,
      size: document.size,
      uploadedAt: document.uploadedAt,
    })),
  };
}

