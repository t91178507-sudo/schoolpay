import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createRequire } from "module";
import { ObjectId } from "mongodb";
import { parseAmount } from "./monnify";
import { markInvoicePaid } from "./paymentLifecycle";
import { findUserById } from "./paymentGatewaySettings";
import { deliverPaymentConfirmation } from "./whatsappNotifications";

const require = createRequire(import.meta.url);
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["application/pdf", "pdf"],
]);
const NIGERIAN_BANKS = [
  { name: "Access Bank", aliases: ["access bank", "access"] },
  { name: "Alpha Morgan Bank", aliases: ["alpha morgan bank", "alpha morgan"] },
  { name: "Alternative Bank", aliases: ["alternative bank", "the alternative bank"] },
  { name: "Citibank Nigeria", aliases: ["citibank", "citi bank", "citibank nigeria"] },
  { name: "Coronation Merchant Bank", aliases: ["coronation merchant bank", "coronation bank"] },
  { name: "Ecobank Nigeria", aliases: ["ecobank", "eco bank", "ecobank nigeria"] },
  { name: "FBNQuest Merchant Bank", aliases: ["fbnquest", "fbn quest", "fbnquest merchant"] },
  { name: "Fidelity Bank", aliases: ["fidelity bank", "fidelity"] },
  { name: "First Bank of Nigeria", aliases: ["first bank", "firstbank", "fbn", "first bank of nigeria"] },
  { name: "FCMB", aliases: ["fcmb", "first city monument bank"] },
  { name: "FSDH Merchant Bank", aliases: ["fsdh", "fsdh merchant bank"] },
  { name: "Globus Bank", aliases: ["globus bank", "globus"] },
  { name: "GTBank", aliases: ["gtbank", "gt bank", "gtb", "guaranty trust bank", "gtworld", "gtco"] },
  { name: "Greenwich Merchant Bank", aliases: ["greenwich merchant bank", "greenwich bank"] },
  { name: "Jaiz Bank", aliases: ["jaiz bank", "jaiz"] },
  { name: "Keystone Bank", aliases: ["keystone bank", "keystone"] },
  { name: "Lotus Bank", aliases: ["lotus bank", "lotus"] },
  { name: "Nova Bank", aliases: ["nova bank", "nova commercial bank", "nova merchant bank"] },
  { name: "Optimus Bank", aliases: ["optimus bank", "optimus"] },
  { name: "Parallex Bank", aliases: ["parallex bank", "parallex"] },
  { name: "Polaris Bank", aliases: ["polaris bank", "polaris"] },
  { name: "Premium Trust Bank", aliases: ["premium trust bank", "premiumtrust"] },
  { name: "Providus Bank", aliases: ["providus bank", "providus"] },
  { name: "Rand Merchant Bank", aliases: ["rand merchant bank", "rmb nigeria", "rmb"] },
  { name: "Signature Bank", aliases: ["signature bank"] },
  { name: "Stanbic IBTC Bank", aliases: ["stanbic", "stanbic ibtc", "stanbic ibtc bank"] },
  { name: "Standard Chartered Bank", aliases: ["standard chartered", "standard chartered bank", "scb nigeria"] },
  { name: "Sterling Bank", aliases: ["sterling bank", "sterling"] },
  { name: "Summit Bank", aliases: ["summit bank"] },
  { name: "SunTrust Bank", aliases: ["suntrust bank", "suntrust"] },
  { name: "TAJBank", aliases: ["taj bank", "tajbank"] },
  { name: "Tatum Bank", aliases: ["tatum bank"] },
  { name: "Titan Trust Bank", aliases: ["titan trust bank", "titan bank", "titan trust"] },
  { name: "UBA", aliases: ["uba", "united bank for africa"] },
  { name: "Union Bank", aliases: ["union bank", "union bank of nigeria"] },
  { name: "Unity Bank", aliases: ["unity bank", "unity"] },
  { name: "Wema Bank", aliases: ["wema bank", "wema", "alat"] },
  { name: "Zenith Bank", aliases: ["zenith bank", "zenith"] },
  { name: "Opay", aliases: ["opay", "o pay", "paycom", "paycom/opay"] },
  { name: "PalmPay", aliases: ["palmpay", "palm pay"] },
  { name: "Kuda Bank", aliases: ["kuda", "kuda bank"] },
  { name: "Moniepoint", aliases: ["moniepoint", "monie point"] },
  { name: "Paga", aliases: ["paga"] },
  { name: "VFD Microfinance Bank", aliases: ["vfd", "vfd mfb", "vfd microfinance"] },
  { name: "FairMoney", aliases: ["fairmoney", "fair money"] },
  { name: "Sparkle Bank", aliases: ["sparkle", "sparkle bank"] },
  { name: "Rubies Bank", aliases: ["rubies", "rubies bank"] },
];

