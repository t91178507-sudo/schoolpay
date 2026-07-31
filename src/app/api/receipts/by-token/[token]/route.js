import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { after } from "next/server";
import { connectDB } from "../../../../../lib/mongodb";
import { decryptSettingsSecret } from "../../../../../lib/paymentGatewaySettings";
import {
  analyzeReceiptFile,
  encryptReceiptBuffer,
  logReceiptAudit,
  validateReceiptFile,
} from "../../../../../lib/receiptUploads";

export const maxDuration = 60;

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

async function findDuplicateReceipt(
  db,
  { ownerId, fileHash, transactionReference, excludeReceiptId }
) {
  const duplicateQueries = [];

  if (fileHash) {
    duplicateQueries.push({ ownerId, fileHash });
  }

  if (transactionReference) {
    duplicateQueries.push({ ownerId, transactionReference });
  }

  if (!duplicateQueries.length) {
    return null;
  }

  const query = { $or: duplicateQueries };

  if (excludeReceiptId) {
    query._id = { $ne: excludeReceiptId };
  }

  return db.collection("receiptUploads").findOne(query);
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

async function processReceiptAnalysis({
  receiptId,
  buffer,
  mimeType,
  invoice,
  submittedFields,
}) {
  const db = await connectDB();

  try {
    const platformSettings =
      (await db.collection("platformSettings").findOne({ _id: "platform" })) || {};
    const storedOpenAiVision = platformSettings.openAiVision || {};
    const extracted = await analyzeReceiptFile(buffer, mimeType, invoice, {
      openAiVision: {
        enabled: storedOpenAiVision.enabled === true,
        model: storedOpenAiVision.model || "gpt-4o-mini",
        apiKey:
          decryptSettingsSecret(storedOpenAiVision.apiKey) ||
          process.env.OPENAI_API_KEY ||
          "",
      },
    });
    const transactionReference =
      submittedFields.transactionReference || extracted.transactionReference || "";
    const paymentDate =
      submittedFields.paymentDate || extracted.transactionDate || "";
    const senderName = submittedFields.senderName || extracted.senderName || "";
    const duplicate = transactionReference
      ? await findDuplicateReceipt(db, {
          ownerId: invoice.ownerId,
          transactionReference,
          excludeReceiptId: receiptId,
        })
      : null;
    const now = new Date();

    if (duplicate) {
      const rejectionReason =
        "This transaction ID has already been used for another receipt.";

      await db.collection("receiptUploads").updateOne(
        { _id: receiptId, analysisStatus: "processing" },
        {
          $set: {
            amount: Number(extracted.amount || 0),
            transactionReference,
            paymentDate,
            paymentTime: extracted.transactionTime || "",
            senderName,
            recipientName: extracted.recipientName || "",
            extracted,
            analysisStatus: "duplicate",
            analysisCompletedAt: now,
            analysisError: rejectionReason,
            status: "rejected",
            rejectionReason,
            rejectedAt: now,
            rejectedBy: "automated-duplicate-check",
            updatedAt: now,
          },
        }
      );

      await db.collection("invoices").updateOne(
        { _id: invoice._id, receiptUploadId: receiptId },
        {
          $set: {
            status: submittedFields.invoiceStatusBeforeReceipt || "Unpaid",
            paymentStatus:
              submittedFields.invoicePaymentStatusBeforeReceipt || "unpaid",
            receiptValidationStatus: "rejected",
            receiptUploadId: "",
            updatedAt: now,
          },
        }
      );

      await logReceiptAudit(db, {
        ownerId: invoice.ownerId,
        receiptId,
        invoiceId: String(invoice._id),
        userId: "system",
        ipAddress: "",
        action: "Receipt Duplicate Detected",
      });
      return;
    }

    await db.collection("receiptUploads").updateOne(
      { _id: receiptId, analysisStatus: "processing" },
      {
        $set: {
          amount: Number(extracted.amount || 0),
          transactionReference,
          paymentDate,
          paymentTime: extracted.transactionTime || "",
          senderName,
          recipientName: extracted.recipientName || "",
          extracted,
          analysisStatus: "completed",
          analysisCompletedAt: now,
          analysisError: "",
          updatedAt: now,
        },
      }
    );

    await logReceiptAudit(db, {
      ownerId: invoice.ownerId,
      receiptId,
      invoiceId: String(invoice._id),
      userId: "system",
      ipAddress: "",
      action: "Receipt Analysis Completed",
    });
  } catch (error) {
    console.error("RECEIPT BACKGROUND OCR ERROR:", error);
    const now = new Date();

    await db.collection("receiptUploads").updateOne(
      { _id: receiptId, analysisStatus: "processing" },
      {
        $set: {
          analysisStatus: "failed",
          analysisCompletedAt: now,
          analysisError:
            "Automated reading could not be completed. Review the receipt manually.",
          updatedAt: now,
        },
      }
    );

    await logReceiptAudit(db, {
      ownerId: invoice.ownerId,
      receiptId,
      invoiceId: String(invoice._id),
      userId: "system",
      ipAddress: "",
      action: "Receipt Analysis Failed",
    });
  }
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashReceiptBuffer(buffer);
    const encrypted = encryptReceiptBuffer(buffer);
    const duplicate = await findDuplicateReceipt(db, {
      ownerId: invoice.ownerId,
      fileHash,
    });

    if (duplicate) {
      return Response.json(
        { error: "This receipt file has already been uploaded." },
        { status: 409 }
      );
    }

    const now = new Date();
    const submittedFields = {
      transactionReference: String(
        formData.get("transactionReference") || ""
      ).trim(),
      paymentDate: String(formData.get("paymentDate") || "").trim(),
      senderName: String(formData.get("senderName") || "").trim(),
      invoiceStatusBeforeReceipt: invoice.status || "Unpaid",
      invoicePaymentStatusBeforeReceipt: invoice.paymentStatus || "unpaid",
    };
    const receipt = {
      ownerId: invoice.ownerId,
      businessId: String(invoice.businessId || ""),
      invoiceId: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber || "",
      customerName:
        invoice.customer || invoice.customerName || invoice.student || "",
      amount: 0,
      fileName: file.name || "receipt",
      fileType: file.type,
      fileSize: file.size || buffer.length,
      fileHash,
      ...encrypted,
      transactionReference: submittedFields.transactionReference,
      paymentDate: submittedFields.paymentDate,
      paymentTime: "",
      senderName: submittedFields.senderName,
      recipientName: "",
      phoneNumber: String(formData.get("phoneNumber") || "").trim(),
      extracted: {
        amount: 0,
        bankName: "",
        transactionReference: "",
        transactionDate: "",
        transactionTime: "",
        senderName: "",
        recipientName: "",
        confidence: 0,
        checks: [],
      },
      analysisStatus: "processing",
      analysisStartedAt: now,
      analysisCompletedAt: null,
      analysisError: "",
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

    after(() =>
      processReceiptAnalysis({
        receiptId: insert.insertedId,
        buffer,
        mimeType: file.type,
        invoice,
        submittedFields,
      })
    );

    return Response.json(
      {
        success: true,
        receiptId: String(insert.insertedId),
        analysisStatus: "processing",
        message: "Receipt uploaded. Payment details are being read.",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("RECEIPT UPLOAD ERROR:", error);

    return Response.json(
      {
        error: error.message || "Unable to upload receipt",
        code: error.code || "",
        verificationUrl: error.verificationUrl || "",
      },
      { status: error.status || 500 }
    );
  }
}
