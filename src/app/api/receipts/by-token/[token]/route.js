import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { connectDB } from "../../../../../lib/mongodb";
import {
  analyzeReceiptFile,
  encryptReceiptBuffer,
  logReceiptAudit,
  normalizeAccountName,
  receiptNameMatchesConfigured,
  validateReceiptFile,
} from "../../../../../lib/receiptUploads";

function getIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

function hashReceiptBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function findDuplicateReceipt(db, { ownerId, invoiceId, fileHash, transactionReference }) {
  const duplicateQueries = [];

  if (fileHash) {
    duplicateQueries.push({ ownerId, fileHash });
  }

  if (transactionReference) {
    duplicateQueries.push({
      ownerId,
      transactionReference,
    });
  }

  if (invoiceId) {
    duplicateQueries.push({
      invoiceId,
      status: "pending",
    });
  }

  if (!duplicateQueries.length) {
    return null;
  }

  return db.collection("receiptUploads").findOne({ $or: duplicateQueries });
}

async function tokenCanAccessInvoice(db, invoice, token) {
  if (!invoice || !token) {
    return false;
  }

  if (invoice.token === token || invoice.customerToken === token) {
    return true;
  }

  const baseInvoice = await db.collection("invoices").findOne({ token });

  if (
    baseInvoice &&
    String(baseInvoice.ownerId || "") === String(invoice.ownerId || "") &&
    baseInvoice.customerToken &&
    baseInvoice.customerToken === invoice.customerToken
  ) {
    return true;
  }

  const customer = await db.collection("customers").findOne({ token });

  return Boolean(
    customer &&
      String(customer.ownerId || "") === String(invoice.ownerId || "") &&
      customer.token &&
      customer.token === invoice.customerToken
  );
}

async function findReceiptInvoice(db, { invoiceId, token }) {
  if (invoiceId && ObjectId.isValid(invoiceId)) {
    const invoice = await db.collection("invoices").findOne({
      _id: new ObjectId(invoiceId),
    });

    if (invoice && (await tokenCanAccessInvoice(db, invoice, token))) {
      return invoice;
    }

    return null;
  }

  return db.collection("invoices").findOne({ token });
}

export async function POST(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();
    const formData = await req.formData();
    const invoiceId = String(formData.get("invoiceId") || "");
    const file = formData.get("receipt");

    validateReceiptFile(file);

    const invoice = await findReceiptInvoice(db, { invoiceId, token });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const owner = invoice.ownerId
      ? await db.collection("users").findOne({ _id: new ObjectId(invoice.ownerId) })
      : null;
    const receiptSettings = owner?.paymentGateways?.receiptUpload || {};

    if (!receiptSettings.enabled) {
      return Response.json(
        { error: "Receipt upload is not enabled for this invoice." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashReceiptBuffer(buffer);
    const encrypted = encryptReceiptBuffer(buffer);
    const extracted = await analyzeReceiptFile(buffer, file.type, invoice);
    const now = new Date();

    const transactionReference =
      String(formData.get("transactionReference") || "").trim() ||
      extracted.transactionReference ||
      "";
    const paymentDate =
      String(formData.get("paymentDate") || "").trim() ||
      extracted.transactionDate ||
      "";
    const paymentTime = extracted.transactionTime || "";
    const senderName =
      String(formData.get("senderName") || "").trim() ||
      extracted.senderName ||
      "";
    const recipientName = extracted.recipientName || "";
    const duplicate = await findDuplicateReceipt(db, {
      ownerId: invoice.ownerId,
      invoiceId: String(invoice._id),
      fileHash,
      transactionReference,
    });

    if (duplicate) {
      const duplicateReason =
        duplicate.fileHash === fileHash
          ? "This receipt file has already been uploaded."
          : duplicate.transactionReference === transactionReference
            ? "This transaction ID has already been used for another receipt."
            : "A receipt is already awaiting validation for this invoice.";

      return Response.json({ error: duplicateReason }, { status: 409 });
    }

    const configuredAccountName = String(receiptSettings.accountName || "").trim();
    const receiptNameCandidates = [
      recipientName,
      extracted.recipientName,
      extracted.textSnippet,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const nameRejected =
      configuredAccountName &&
      !receiptNameCandidates.some((value) =>
        receiptNameMatchesConfigured(value, configuredAccountName)
      );

    if (nameRejected) {
      const rejectionReason = `Account name mismatch. Expected ${
        normalizeAccountName(configuredAccountName) || configuredAccountName
      }.`;

      await logReceiptAudit(db, {
        ownerId: invoice.ownerId,
        receiptId: null,
        invoiceId: String(invoice._id),
        userId: "customer",
        ipAddress: getIp(req),
        action: "Receipt Upload Rejected",
        reason: rejectionReason,
        fileHash,
        transactionReference,
      });

      return Response.json(
        {
          error: rejectionReason,
          rejected: true,
          expectedAccountName:
            normalizeAccountName(configuredAccountName) || configuredAccountName,
        },
        { status: 422 }
      );
    }

    const receipt = {
      ownerId: invoice.ownerId,
      invoiceId: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber || "",
      customerName: invoice.customer || invoice.customerName || invoice.student || "",
      amount: Number(invoice.balanceDue || invoice.amount || 0),
      fileName: file.name || "receipt",
      fileType: file.type,
      fileSize: file.size || buffer.length,
      fileHash,
      ...encrypted,
      transactionReference,
      paymentDate,
      paymentTime,
      senderName,
      recipientName,
      phoneNumber: String(formData.get("phoneNumber") || "").trim(),
      extracted,
      status: "pending",
      rejectionReason: "",
      rejectedAt: null,
      rejectedBy: "",
      createdAt: now,
      updatedAt: now,
    };

    const insert = await db.collection("receiptUploads").insertOne(receipt);

    await db.collection("invoices").updateOne(
      { _id: invoice._id },
      {
        $set: {
          status: "Pending Receipt Validation",
          paymentStatus: "pending_receipt_validation",
          receiptValidationStatus: "pending",
          receiptUploadId: insert.insertedId,
          updatedAt: now,
        },
      }
    );

    await logReceiptAudit(db, {
      ownerId: invoice.ownerId,
      receiptId: insert.insertedId,
      invoiceId: String(invoice._id),
      userId: "customer",
      ipAddress: getIp(req),
      action: "Receipt Uploaded",
    });

    return Response.json({
      success: true,
      message: "Receipt received and awaiting validation.",
    });
  } catch (error) {
    console.error("RECEIPT UPLOAD ERROR:", error);

    return Response.json(
      { error: error.message || "Unable to upload receipt" },
      { status: error.status || 500 }
    );
  }
}