function getReceiptEncryptionKey() {
  return createHash("sha256")
    .update(
      process.env.RECEIPT_UPLOAD_ENCRYPTION_KEY ||
        process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY ||
        process.env.APP_SECRET ||
        process.env.JWT_SECRET ||
        "invoicehub-receipt-local-secret-change-me"
    )
    .digest();
}

export function encryptReceiptBuffer(buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getReceiptEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    algorithm: "aes-256-gcm",
  };
}

export function decryptReceiptBuffer(receipt) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getReceiptEncryptionKey(),
    Buffer.from(receipt.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(receipt.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(receipt.encryptedData, "base64")),
    decipher.final(),
  ]);
}

export function validateReceiptFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Upload a receipt file.");
  }

  if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
    throw new Error("Receipt must be JPG, PNG, or PDF.");
  }

  if (Number(file.size || 0) > MAX_RECEIPT_SIZE) {
    throw new Error("Receipt file must be 10 MB or less.");
  }
}

function extractAmount(text, expectedAmount = 0) {
  const normalized = normalizeReceiptText(text);
  const labelPattern =
    /(?:amount(?:\s+(?:paid|sent|transferred|received))?|total(?:\s+amount)?|payment|paid|credit|debit|ngn|naira|₦|n)\s*(?:is|of)?\s*[:=\-]?\s*(?:ngn|naira|₦|n)?\s*([0-9oil]{1,3}(?:[,\s][0-9oil]{3})+(?:\.\d{1,2})?|[0-9oil]+(?:\.\d{1,2})?)/gi;
  const candidates = [];
  let match = labelPattern.exec(normalized);

  while (match) {
    candidates.push(cleanOcrAmount(match[1]));
    match = labelPattern.exec(normalized);
  }

  if (!candidates.length) {
    const currencyPattern =
      /(?:₦|ngn|naira|n)\s*([0-9oil]{1,3}(?:[,\s][0-9oil]{3})+(?:\.\d{1,2})?|[0-9oil]+(?:\.\d{1,2})?)/gi;
    match = currencyPattern.exec(normalized);

    while (match) {
      candidates.push(cleanOcrAmount(match[1]));
      match = currencyPattern.exec(normalized);
    }
  }

  if (!candidates.length) {
    const numberPattern = /\b([0-9oil]{1,3}(?:[,\s][0-9oil]{3})+(?:\.\d{1,2})?)\b/gi;
    match = numberPattern.exec(normalized);

    while (match) {
      candidates.push(cleanOcrAmount(match[1]));
      match = numberPattern.exec(normalized);
    }
  }

  const amounts = candidates
    .map((candidate) => parseAmount(candidate))
    .filter((candidate) => candidate > 0)
    .filter((candidate, index, values) => values.indexOf(candidate) === index);

  if (!amounts.length) {
    return 0;
  }

  if (expectedAmount > 0) {
    const exactMatch = amounts.find(
      (candidate) => Math.abs(candidate - expectedAmount) < 0.05
    );

    if (exactMatch) {
      return exactMatch;
    }

    const closeMatch = amounts
      .map((candidate) => ({
        candidate,
        difference: Math.abs(candidate - expectedAmount),
      }))
      .sort((a, b) => a.difference - b.difference)[0];

    if (closeMatch?.difference <= expectedAmount * 0.1) {
      return closeMatch.candidate;
    }
  }

  return amounts.sort((a, b) => b - a)[0] || 0;
}

function extractReference(text) {
  const normalized = normalizeReceiptText(text);

  return (
    normalized.match(
      /\b(?:session\s*id|sessionid|transaction\s*id|transactionid|trans\s*id|reference|ref)\s*[:#\-]?\s*([A-Za-z0-9-]{6,})/i
    )?.[1] ||
    normalized.match(/\b(\d{20,})\b/)?.[1] ||
    ""
  );
}

function extractDateTime(text) {
  const normalized = normalizeReceiptText(text);
  const datePattern =
    /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{1,2}-[A-Za-z]{3,9}-\d{4})\b/i;
  const dateMatch = normalized.match(datePattern);
  const timePattern = /\b([01]?\d|2[0-3])[:.h ]([0-5]\d)(?:\s*(am|pm))?\b/i;
  const dateIndex = dateMatch?.index ?? -1;
  const nearDate =
    dateIndex >= 0
      ? normalized.slice(dateIndex, Math.min(normalized.length, dateIndex + 80))
      : normalized;
  const timeMatch = nearDate.match(timePattern) || normalized.match(timePattern);
  const timezoneMatch =
    nearDate.match(/\b(?:gmt|utc)\s*([+-]?\s*\d{1,2}[:. ]?\d{2})\b/i) ||
    normalized.match(/\b(?:gmt|utc)\s*([+-]?\s*\d{1,2}[:. ]?\d{2})\b/i);

  return {
    date: dateMatch?.[1]?.replace(/\s+/g, " ").trim() || "",
    time: timeMatch ? normalizeReceiptTime(timeMatch) : "",
    timezone: timezoneMatch ? normalizeTimezone(timezoneMatch[1]) : "",
  };
}

function extractBank(text) {
  const normalized = normalizeReceiptText(text);
  const labelledBank =
    normalized.match(
      /\b(?:receiver|beneficiary|destination|recipient|sender|source)?\s*bank\s*[:\-]?\s*([A-Za-z][A-Za-z0-9 .&'-]{1,80})/i
    )?.[1] || "";
  const labelledMatch = findNigerianBank(labelledBank);

  if (labelledMatch) {
    return labelledMatch;
  }

  return findNigerianBank(normalized);
}

function extractSenderName(text) {
  const normalized = normalizeReceiptText(text);
  const match = normalized.match(
    /(?:sender|sender name|from|paid by|account name|transfer from)\s*[:\-]?\s*([A-Z][A-Z .'-]{2,80})(?=\s+(?:amount|account|bank|ref|reference|date|time|to|beneficiary|narration|remark|$))/i
  );

  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function extractRecipientName(text) {
  const lines = normalizeReceiptText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const labels = [
    "beneficiary",
    "beneficiary name",
    "receiver",
    "receiver name",
    "recipient",
    "recipient name",
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    const label = labels.find((candidate) => line === candidate);

    if (label) {
      return lines[index + 1]?.replace(/\s+/g, " ").trim() || "";
    }

    const sameLineMatch = lines[index].match(
      /^(?:beneficiary|receiver|recipient)(?:\s+name)?\s*[:\-]\s*(.+)$/i
    );

    if (sameLineMatch?.[1]) {
      return sameLineMatch[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function normalizeReceiptText(text) {
  return String(text || "")
    .replace(/\0/g, ":")
    .replace(/\r/g, "\n")
    .replace(/[₦]/g, " ₦ ")
    .replace(/\b(GMT|UTC):(\d{1,2}):(\d{2})\b/gi, "$1+$2:$3")
    .replace(/(?<=\d)[oO](?=\d)/g, "0")
    .replace(/(?<=\d)[Il](?=\d)/g, "1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeReceiptTime(match) {
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = String(match[3] || "").toLowerCase();

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }

  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function normalizeTimezone(value) {
  const compact = String(value || "").replace(/\s+/g, "").replace(".", ":");

  if (!compact) {
    return "";
  }

  if (/^[+-]/.test(compact)) {
    return `GMT${compact.includes(":") ? compact : `${compact.slice(0, -2)}:${compact.slice(-2)}`}`;
  }

  return `GMT+${compact.includes(":") ? compact : `${compact.slice(0, -2)}:${compact.slice(-2)}`}`;
}

function findNigerianBank(text) {
  const normalized = String(text || "").toLowerCase();

  for (const bank of NIGERIAN_BANKS) {
    if (
      bank.aliases.some((alias) =>
        new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, "i").test(
          normalized
        )
      )
    ) {
      return bank.name;
    }
  }

  return "";
}

export function normalizeBankName(value) {
  const matchedBank = findNigerianBank(value);

  if (matchedBank) {
    return matchedBank;
  }

  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function receiptBankMatchesConfigured(receiptBank, configuredBank) {
  const expected = normalizeBankName(configuredBank);
  const detected = normalizeBankName(receiptBank);

  return Boolean(expected && detected && expected === detected);
}

export function normalizeAccountName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function receiptNameMatchesConfigured(receiptText, configuredName) {
  const expectedTokens = normalizeAccountName(configuredName)
    .split(" ")
    .filter((token) => token.length > 1);
  const receiptTokens = new Set(normalizeAccountName(receiptText).split(" "));

  return Boolean(
    expectedTokens.length &&
      expectedTokens.every((token) => receiptTokens.has(token))
  );
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanOcrAmount(value) {
  return String(value || "")
    .replace(/[oO]/g, "0")
    .replace(/[Il]/g, "1")
    .replace(/\s+/g, "")
    .trim();
}

async function readPdfText(buffer) {
  try {
    await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return String(result?.text || "");
  } catch {
    return "";
  }
}

async function readImageTextWithOcr(buffer) {
  let worker;

  try {
    const { createWorker } = await import("tesseract.js");
    const englishData = require("@tesseract.js-data/eng");

    worker = await createWorker("eng", undefined, {
      langPath: englishData.langPath,
      gzip: englishData.gzip,
      cacheMethod: "readOnly",
      logger: () => {},
    });
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_char_blacklist: "|",
    });

    const result = await worker.recognize(buffer);
    return normalizeReceiptText(result?.data?.text || "");
  } catch (error) {
    console.error("RECEIPT OCR ERROR:", error);
    return "";
  } finally {
    await worker?.terminate?.();
  }
}

export async function analyzeReceiptFile(buffer, mimeType, invoice = {}) {
  let text = "";
  let ocrText = "";
  const invoiceAmount = parseAmount(invoice.balanceDue || invoice.amount || 0);

  if (mimeType === "application/pdf") {
    text = await readPdfText(buffer);
  } else if (mimeType?.startsWith("image/")) {
    ocrText = await readImageTextWithOcr(buffer);
  }

  const combinedText = normalizeReceiptText(`${text}\n${ocrText}`);
  const amount = extractAmount(combinedText, invoiceAmount);
  const transactionReference = extractReference(combinedText);
  const transactionDateTime = extractDateTime(combinedText);
  const transactionDate = transactionDateTime.date;
  const bankName = extractBank(combinedText);
  const senderName = extractSenderName(combinedText);
  const recipientName = extractRecipientName(combinedText);

  const checks = [
    {
      label: "Amount matches",
      ok: amount > 0 && Math.abs(amount - invoiceAmount) < 0.05,
      warning: amount <= 0,
    },
    {
      label: "Date is valid",
      ok: Boolean(transactionDate),
      warning: !transactionDate,
    },
    {
      label: "Bank identified",
      ok: Boolean(bankName),
      warning: !bankName,
    },
    {
      label: "Transaction reference detected",
      ok: Boolean(transactionReference),
      warning: !transactionReference,
    },
  ];

  const confidence = Math.round(
    (checks.filter((check) => check.ok).length / checks.length) * 100
  );

  return {
    textSnippet: combinedText.slice(0, 1000),
    amount,
    bankName,
    transactionReference,
    transactionDate,
    transactionTime: transactionDateTime.time,
    transactionTimezone: transactionDateTime.timezone,
    transactionDateTime:
      transactionDateTime.date && transactionDateTime.time
        ? `${transactionDateTime.date} ${transactionDateTime.time}${
            transactionDateTime.timezone ? ` ${transactionDateTime.timezone}` : ""
          }`
        : transactionDateTime.date,
    senderName,
    recipientName,
    ocrApplied: Boolean(ocrText),
    confidence,
    checks,
  };
}

export async function logReceiptAudit(db, entry) {
  await db.collection("receiptAuditTrail").insertOne({
    ...entry,
    createdAt: new Date(),
  });
}

export async function approveReceiptUpload(db, receipt, { userId, ipAddress }) {
  const invoice = await db.collection("invoices").findOne({
    _id: new ObjectId(receipt.invoiceId),
    ownerId: receipt.ownerId,
  });

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  const paidInvoice = await markInvoicePaid(db, invoice, {
    paymentReference:
      receipt.transactionReference ||
      receipt.extracted?.transactionReference ||
      `receipt-${receipt._id}`,
    paidAmount: receipt.extracted?.amount || invoice.balanceDue || invoice.amount,
    paidAt: receipt.paymentDate || receipt.extracted?.transactionDate || new Date(),
    paymentProvider: "Receipt Upload",
    verificationMethod: "receipt_upload",
    notificationStatus: invoice.phone ? "prepared" : "unavailable",
  });

  await db.collection("receiptUploads").updateOne(
    { _id: receipt._id },
    {
      $set: {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: userId,
        updatedAt: new Date(),
      },
    }
  );

  try {
    const owner = receipt.ownerId ? await findUserById(db, receipt.ownerId) : null;
    await deliverPaymentConfirmation({
      db,
      invoice: paidInvoice,
      owner,
      amount: receipt.extracted?.amount || paidInvoice.paidAmount || paidInvoice.amount,
    });
  } catch (error) {
    console.error("RECEIPT APPROVAL WHATSAPP ERROR:", error);
  }

  await logReceiptAudit(db, {
    ownerId: receipt.ownerId,
    receiptId: receipt._id,
    invoiceId: receipt.invoiceId,
    userId,
    ipAddress,
    action: "Receipt Approved",
  });
  await logReceiptAudit(db, {
    ownerId: receipt.ownerId,
    receiptId: receipt._id,
    invoiceId: receipt.invoiceId,
    userId,
    ipAddress,
    action: "Invoice Updated",
  });

  return paidInvoice;
}

export async function rejectReceiptUpload(
  db,
  receipt,
  { userId, ipAddress, reason }
) {
  const rejectionReason = reason || "Receipt rejected";
  await db.collection("receiptUploads").deleteOne({ _id: receipt._id });

  await db.collection("invoices").updateOne(
    { _id: new ObjectId(receipt.invoiceId), ownerId: receipt.ownerId },
    {
      $set: {
        status: "Unpaid",
        paymentStatus: "unpaid",
        receiptValidationStatus: "rejected",
        updatedAt: new Date(),
      },
      $unset: {
        receiptUploadId: "",
      },
    }
  );

  await logReceiptAudit(db, {
    ownerId: receipt.ownerId,
    receiptId: receipt._id,
    invoiceId: receipt.invoiceId,
    userId,
    ipAddress,
    action: "Receipt Rejected",
    reason: rejectionReason,
  });
}
