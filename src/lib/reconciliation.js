import * as XLSX from "xlsx";
import { ObjectId } from "mongodb";
import { parseAmount } from "./monnify";
import { markInvoicePaid } from "./paymentLifecycle";
import { deliverPaymentConfirmation } from "./whatsappNotifications";

const MIN_AUTO_CONFIDENCE = 95;
const MIN_SUGGESTED_CONFIDENCE = 55;
const MIN_NAME_SUGGESTED_CONFIDENCE = 30;

const CREDIT_KEYWORDS = [
  "credit",
  "cr",
  "deposit",
  "paid in",
  "payment",
  "transfer from",
  "nip from",
  "nip",
  "from ",
  "trf for customer",
  "transfer for customer",
  "inward",
  "lodgement",
  "sundry entries",
  "nibss instant payment",
  "cash deposit",
  "fund transfer",
  "incoming",
  "receipt",
];

const DEBIT_KEYWORDS = [
  "debit",
  "dr",
  "withdrawal",
  "paid out",
  "charge",
  "charges",
  "vat",
  "commission",
  "stamp duty",
  "pos purchase",
  "airtime",
  "transfer to",
  "outward",
  "ussd collection",
  "ussd collections",
  "ussd",
];

const ALWAYS_IGNORE_KEYWORDS = [
  "ussd collection",
  "ussd collections",
  "ussd collection automation",
  "ussd collection automation payment",
];

const CREDIT_FIELD_NAMES = [
  "credit",
  "credits",
  "deposit",
  "deposits",
  "paid in",
  "amount paid",
  "cr amount",
  "credit amount",
  "lodgement",
  "money in",
  "amount in",
  "inflow",
  "receipt",
  "receipts",
  "cr",
];

const DEBIT_FIELD_NAMES = [
  "debit",
  "debits",
  "withdrawal",
  "withdrawals",
  "paid out",
  "dr amount",
  "debit amount",
  "money out",
  "amount out",
  "outflow",
  "payment out",
  "dr",
];

const GENERIC_AMOUNT_FIELD_NAMES = [
  "amount",
  "transaction amount",
  "value",
  "payment amount",
  "transaction value",
];

const DIRECTION_FIELD_NAMES = [
  "type",
  "transaction type",
  "dr cr",
  "cr dr",
  "debit credit",
  "credit debit",
  "indicator",
  "transaction indicator",
  "entry type",
  "entry",
  "direction",
  "flow",
];

const REMARK_START_PATTERN =
  /\b(transfer between customers|sundry entries|nibss instant payment|posweb purchase|pos cash withdrawal|cash withdrawal|airtime purchase|commission|vat charges|stamp duties|payment|deposit|credit|transfer from|nip from|trf for customer)\b/i;

const DEFAULT_REQUIRED_CREDIT_PHRASES = ["nip from", "transfer from"];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeReference(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function tokenize(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function parseMoney(value) {
  if (typeof value === "number") return value;

  const cleaned = String(value || "")
    .replace(/[^\d.-]/g, "")
    .trim();

  return Number(cleaned || 0);
}

function getStatementMoneyMatches(value) {
  return [
    ...String(value || "").matchAll(
      /(?:\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d+\.\d{1,2}\b|(?<!\w)\.\d{1,2}\b)/g
    ),
  ];
}

function getDirectionSignal(value) {
  const text = normalizeText(value);

  if (!text) return "";

  const hasDebitSignal =
    hasDebitKeyword(text) ||
    /\bdr\b/.test(text) ||
    /\bdebit\b/.test(text) ||
    /\bout\b/.test(text);

  const hasCreditSignal =
    hasCreditKeyword(text) ||
    /\bcr\b/.test(text) ||
    /\bcredit\b/.test(text) ||
    /\bin\b/.test(text);

  if (hasDebitSignal && !hasCreditSignal) return "debit";
  if (hasCreditSignal && !hasDebitSignal) return "credit";

  return "";
}

function getAmountDirection(value) {
  const raw = String(value || "").trim();
  const amount = parseMoney(raw);

  if (!amount) {
    return { amount: 0, direction: "" };
  }

  if (amount < 0) {
    return { amount: Math.abs(amount), direction: "debit" };
  }

  const signal = getDirectionSignal(raw);

  return {
    amount: Math.abs(amount),
    direction: signal,
  };
}

function normalizeSplitDecimalAmounts(value) {
  return String(value || "").replace(
    /\b(\d{1,3}(?:,\d{3})*|\d+)\.(\d)\s+(\d)\b/g,
    "$1.$2$3"
  );
}

function parseStatementAmount(value) {
  return parseMoney(value);
}

function hasCreditKeyword(value) {
  const text = normalizeText(value);

  return CREDIT_KEYWORDS.some((keyword) =>
    text.includes(normalizeText(keyword))
  );
}

function hasDebitKeyword(value) {
  const text = normalizeText(value);

  return DEBIT_KEYWORDS.some((keyword) =>
    text.includes(normalizeText(keyword))
  );
}

function hasAlwaysIgnoreKeyword(value) {
  const text = normalizeText(value);

  return ALWAYS_IGNORE_KEYWORDS.some((keyword) =>
    text.includes(normalizeText(keyword))
  );
}

function normalizeCreditPhrase(value) {
  return normalizeText(value);
}

function getAllowedCreditPhrases(extraPhrases = []) {
  return [
    ...new Set(
      [...DEFAULT_REQUIRED_CREDIT_PHRASES, ...extraPhrases]
        .map(normalizeCreditPhrase)
        .filter(Boolean)
    ),
  ];
}

function hasRequiredCreditNarration(value, extraPhrases = []) {
  const text = normalizeText(value);

  return getAllowedCreditPhrases(extraPhrases).some((phrase) =>
    text.includes(phrase)
  );
}

function getCandidateCreditPhrase(value) {
  const text = normalizeText(value);
  const candidates = [
    "wumt ifo",
    "transfer between customers",
    "sundry entries",
    "nibss instant payment",
    "trf for customer",
    "transfer for customer",
    "payment",
    "deposit",
    "credit",
  ];

  return candidates.find((phrase) => text.includes(phrase)) || "";
}

function hasStrongCreditSignal(value) {
  const text = normalizeText(value);

  return [
    "credit",
    "deposit",
    "paid in",
    "payment",
    "transfer from",
    "nip from",
    "trf for customer",
    "transfer for customer",
    "inward",
    "lodgement",
    "cash deposit",
    "incoming",
  ].some((keyword) => text.includes(normalizeText(keyword)));
}

function isDebitOnlyTransactionText(value) {
  return hasDebitKeyword(value) && !hasStrongCreditSignal(value);
}

function isCloseAmount(left, right) {
  return Math.abs(Number(left || 0) - Number(right || 0)) < 0.05;
}

function buildReferenceFromNarration(narration, index, prefix = "stmt") {
  const text = String(narration || "");

  return (
    text.match(/\bREFNO:\s*([A-Za-z0-9-]+)/i)?.[1] ||
    text.match(/\bREF:\s*([A-Za-z0-9-]+)/i)?.[1] ||
    `${prefix}-${index + 1}-${normalizeReference(text).slice(0, 12)}`
  );
}

function extractBankReference(value) {
  const text = String(value || "");

  return (
    text.match(/\bREFNO:\s*([A-Za-z0-9-]+)/i)?.[1] ||
    text.match(/\bREF:\s*([A-Za-z0-9-]+)/i)?.[1] ||
    text.match(/\b([A-Z0-9]{5,}-\d+)\b/i)?.[1] ||
    ""
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(field);

      if (row.some((cell) => String(cell).trim())) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);

  if (row.some((cell) => String(cell).trim())) {
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];

  const headers = rows[0].map((header) => normalizeText(header));

  return rows.slice(1).map((row) =>
    headers.reduce((record, header, index) => {
      record[header || `column ${index + 1}`] = row[index] ?? "";
      return record;
    }, {})
  );
}

function findField(row, names) {
  const entries = Object.entries(row);
  const normalizedNames = names.map(normalizeText);

  const match = entries.find(([key]) =>
    normalizedNames.some((name) => key === name || key.includes(name))
  );

  return match?.[1] ?? "";
}

function getFieldsText(row, names) {
  return names
    .map((name) => findField(row, [name]))
    .filter((value) => value !== undefined && value !== null)
    .join(" ");
}

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  const text = String(value).trim();

  const dayNamedMonthYear = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);

  if (dayNamedMonthYear) {
    const monthIndex = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ].indexOf(dayNamedMonthYear[2].toLowerCase());

    if (monthIndex >= 0) {
      return new Date(
        Number(dayNamedMonthYear[3]),
        monthIndex,
        Number(dayNamedMonthYear[1])
      );
    }
  }

  const dayMonthYear = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);

  if (dayMonthYear) {
    const day = Number(dayMonthYear[1]);
    const month = Number(dayMonthYear[2]);
    const year =
      Number(dayMonthYear[3]) < 100
        ? 2000 + Number(dayMonthYear[3])
        : Number(dayMonthYear[3]);

    return new Date(year, month - 1, day);
  }

  const compactDayMonthYear = text.match(/^(\d{2})(\d{2})(\d{2}|\d{4})\b/);

  if (compactDayMonthYear) {
    const day = Number(compactDayMonthYear[1]);
    const month = Number(compactDayMonthYear[2]);
    const year =
      Number(compactDayMonthYear[3]) < 100
        ? 2000 + Number(compactDayMonthYear[3])
        : Number(compactDayMonthYear[3]);

    return new Date(year, month - 1, day);
  }

  const isoDate = new Date(text);

  return Number.isNaN(isoDate.getTime()) ? null : isoDate;
}

function getRowNarration(row) {
  return (
    findField(row, [
      "narration",
      "description",
      "details",
      "remarks",
      "remark",
      "transaction details",
      "transaction description",
      "particulars",
      "memo",
      "note",
    ]) || Object.values(row).join(" ")
  );
}

function getRowReference(row, index, narration) {
  return (
    findField(row, [
      "reference",
      "transaction reference",
      "ref",
      "transaction id",
      "payment reference",
      "rrr",
      "session id",
      "stan",
    ]) || buildReferenceFromNarration(narration, index)
  );
}

function getRowDate(row) {
  return parseDateValue(
    findField(row, [
      "date",
      "transaction date",
      "value date",
      "payment date",
      "posting date",
      "trans date",
    ])
  );
}

function getRowSender(row) {
  return String(
    findField(row, [
      "sender",
      "payer",
      "originator",
      "customer",
      "depositor",
      "account name",
      "sender name",
    ]) || ""
  ).trim();
}

function getRowSenderAccount(row) {
  return String(
    findField(row, [
      "account",
      "sender account",
      "account number",
      "originator account",
      "source account",
    ]) || ""
  ).trim();
}

function normalizeStatementRow({
  transactionDate,
  debit = 0,
  credit = 0,
  balance = 0,
  narration = "",
  matchText = "",
  sourceText = "",
  reference = "",
  bankName = "",
  index = 0,
  allowedCreditPhrases = [],
}) {
  const rawNarration = String(narration || "");
  const displayNarration = rawNarration.trim();
  const cleanNarration = displayNarration
    .replace(/\s+/g, " ")
    .trim();
  const cleanMatchText = String(matchText || cleanNarration)
    .replace(/\s+/g, " ")
    .trim();
  const cleanSourceText = String(sourceText || rawNarration).trim();

  if (!displayNarration) return null;

  if (hasAlwaysIgnoreKeyword(cleanNarration)) return null;

  if (!hasRequiredCreditNarration(cleanNarration, allowedCreditPhrases)) {
    return null;
  }

  const debitAmount = parseStatementAmount(debit);
  const creditAmount = parseStatementAmount(credit);
  const balanceAmount = parseStatementAmount(balance);

  if (debitAmount > 0) return null;

  if (!creditAmount || creditAmount <= 0) return null;

  return {
    transactionDate: parseDateValue(transactionDate),
    amount: creditAmount,
    debit: debitAmount,
    credit: creditAmount,
    balance: balanceAmount,
    reference:
      String(reference || "").trim() ||
      buildReferenceFromNarration(cleanNarration, index),
    narration: displayNarration,
    remarks: displayNarration,
    matchText: cleanMatchText,
    sourceText: cleanSourceText,
    senderName: "",
    senderAccount: "",
    bankName,
    type: "credit",
  };
}

function detectCreditAmount(row, narration, allowedCreditPhrases = []) {
  if (hasAlwaysIgnoreKeyword(narration)) return 0;

  if (!hasRequiredCreditNarration(narration, allowedCreditPhrases)) return 0;

  const explicitCredit = findField(row, CREDIT_FIELD_NAMES);
  const explicitDebit = findField(row, DEBIT_FIELD_NAMES);

  if (parseMoney(explicitDebit) > 0) return 0;

  if (parseMoney(explicitCredit) > 0) {
    return parseMoney(explicitCredit);
  }

  const genericAmountRaw = findField(row, GENERIC_AMOUNT_FIELD_NAMES);
  const { amount: genericAmount, direction: amountDirection } =
    getAmountDirection(genericAmountRaw);

  if (!genericAmount || genericAmount <= 0) return 0;

  if (amountDirection === "debit") return 0;
  if (amountDirection === "credit") return genericAmount;

  const directionText = getFieldsText(row, DIRECTION_FIELD_NAMES);
  const direction = getDirectionSignal(`${directionText} ${narration}`);

  if (direction === "debit") return 0;
  if (direction === "credit") return genericAmount;

  return 0;
}

function rowToTransaction(row, index, bankName, options = {}) {
  const narration = String(getRowNarration(row) || "").trim();

  if (hasAlwaysIgnoreKeyword(narration)) return null;

  const explicitDebit = findField(row, DEBIT_FIELD_NAMES);
  const explicitCredit = findField(row, CREDIT_FIELD_NAMES);
  const creditAmount =
    explicitCredit ||
    detectCreditAmount(row, narration, options.allowedCreditPhrases);

  const transaction = normalizeStatementRow({
    transactionDate: getRowDate(row),
    debit: explicitDebit,
    credit: creditAmount,
    balance: findField(row, ["balance", "closing balance", "available balance"]),
    narration,
    reference: getRowReference(row, index, narration),
    bankName,
    index,
    allowedCreditPhrases: options.allowedCreditPhrases,
  });

  if (transaction) {
    transaction.senderName = getRowSender(row);
    transaction.senderAccount = getRowSenderAccount(row);
    transaction.matchText = narration.replace(/\s+/g, " ").trim();
    transaction.sourceText = Object.values(row).join(" ");
  }

  return transaction;
}

function buildTransactionFingerprint(transaction) {
  const narrationReference = extractBankReference(
    `${transaction.matchText || ""} ${transaction.sourceText || ""} ${
      transaction.narration || ""
    } ${transaction.remarks || ""}`
  );

  const explicitReference = extractBankReference(transaction.reference);

  const reference =
    narrationReference ||
    explicitReference ||
    (normalizeReference(transaction.reference).length >= 6
      ? transaction.reference
      : buildReferenceFromNarration(
          transaction.narration || transaction.remarks || "",
          0,
          ""
        ));

  const transactionDate = transaction.transactionDate
    ? new Date(transaction.transactionDate).toISOString().slice(0, 10)
    : "";

  const amount = Number(transaction.amount || 0).toFixed(2);

  return normalizeReference(
    [reference, transactionDate, amount, transaction.bankName].join("|")
  );
}

export function buildTransactionLooseFingerprint(transaction) {
  const transactionDate = transaction.transactionDate
    ? new Date(transaction.transactionDate).toISOString().slice(0, 10)
    : "";

  const amount = Number(transaction.amount || 0).toFixed(2);

  const narration = normalizeReference(
    String(
      transaction.matchText ||
        transaction.sourceText ||
        transaction.remarks ||
        transaction.narration ||
        ""
    )
      .replace(/\bREFNO:\s*[A-Za-z0-9-]+/gi, "")
      .replace(/\bREF:\s*[A-Za-z0-9-]+/gi, "")
      .replace(/\bpdf-credit-\d+-[a-z0-9-]+/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );

  return normalizeReference(
    [transactionDate, amount, transaction.bankName, narration].join("|")
  );
}

export function dedupeTransactionRecords(records = []) {
  const seen = new Set();

  return records.filter((record) => {
    const keys = [
      record.normalizedFingerprint || buildTransactionFingerprint(record),
      record.normalizedLooseFingerprint || buildTransactionLooseFingerprint(record),
    ].filter(Boolean);

    if (keys.some((key) => seen.has(key))) return false;

    keys.forEach((key) => seen.add(key));
    return true;
  });
}

export async function getApprovedCreditPhrases(db) {
  const phrases = await db
    .collection("reconciliationCreditPhrases")
    .find({ status: "approved" })
    .toArray();

  return phrases.map((phrase) => phrase.phrase).filter(Boolean);
}

export async function savePendingCreditCandidates(
  db,
  ownerId,
  candidates = [],
  { statementId = null, fileName = "", bankName = "" } = {}
) {
  const now = new Date();
  const records = candidates
    .filter((candidate) => candidate?.phrase && candidate?.transaction)
    .map((candidate) => ({
      ownerId,
      statementId,
      fileName,
      bankName,
      phrase: candidate.phrase,
      phraseNormalized: normalizeCreditPhrase(candidate.phrase),
      transaction: candidate.transaction,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }));

  if (!records.length) return { insertedCount: 0 };

  return db.collection("reconciliationPendingCredits").insertMany(records);
}

export async function processPendingCreditsForPhrase(
  db,
  phrase,
  { adminId = "" } = {}
) {
  const phraseNormalized = normalizeCreditPhrase(phrase);
  const now = new Date();

  const pendingCredits = await db
    .collection("reconciliationPendingCredits")
    .find({
      phraseNormalized,
      status: "pending",
    })
    .toArray();

  let imported = 0;
  let failed = 0;

  for (const pending of pendingCredits) {
    try {
      const ownerId = String(pending.ownerId || "");

      if (!ownerId || !pending.transaction) {
        throw new Error("Pending credit is missing owner or transaction data.");
      }

      await reconcileStatementTransactions(
        db,
        { _id: ownerId },
        [pending.transaction],
        {
          statementId: pending.statementId || null,
        }
      );

      await db.collection("reconciliationPendingCredits").updateOne(
        { _id: pending._id },
        {
          $set: {
            status: "imported",
            importedAt: now,
            reviewedBy: adminId,
            updatedAt: now,
          },
        }
      );

      imported += 1;
    } catch (error) {
      failed += 1;
      await db.collection("reconciliationPendingCredits").updateOne(
        { _id: pending._id },
        {
          $set: {
            status: "failed",
            error: error.message || "Unable to import pending credit.",
            reviewedBy: adminId,
            updatedAt: now,
          },
        }
      );
    }
  }

  return {
    scanned: pendingCredits.length,
    imported,
    failed,
  };
}

function stripStatementPageNoise(value) {
  return String(value || "")
    .replace(/\s+--\s+\d+\s+of\s+\d+\s+--.*$/i, "")
    .replace(
      /\s+Trans\.\s+Date\s+Value\s+Date\s+Reference\s+Debits\s+Credits\s+Balance\s+Originating\s+Branch\s+Remarks.*$/i,
      ""
    )
    .trim();
}

function extractRemarksFromTail(value) {
  const tail = stripStatementPageNoise(value);

  const remarkStart = tail.search(REMARK_START_PATTERN);

  if (remarkStart >= 0) return tail.slice(remarkStart).trim();

  return tail;
}

function extractRemarksOnly(value) {
  const tail = stripStatementPageNoise(value);
  const remarkStart = tail.search(REMARK_START_PATTERN);

  if (remarkStart < 0) return "";

  return tail.slice(remarkStart).trim();
}

function extractRemarksFromNarration(value) {
  const text = stripStatementPageNoise(value);

  const header = text.match(
    /^\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}-[A-Za-z]{3}-\d{4}\s+'?\S+\s+(.+)$/
  );

  const rest = header?.[1] || text;

  const amountMatches = [
    ...rest.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?)\b/g),
  ];

  if (amountMatches.length >= 2) {
    const balanceMatch = amountMatches[amountMatches.length - 1];

    return extractRemarksFromTail(
      rest.slice(balanceMatch.index + balanceMatch[0].length)
    );
  }

  return extractRemarksFromTail(rest);
}

function extractRemarksOnlyFromNarration(value) {
  const text = stripStatementPageNoise(value);

  const header = text.match(
    /^\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}-[A-Za-z]{3}-\d{4}\s+'?\S+\s+(.+)$/
  );

  const rest = header?.[1] || text;
  const amountMatches = getStatementMoneyMatches(rest);

  if (amountMatches.length >= 2) {
    const balanceMatch = amountMatches[amountMatches.length - 1];

    return extractRemarksOnly(
      rest.slice(balanceMatch.index + balanceMatch[0].length)
    );
  }

  return extractRemarksOnly(rest);
}

function sliceAfterLastOccurrence(value, needle) {
  const text = String(value || "");
  const search = String(needle || "");

  if (!text || !search) return "";

  const index = text.lastIndexOf(search);

  if (index < 0) return "";

  return text.slice(index + search.length);
}

function parseColumnStatementTransactions(text, bankName, options = {}) {
  const lines = normalizeSplitDecimalAmounts(text).split(/\r?\n/);

  const rowPattern = new RegExp(
    [
      "^(\\d{1,2}-[A-Za-z]{3}-\\d{4})",
      "\\s+(.+?)",
      "\\s+(\\d{1,2}-[A-Za-z]{3}-\\d{4})",
      "\\s+([0-9,]+(?:\\.\\d{1,2})?)",
      "\\s+([0-9,]+(?:\\.\\d{1,2})?)",
      "\\s+([0-9,]+(?:\\.\\d{1,2})?)",
      "\\s*$",
    ].join("")
  );

  const rowHeaderPattern =
    /^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s*$/;

  const amountLinePattern = new RegExp(
    [
      "^(\\d{1,2}-[A-Za-z]{3}-\\d{4})",
      "\\s+([0-9,]+(?:\\.\\d{1,2})?)",
      "\\s+([0-9,]+(?:\\.\\d{1,2})?)",
      "(?:\\s+([0-9,]+(?:\\.\\d{1,2})?))?",
      "\\s*$",
    ].join("")
  );

  const moneyOnlyPattern = /^[0-9,]+(?:\.\d{1,2})?$/;

  const transactions = [];
  let current = null;

  const isLikelyDecimalContinuation = (value) => {
    return /^\d$/.test(String(value || "").trim());
  };

  const amountEndsWithSingleDecimal = (value) => {
    return /\.\d$/.test(String(value || "").trim());
  };

  const flushCurrent = () => {
    if (!current) return;

    if (!current.debit || !current.credit || !current.balance) {
      current = null;
      return;
    }

    const displayNarration = [
      current.description,
      ...current.continuationLines,
    ]
      .join("\n")
      .trim();

    const narrationParts = displayNarration
      .replace(/\s+/g, " ")
      .trim();

    if (hasAlwaysIgnoreKeyword(narrationParts)) {
      current = null;
      return;
    }

    const transaction = normalizeStatementRow({
      transactionDate: current.transactionDate,
      debit: current.debit,
      credit: current.credit,
      balance: current.balance,
      narration: displayNarration,
      matchText: narrationParts,
      sourceText: displayNarration,
      reference: buildReferenceFromNarration(
        narrationParts,
        transactions.length,
        "stmt"
      ),
      bankName,
      index: transactions.length,
      allowedCreditPhrases: options.allowedCreditPhrases,
    });

    if (transaction) transactions.push(transaction);

    current = null;
  };

  for (const line of lines) {
    const cleanLine = String(line || "").trim();

    if (!cleanLine) continue;

    const rowMatch = cleanLine.match(rowPattern);
    const amountLineMatch = cleanLine.match(amountLinePattern);

    if (amountLineMatch && current && !current.debit && !current.credit) {
      current.debit = amountLineMatch[2];
      current.credit = amountLineMatch[3];
      current.balance = amountLineMatch[4] || "";
      continue;
    }

    if (current && current.debit && current.credit && !current.balance) {
      if (moneyOnlyPattern.test(cleanLine)) {
        current.balance = cleanLine;
        continue;
      }
    }

    if (rowMatch) {
      flushCurrent();

      current = {
        transactionDate: rowMatch[1],
        description: rowMatch[2],
        valueDate: rowMatch[3],
        debit: rowMatch[4],
        credit: rowMatch[5],
        balance: rowMatch[6],
        continuationLines: [],
      };

      continue;
    }

    const rowHeaderMatch = cleanLine.match(rowHeaderPattern);

    if (rowHeaderMatch && !amountLineMatch) {
      flushCurrent();

      current = {
        transactionDate: rowHeaderMatch[1],
        description: rowHeaderMatch[2],
        valueDate: "",
        debit: "",
        credit: "",
        balance: "",
        continuationLines: [],
      };

      continue;
    }

    if (!current) continue;

    if (
      amountEndsWithSingleDecimal(current.credit) &&
      isLikelyDecimalContinuation(cleanLine)
    ) {
      current.credit = `${current.credit}${cleanLine}`;
      continue;
    }

    const lowerLine = cleanLine.toLowerCase();

    const isNoise =
      lowerLine === "account statement" ||
      lowerLine.startsWith("page") ||
      lowerLine.startsWith("name:") ||
      lowerLine.startsWith("address:") ||
      lowerLine.startsWith("account summary") ||
      lowerLine.startsWith("account no:") ||
      lowerLine.startsWith("account ") ||
      lowerLine.startsWith("type:") ||
      lowerLine.startsWith("currency") ||
      lowerLine.startsWith("opening") ||
      lowerLine.startsWith("closing") ||
      lowerLine.startsWith("transaction") ||
      lowerLine === "date";

    if (!isNoise) current.continuationLines.push(cleanLine);
  }

  flushCurrent();

  return transactions;
}

async function extractPdfText(buffer, password = "") {
  let parser;

  try {
    await import("pdf-parse/worker");

    const pdfParseModule = await import("pdf-parse");
    const { PDFParse } = pdfParseModule;

    if (!PDFParse) {
      throw new Error("PDF parser could not be loaded.");
    }

    parser = new PDFParse({
      data: buffer,
      password: password || undefined,
    });

    const result = await parser.getText();
    const text = String(result?.text || "").trim();

    if (!text) {
      throw new Error("No readable text was found in this PDF.");
    }

    return text;
  } catch (error) {
    console.error("PDF TEXT EXTRACTION ERROR:", error);

    if (password) {
      throw new Error(
        "Unable to read this PDF. Check that the PDF password is correct and try again."
      );
    }

    throw new Error(
      error.message ||
        "Unable to read this PDF. The file may be scanned, encrypted, image-based, or unreadable."
    );
  } finally {
    if (parser && typeof parser.destroy === "function") {
      await parser.destroy();
    }
  }
}

function parseTextTransactions(text, bankName, options = {}) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => ({
      raw: String(line || "").trim(),
      compact: String(line || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((line) => line.compact);

  return lines
    .map(({ raw, compact }, index) => {
      if (hasAlwaysIgnoreKeyword(compact)) return null;

      const dateMatch =
        compact.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/) ||
        compact.match(/(\d{1,2}-[A-Za-z]{3}-\d{4})/);

      const amountMatches = [
        ...compact.matchAll(
          /(?:NGN|N)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.\d{1,2})?|[0-9]+\.\d{1,2})/gi
        ),
      ];

      if (!dateMatch || !amountMatches.length) return null;

      const trailingAmounts = amountMatches
        .slice(-3)
        .map((amountMatch) => parseMoney(amountMatch[1]));

      if (trailingAmounts.length === 3) {
        const [possibleDebit, possibleCredit] = trailingAmounts;

        if (possibleDebit > 0 || possibleCredit <= 0) return null;
      }

      const creditSignal = hasCreditKeyword(compact);
      const debitSignal = hasDebitKeyword(compact);

      if (debitSignal && !creditSignal) return null;
      if (!creditSignal) return null;

      const amount = parseMoney(amountMatches[0]?.[1]);

      if (!amount || amount <= 0) return null;

      const remarks =
        extractRemarksOnlyFromNarration(raw) ||
        extractRemarksOnlyFromNarration(compact) ||
        extractRemarksOnly(raw) ||
        extractRemarksOnly(compact);

      return normalizeStatementRow({
        transactionDate: dateMatch[1],
        debit: 0,
        credit: amount,
        balance: 0,
        narration: remarks || raw,
        matchText: extractRemarksFromNarration(compact) || remarks || compact,
        sourceText: raw,
        reference: buildReferenceFromNarration(compact, index, "pdf"),
        bankName,
        index,
        allowedCreditPhrases: options.allowedCreditPhrases,
      });
    })
    .filter(Boolean);
}

function parseNarrativeAmountTransactions(text, bankName, options = {}) {
  const normalizedText = normalizeSplitDecimalAmounts(text)
    .replace(/\s+/g, " ")
    .trim();

  const rowPattern =
    /(.{0,500}?)(\d{1,2}-[A-Za-z]{3}-\d{4})\s+([0-9,]+(?:\.\d{1,2})?)\s+([0-9,]+(?:\.\d{1,2})?)\s+([0-9,]+(?:\.\d{1,2})?)(?=\s+\d{1,2}-[A-Za-z]{3}-\d{4}\s+|$)/g;

  const transactions = [];
  let match;

  while ((match = rowPattern.exec(normalizedText)) !== null) {
    const narrationBlock = String(match[1] || "").trim();
    const transactionDate = match[2];
    const debit = match[3];
    const credit = match[4];
    const balance = match[5];

    const narration = extractRemarksFromTail(narrationBlock) || narrationBlock;

    const transaction = normalizeStatementRow({
      transactionDate,
      debit,
      credit,
      balance,
      narration,
      reference: buildReferenceFromNarration(
        narration,
        transactions.length,
        "pdf-credit"
      ),
      bankName,
      index: transactions.length,
      allowedCreditPhrases: options.allowedCreditPhrases,
    });

    if (transaction) transactions.push(transaction);
  }

  return transactions;
}

function parseBalanceStatementTransactions(text, bankName, options = {}) {
  const openingBalance = parseMoney(
    text.match(/Opening Balance\s+([0-9,]+(?:\.\d{1,2})?)/i)?.[1]
  );

  const startPattern =
    /^\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}-[A-Za-z]{3}-\d{4}\s+/;

  const rows = [];
  const pendingCreditCandidates = [];
  let current = null;

  normalizeSplitDecimalAmounts(text)
    .split(/\r?\n/)
    .map((line) => ({
      raw: String(line || "").trim(),
      compact: String(line || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((line) => line.compact)
    .forEach((line) => {
      if (startPattern.test(line.compact)) {
        if (current) rows.push(current);
        current = {
          raw: line.raw,
          compact: line.compact,
        };
      } else if (current) {
        current.raw = `${current.raw}\n${line.raw}`;
        current.compact = `${current.compact} ${line.compact}`;
      }
    });

  if (current) rows.push(current);

  let previousBalance = openingBalance || null;

  const transactions = rows
    .map((row, index) => {
      const compactRow = row.compact;
      const rawRow = row.raw;

      const header = compactRow.match(
        /^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+'?(\S+)\s+(.+)$/
      );

      if (!header) return null;

      const [, transactionDate, , reference, rest] = header;

      const amountMatches = getStatementMoneyMatches(rest);

      const amounts = amountMatches.map((amountMatch) =>
        parseMoney(amountMatch[0])
      );

      if (amounts.length < 2) return null;

      const balance = amounts[amounts.length - 1];
      const amount = amounts[amounts.length - 2];
      const balanceMatch = amountMatches[amountMatches.length - 1];

      const hasExplicitDebitCreditBalance = amounts.length >= 3;
      const explicitDebit = hasExplicitDebitCreditBalance
        ? amounts[amounts.length - 3]
        : 0;
      const explicitCredit = hasExplicitDebitCreditBalance
        ? amounts[amounts.length - 2]
        : amount;

      const compactRemarks = extractRemarksFromTail(
        rest.slice(balanceMatch.index + balanceMatch[0].length)
      );
      const rawRemarks =
        extractRemarksFromTail(
          sliceAfterLastOccurrence(rawRow, balanceMatch[0])
        ) || compactRemarks;
      const remarks = rawRemarks || compactRemarks;

      if (hasAlwaysIgnoreKeyword(`${rest} ${compactRemarks}`)) return null;

      if (isDebitOnlyTransactionText(`${rest} ${compactRemarks}`)) {
        previousBalance = balance;
        return null;
      }

      if (
        hasExplicitDebitCreditBalance &&
        (explicitDebit > 0 || explicitCredit <= 0)
      ) {
        previousBalance = balance;
        return null;
      }

      const isCredit = hasExplicitDebitCreditBalance
        ? explicitCredit > 0
        : previousBalance === null
          ? hasCreditKeyword(rest)
          : isCloseAmount(previousBalance + amount, balance);

      const isDebit =
        previousBalance !== null &&
        isCloseAmount(previousBalance - amount, balance);

      previousBalance = balance;

      const creditAmount = hasExplicitDebitCreditBalance
        ? explicitCredit
        : amount;

      if (!isCredit || isDebit || creditAmount <= 0) return null;

      if (
        !hasRequiredCreditNarration(
          `${remarks} ${compactRemarks} ${rest}`,
          options.allowedCreditPhrases
        )
      ) {
        const phrase = getCandidateCreditPhrase(`${remarks} ${compactRemarks}`);

        if (phrase) {
          pendingCreditCandidates.push({
            phrase,
            phraseNormalized: normalizeCreditPhrase(phrase),
            transaction: {
              transactionDate: parseDateValue(transactionDate),
              amount: creditAmount,
              debit: 0,
              credit: creditAmount,
              balance,
              reference: `${reference}-${index + 1}`,
              narration: remarks || rawRow,
              remarks: remarks || rawRow,
              matchText: compactRemarks || compactRow,
              sourceText: rawRow,
              senderName: "",
              senderAccount: "",
              bankName,
              type: "credit",
            },
          });
        }

        return null;
      }

      return normalizeStatementRow({
        transactionDate,
        debit: 0,
        credit: creditAmount,
        balance,
        narration: remarks || rawRow,
        matchText: compactRemarks || compactRow,
        sourceText: rawRow,
        reference: `${reference}-${index + 1}`,
        bankName,
        index,
        allowedCreditPhrases: options.allowedCreditPhrases,
      });
    })
    .filter(Boolean);

  transactions.pendingCreditCandidates = pendingCreditCandidates;

  return transactions;
}

function dedupeTransactions(transactions) {
  const seen = new Set();

  return transactions.filter((transaction) => {
    const keys = [
      buildTransactionFingerprint(transaction),
      buildTransactionLooseFingerprint(transaction),
    ].filter(Boolean);

    if (keys.some((key) => seen.has(key))) return false;

    keys.forEach((key) => seen.add(key));

    return true;
  });
}

export async function parseStatementFile(file, bankName, options = {}) {
  const { password = "" } = options;
  const fileName = file.name || "statement";
  const extension = fileName.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (["xlsx", "xls"].includes(extension)) {
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
    });

    const rows = workbook.SheetNames.flatMap((sheetName) =>
      XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: "",
      })
    );

    return dedupeTransactions(
      rows
        .map((row, index) => rowToTransaction(row, index, bankName, options))
        .filter(Boolean)
    );
  }

  if (extension === "csv") {
    const rows = parseCsv(buffer.toString("utf8"));

    return dedupeTransactions(
      rowsToObjects(rows)
        .map((row, index) => rowToTransaction(row, index, bankName, options))
        .filter(Boolean)
    );
  }

  if (extension === "pdf") {
    const text = await extractPdfText(buffer, password);

    const parsedGroups = [
      parseColumnStatementTransactions(text, bankName, options),
      parseNarrativeAmountTransactions(text, bankName, options),
      parseBalanceStatementTransactions(text, bankName, options),
      parseTextTransactions(text, bankName, options),
    ];
    const transactions = dedupeTransactions(parsedGroups.flat());
    transactions.pendingCreditCandidates = parsedGroups.flatMap(
      (group) => group.pendingCreditCandidates || []
    );

    if (!transactions.length && !transactions.pendingCreditCandidates?.length) {
      throw new Error(
        "No readable credit transactions were found in this PDF. If the PDF is password protected, enter the password before upload."
      );
    }

    return transactions;
  }

  throw new Error("Unsupported statement file. Upload CSV, Excel, or PDF.");
}

function getInvoiceCustomerName(invoice) {
  return String(
    invoice?.customer ||
      invoice?.customerName ||
      invoice?.student ||
      invoice?.studentName ||
      invoice?.name ||
      invoice?.customerProfile?.name ||
      ""
  ).trim();
}

function getInvoiceNameAliases(invoice) {
  const profile = invoice?.customerProfile || {};

  const aliases = [
    getInvoiceCustomerName(invoice),
    invoice?.studentName,
    invoice?.customerName,
    invoice?.guardianName,
    invoice?.parentName,
    profile?.name,
    profile?.studentName,
    profile?.customerName,
    profile?.guardianName,
    profile?.parentName,
  ];

  return [
    ...new Set(
      aliases
        .map((alias) => normalizeText(alias))
        .filter((alias) => alias.length >= 3)
    ),
  ];
}

function scoreNameAliasesInNarration(aliases, narrationTokens, compactNarration) {
  return aliases.reduce(
    (best, alias) => {
      const compactAlias = normalizeReference(alias);
      const aliasTokens = alias.split(" ").filter((token) => token.length > 2);

      const matchingTokens = aliasTokens.filter((token) =>
        narrationTokens.has(token)
      );

      if (
        compactAlias.length >= 6 &&
        compactNarration.includes(compactAlias)
      ) {
        return {
          score: Math.max(best.score, 35),
          reason: "student or guardian name phrase found",
        };
      }

      if (matchingTokens.length >= 2) {
        return {
          score: Math.max(best.score, Math.min(35, matchingTokens.length * 15)),
          reason: "at least two student or guardian name words found",
        };
      }

      if (matchingTokens.length === 1) {
        return {
          score: Math.max(best.score, 30),
          reason: "student or guardian name word found",
        };
      }

      return best;
    },
    { score: 0, reason: "" }
  );
}

function getInvoiceToken(invoice) {
  return String(
    invoice?.customerToken ||
      invoice?.token ||
      invoice?.paymentToken ||
      ""
  ).trim();
}

function getInvoiceOutstandingAmount(invoice) {
  const amount = parseAmount(
    invoice?.amount || invoice?.total || invoice?.subtotal || 0
  );

  const paidAmount = parseAmount(invoice?.paidAmount || invoice?.amountPaid || 0);
  const balanceDue = parseAmount(invoice?.balanceDue || 0);

  if (balanceDue > 0) return balanceDue;

  return Math.max(amount - paidAmount, 0);
}

function invoiceBelongsToSameCustomer(invoice, transaction) {
  const narration = normalizeText(
    `${transaction.matchText || ""} ${transaction.sourceText || ""} ${
      transaction.remarks || ""
    } ${transaction.narration || ""} ${transaction.senderName || ""} ${
      transaction.reference || ""
    }`
  );

  const compactNarration = normalizeReference(narration);
  const narrationTokens = new Set(tokenize(narration));
  const aliases = getInvoiceNameAliases(invoice);

  if (!aliases.length) return false;

  return aliases.some((alias) => {
    const compactAlias = normalizeReference(alias);

    if (compactAlias.length >= 6 && compactNarration.includes(compactAlias)) {
      return true;
    }

    const aliasTokens = alias.split(" ").filter((token) => token.length > 2);

    const matchingTokens = aliasTokens.filter((token) =>
      narrationTokens.has(token)
    ).length;

    return matchingTokens >= 1;
  });
}

function chooseBestCustomerInvoice(transaction, invoices) {
  const amount = parseAmount(transaction.amount);

  const sameCustomerOpenInvoices = invoices.filter((invoice) => {
    const outstanding = getInvoiceOutstandingAmount(invoice);

    return outstanding > 0 && invoiceBelongsToSameCustomer(invoice, transaction);
  });

  if (!sameCustomerOpenInvoices.length) return null;

  const exactAmountInvoice = sameCustomerOpenInvoices.find((invoice) => {
    const outstanding = getInvoiceOutstandingAmount(invoice);
    const invoiceAmount = parseAmount(invoice.amount || 0);

    return (
      isCloseAmount(outstanding, amount) ||
      isCloseAmount(invoiceAmount, amount)
    );
  });

  if (exactAmountInvoice) return exactAmountInvoice;

  const invoiceThatCanAcceptPayment = sameCustomerOpenInvoices
    .filter((invoice) => getInvoiceOutstandingAmount(invoice) >= amount)
    .sort(
      (a, b) =>
        getInvoiceOutstandingAmount(a) - getInvoiceOutstandingAmount(b)
    )[0];

  if (invoiceThatCanAcceptPayment) return invoiceThatCanAcceptPayment;

  return sameCustomerOpenInvoices.sort(
    (a, b) =>
      new Date(b.date || b.createdAt || 0) -
      new Date(a.date || a.createdAt || 0)
  )[0];
}

function scoreInvoiceMatch(
  transaction,
  invoice,
  { allowNameOnlySuggestion = false } = {}
) {
  const amount = parseAmount(transaction.amount);
  const balance = parseAmount(invoice.balanceDue || invoice.amount || 0);
  const invoiceAmount = parseAmount(invoice.amount || 0);

  const remarksText =
    transaction.matchText ||
    transaction.sourceText ||
    transaction.remarks ||
    extractRemarksFromNarration(transaction.narration);

  const narration = normalizeText(
    `${remarksText} ${transaction.senderName} ${transaction.reference}`
  );

  const reference = normalizeReference(`${transaction.reference} ${remarksText}`);

  const invoiceToken = normalizeReference(
    `${invoice.customerToken || ""} ${invoice.token || ""} ${
      invoice.paymentToken || ""
    }`
  );

  const invoiceNumber = normalizeReference(invoice.invoiceNumber);
  const phone = normalizeReference(invoice.phone);

  const narrationTokens = new Set(tokenize(narration));
  const compactNarration = normalizeReference(narration);

  const nameAliasMatch = scoreNameAliasesInNarration(
    getInvoiceNameAliases(invoice),
    narrationTokens,
    compactNarration
  );

  const exactAmount =
    amount > 0 && (isCloseAmount(amount, balance) || isCloseAmount(amount, invoiceAmount));

  let score = 0;
  const reasons = [];

  if (invoiceToken && reference.includes(invoiceToken)) {
    score += 80;
    reasons.push("invoice token found in narration or remarks");
  }

  if (invoiceNumber && reference.includes(invoiceNumber)) {
    score += 40;
    reasons.push("invoice number found");
  }

  if (exactAmount) {
    score += 30;
    reasons.push("amount matches");
  }

  if (phone && narration.includes(phone)) {
    score += 25;
    reasons.push("phone number found");
  }

  if (nameAliasMatch.score > 0) {
    score += nameAliasMatch.score;
    reasons.push(nameAliasMatch.reason);
  }

  const suggestedThreshold = allowNameOnlySuggestion
    ? MIN_NAME_SUGGESTED_CONFIDENCE
    : MIN_SUGGESTED_CONFIDENCE;

  if (amount > balance && balance > 0) {
    return {
      confidence: Math.min(score, 89),
      status: score >= suggestedThreshold ? "suggested_match" : "unmatched",
      reasons: [...reasons, "credit is greater than invoice balance"],
    };
  }

  return {
    confidence: Math.min(score, 100),
    status:
      score >= MIN_AUTO_CONFIDENCE
        ? "matched"
        : score >= suggestedThreshold
          ? "suggested_match"
          : "unmatched",
    reasons,
  };
}

function chooseBestInvoiceMatch(transaction, invoices) {
  const candidates = invoices
    .map((invoice) => ({
      invoice,
      ...scoreInvoiceMatch(transaction, invoice),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const best = candidates[0] || null;
  const customerOverviewInvoice = chooseBestCustomerInvoice(
    transaction,
    invoices
  );

  if (!customerOverviewInvoice) {
    if (
      best &&
      best.status === "unmatched" &&
      best.confidence >= MIN_NAME_SUGGESTED_CONFIDENCE
    ) {
      return {
        ...best,
        status: "suggested_match",
        confidence: Math.max(best.confidence, MIN_NAME_SUGGESTED_CONFIDENCE),
        reasons: [
          ...(best.reasons || []),
          "suggested using customer name found in narration",
        ],
      };
    }

    return best;
  }

  const customerInvoiceMatch = {
    invoice: customerOverviewInvoice,
    ...scoreInvoiceMatch(transaction, customerOverviewInvoice, {
      allowNameOnlySuggestion: true,
    }),
  };

  const customerSuggestion = {
    ...customerInvoiceMatch,
    status:
      customerInvoiceMatch.status === "matched"
        ? "matched"
        : "suggested_match",
    confidence: Math.max(customerInvoiceMatch.confidence, 30),
    reasons: [
      ...(customerInvoiceMatch.reasons || []),
      "matched using customer overview invoice records",
    ],
  };

  if (!best) {
    return customerSuggestion;
  }

  if (
    best.status === "matched" &&
    String(best.invoice?._id || "") !== String(customerOverviewInvoice._id || "")
  ) {
    return best;
  }

  if (
    best.status === "unmatched" &&
    customerSuggestion.status === "suggested_match" &&
    customerSuggestion.confidence >= best.confidence
  ) {
    return customerSuggestion;
  }

  if (customerSuggestion.confidence > best.confidence) {
    return customerSuggestion;
  }

  return best;
}

async function hydrateInvoicesWithCustomerProfiles(db, ownerId, invoices) {
  const tokens = [
    ...new Set(
      invoices
        .flatMap((invoice) => [invoice.customerToken, invoice.token])
        .map((token) => String(token || "").trim())
        .filter(Boolean)
    ),
  ];

  if (!tokens.length) return invoices;

  const customers = await db
    .collection("customers")
    .find({
      ownerId,
      token: { $in: tokens },
    })
    .toArray();

  const customerByToken = new Map(
    customers.map((customer) => [String(customer.token || ""), customer])
  );

  return invoices.map((invoice) => ({
    ...invoice,
    customerProfile:
      customerByToken.get(String(invoice.customerToken || "")) ||
      customerByToken.get(String(invoice.token || "")) ||
      null,
  }));
}

export async function reconcileStatementTransactions(
  db,
  owner,
  transactions,
  { statementId } = {}
) {
  const ownerId = String(owner._id);

  const rawInvoices = await db
    .collection("invoices")
    .find({
      ownerId,
      status: { $nin: ["Paid", "paid"] },
    })
    .toArray();

  let invoices = await hydrateInvoicesWithCustomerProfiles(
    db,
    ownerId,
    rawInvoices
  );

  const now = new Date();
  const results = [];

  for (const transaction of transactions) {
    const normalizedFingerprint = buildTransactionFingerprint(transaction);
    const normalizedLooseFingerprint = buildTransactionLooseFingerprint(transaction);

    const existing = await db.collection("reconciliationTransactions").findOne({
      ownerId,
      $or: [{ normalizedFingerprint }, { normalizedLooseFingerprint }],
    });

    if (existing) {
      results.push({ ...existing, status: "duplicate" });
      continue;
    }

    const best = chooseBestInvoiceMatch(transaction, invoices);

    const status =
      best?.status && best.status !== "unmatched"
        ? best.status
        : "pending_review";
    let matchedInvoice = null;

    if (status === "matched") {
      matchedInvoice = await markInvoicePaid(db, best.invoice, {
        paymentReference: transaction.reference,
        paidAmount: transaction.amount,
        paidAt: transaction.transactionDate || now,
        paymentProvider: "Bank Statement Upload",
        verificationMethod: "bank_statement",
        notificationStatus: best.invoice.phone ? "prepared" : "unavailable",
      });

      try {
        await deliverPaymentConfirmation({
          db,
          invoice: matchedInvoice,
          owner,
          amount: transaction.amount,
        });
      } catch (error) {
        console.error("RECONCILIATION WHATSAPP CONFIRMATION ERROR:", error);
      }

      invoices = invoices
        .map((invoice) =>
          String(invoice._id) === String(matchedInvoice._id)
            ? matchedInvoice
            : invoice
        )
        .filter((invoice) => getInvoiceOutstandingAmount(invoice) > 0);
    }

    const linkedInvoice = matchedInvoice || best?.invoice || null;

    const record = {
      ...transaction,
      ownerId,
      statementId,
      normalizedReference: normalizeReference(transaction.reference),
      normalizedFingerprint,
      normalizedLooseFingerprint,
      status,
      confidence: best?.confidence || 0,
      reviewReason:
        status === "pending_review"
          ? "Needs user validation before marking unmatched"
          : "",

      suggestedInvoiceId:
        status === "suggested_match" ? best?.invoice?._id || null : null,
      suggestedInvoiceNumber:
        status === "suggested_match" ? getInvoiceToken(best?.invoice || {}) : "",
      suggestedInvoiceToken:
        status === "suggested_match" ? getInvoiceToken(best?.invoice || {}) : "",
      suggestedCustomer:
        status === "suggested_match"
          ? getInvoiceCustomerName(best?.invoice || {})
          : "",

      matchedInvoiceId:
        status === "matched" ? linkedInvoice?._id || null : null,
      matchedInvoiceNumber:
        status === "matched" ? getInvoiceToken(linkedInvoice || {}) : "",
      matchedInvoiceToken:
        status === "matched" ? getInvoiceToken(linkedInvoice || {}) : "",
      matchedCustomer:
        status === "matched" ? getInvoiceCustomerName(linkedInvoice || {}) : "",

      matchReasons: best?.reasons || [],
      createdAt: now,
      updatedAt: now,
    };

    const insert = await db
      .collection("reconciliationTransactions")
      .insertOne(record);

    results.push({ ...record, _id: insert.insertedId });
  }

  return results;
}

export async function approveSuggestedTransaction(db, ownerId, transactionId) {
  const transaction = await db.collection("reconciliationTransactions").findOne({
    _id: new ObjectId(transactionId),
    ownerId,
  });

  if (!transaction?.suggestedInvoiceId) {
    throw new Error("No suggested invoice found for this transaction.");
  }

  const invoice = await db.collection("invoices").findOne({
    _id:
      typeof transaction.suggestedInvoiceId === "string"
        ? new ObjectId(transaction.suggestedInvoiceId)
        : transaction.suggestedInvoiceId,
    ownerId,
  });

  if (!invoice) {
    throw new Error("Suggested invoice was not found.");
  }

  const balance = parseAmount(invoice.balanceDue || invoice.amount || 0);

  if (parseAmount(transaction.amount) > balance) {
    throw new Error(
      "This credit is higher than the invoice balance and requires manual review."
    );
  }

  const updatedInvoice = await markInvoicePaid(db, invoice, {
    paymentReference: transaction.reference,
    paidAmount: transaction.amount,
    paidAt: transaction.transactionDate || new Date(),
    paymentProvider: "Bank Statement Upload",
    verificationMethod: "manual_reconciliation",
    notificationStatus: invoice.phone ? "prepared" : "unavailable",
  });

  await db.collection("reconciliationTransactions").updateOne(
    { _id: transaction._id },
    {
      $set: {
        status: "matched",
        matchedInvoiceId: invoice._id,
        matchedInvoiceNumber: getInvoiceToken(invoice),
        matchedInvoiceToken: getInvoiceToken(invoice),
        matchedCustomer: getInvoiceCustomerName(invoice),

        suggestedInvoiceId: null,
        suggestedInvoiceNumber: "",
        suggestedInvoiceToken: "",
        suggestedCustomer: "",

        updatedAt: new Date(),
        manuallyApprovedAt: new Date(),
      },
    }
  );

  return updatedInvoice;
}

export async function validateReviewedTransaction(db, owner, transactionId) {
  const ownerId = String(owner._id || owner.id || owner);
  const transaction = await db.collection("reconciliationTransactions").findOne({
    _id: new ObjectId(transactionId),
    ownerId,
  });

  if (!transaction) {
    throw new Error("Reconciliation transaction was not found.");
  }

  const rawInvoices = await db
    .collection("invoices")
    .find({
      ownerId,
      status: { $nin: ["Paid", "paid"] },
    })
    .toArray();

  const invoices = await hydrateInvoicesWithCustomerProfiles(
    db,
    ownerId,
    rawInvoices
  );
  const best = chooseBestInvoiceMatch(transaction, invoices);
  const now = new Date();

  if (best?.invoice && best.status !== "unmatched") {
    const matchedInvoice = await markInvoicePaid(db, best.invoice, {
      paymentReference: transaction.reference,
      paidAmount: transaction.amount,
      paidAt: transaction.transactionDate || now,
      paymentProvider: "Bank Statement Upload",
      verificationMethod: "user_review_reconciliation",
      notificationStatus: best.invoice.phone ? "prepared" : "unavailable",
    });

    try {
      await deliverPaymentConfirmation({
        db,
        invoice: matchedInvoice,
        owner,
        amount: transaction.amount,
      });
    } catch (error) {
      console.error("RECONCILIATION REVIEW WHATSAPP CONFIRMATION ERROR:", error);
    }

    await db.collection("reconciliationTransactions").updateOne(
      { _id: transaction._id, ownerId },
      {
        $set: {
          status: "matched",
          confidence: Math.max(best.confidence || 0, 30),
          matchedInvoiceId: matchedInvoice._id,
          matchedInvoiceNumber: getInvoiceToken(matchedInvoice),
          matchedInvoiceToken: getInvoiceToken(matchedInvoice),
          matchedCustomer: getInvoiceCustomerName(matchedInvoice),
          suggestedInvoiceId: null,
          suggestedInvoiceNumber: "",
          suggestedInvoiceToken: "",
          suggestedCustomer: "",
          reviewReason: "",
          matchReasons: [
            ...(best.reasons || []),
            "validated from user review",
          ],
          validatedAt: now,
          updatedAt: now,
        },
      }
    );

    return {
      status: "matched",
      invoice: matchedInvoice,
    };
  }

  await db.collection("reconciliationTransactions").updateOne(
    { _id: transaction._id, ownerId },
    {
      $set: {
        status: "unmatched",
        confidence: best?.confidence || 0,
        suggestedInvoiceId: null,
        suggestedInvoiceNumber: "",
        suggestedInvoiceToken: "",
        suggestedCustomer: "",
        reviewReason: "",
        matchReasons: best?.reasons || [],
        validatedAt: now,
        updatedAt: now,
      },
    }
  );

  return {
    status: "unmatched",
    invoice: null,
  };
}

function refreshTransactionWithCurrentRules(transaction) {
  const sourceText = String(
    transaction.sourceText ||
      transaction.narration ||
      transaction.remarks ||
      ""
  );
  const compactSourceText = sourceText.replace(/\s+/g, " ").trim();
  const currentRemarks =
    extractRemarksOnlyFromNarration(sourceText) ||
    extractRemarksOnlyFromNarration(compactSourceText) ||
    extractRemarksOnly(sourceText) ||
    extractRemarksOnly(compactSourceText) ||
    String(transaction.remarks || transaction.narration || "").trim();
  const matchText = currentRemarks.replace(/\s+/g, " ").trim();

  const refreshed = {
    ...transaction,
    remarks: currentRemarks,
    narration: currentRemarks,
    matchText: matchText || transaction.matchText || "",
    sourceText: sourceText || transaction.sourceText || "",
  };

  refreshed.normalizedReference = normalizeReference(refreshed.reference);
  refreshed.normalizedFingerprint = buildTransactionFingerprint(refreshed);
  refreshed.normalizedLooseFingerprint = buildTransactionLooseFingerprint(refreshed);

  const updates = {};

  [
    "remarks",
    "narration",
    "matchText",
    "sourceText",
    "normalizedReference",
    "normalizedFingerprint",
    "normalizedLooseFingerprint",
  ].forEach((field) => {
    if (String(transaction[field] || "") !== String(refreshed[field] || "")) {
      updates[field] = refreshed[field];
    }
  });

  return { transaction: refreshed, updates };
}

function getCurrentCreditRuleFailure(transaction, allowedCreditPhrases = []) {
  const transactionText = `${transaction.remarks || ""} ${
    transaction.narration || ""
  } ${transaction.matchText || ""} ${transaction.sourceText || ""} ${
    transaction.reference || ""
  }`;

  if (hasAlwaysIgnoreKeyword(transactionText)) {
    return "Ignored by reconciliation rules";
  }

  if (isDebitOnlyTransactionText(transactionText)) {
    return "Debit or bank charge ignored during rerun";
  }

  if (!hasRequiredCreditNarration(transactionText, allowedCreditPhrases)) {
    return "Ignored by current credit narration rules during rerun";
  }

  return "";
}

export async function rematchPendingReconciliationTransactions(db, ownerOrId) {
  const owner =
    ownerOrId && typeof ownerOrId === "object"
      ? ownerOrId
      : { _id: ownerOrId };
  const ownerId = String(owner._id || owner.id || ownerOrId);

  const rawInvoices = await db
    .collection("invoices")
    .find({
      ownerId,
      status: { $nin: ["Paid", "paid"] },
    })
    .toArray();

  let invoices = await hydrateInvoicesWithCustomerProfiles(
    db,
    ownerId,
    rawInvoices
  );

  const now = new Date();
  const approvedCreditPhrases = await getApprovedCreditPhrases(db);
  let refreshed = 0;
  let matchedFlaggedForReview = 0;
  const matchedFlaggedIds = [];

  const matchedTransactions = await db
    .collection("reconciliationTransactions")
    .find({
      ownerId,
      status: "matched",
    })
    .toArray();

  for (const matchedTransaction of matchedTransactions) {
    const refreshedTransaction =
      refreshTransactionWithCurrentRules(matchedTransaction);
    const transaction = refreshedTransaction.transaction;
    const ruleFailure = getCurrentCreditRuleFailure(
      transaction,
      approvedCreditPhrases
    );
    const updates = {
      ...refreshedTransaction.updates,
    };

    if (ruleFailure) {
      updates.status = "pending_review";
      updates.reviewReason = ruleFailure;
      updates.confidence = 0;
      matchedFlaggedForReview += 1;
      matchedFlaggedIds.push(transaction._id);
    }

    if (Object.keys(updates).length) {
      await db.collection("reconciliationTransactions").updateOne(
        { _id: transaction._id, ownerId },
        {
          $set: {
            ...updates,
            rematchedAt: now,
            updatedAt: now,
          },
        }
      );

      refreshed += 1;
    }
  }

  const pendingQuery = {
    ownerId,
    status: {
      $in: [
        "unmatched",
        "pending_review",
        "overpayment",
        "suggested_match",
      ],
    },
  };

  if (matchedFlaggedIds.length) {
    pendingQuery._id = { $nin: matchedFlaggedIds };
  }

  const pendingTransactions = await db
    .collection("reconciliationTransactions")
    .find(pendingQuery)
    .toArray();

  let matched = 0;
  let suggested = 0;
  let ignored = 0;
  let duplicatesCorrected = 0;
  const seenFingerprints = new Set();

  for (const storedTransaction of pendingTransactions) {
    const refreshedTransaction =
      refreshTransactionWithCurrentRules(storedTransaction);
    const transaction = refreshedTransaction.transaction;

    if (Object.keys(refreshedTransaction.updates).length) {
      await db.collection("reconciliationTransactions").updateOne(
        { _id: transaction._id, ownerId },
        {
          $set: {
            ...refreshedTransaction.updates,
            rematchedAt: now,
            updatedAt: now,
          },
        }
      );

      refreshed += 1;
    }

    const duplicateKeys = [
      transaction.normalizedFingerprint ||
        buildTransactionFingerprint(transaction),
      transaction.normalizedLooseFingerprint ||
        buildTransactionLooseFingerprint(transaction),
    ].filter(Boolean);

    if (duplicateKeys.some((key) => seenFingerprints.has(key))) {
      await db.collection("reconciliationTransactions").updateOne(
        { _id: transaction._id, ownerId },
        {
          $set: {
            status: "ignored",
            ignoredReason: "Duplicate transaction removed during rerun",
            suggestedInvoiceId: null,
            suggestedInvoiceNumber: "",
            suggestedInvoiceToken: "",
            suggestedCustomer: "",
            confidence: 0,
            rematchedAt: now,
            updatedAt: now,
          },
        }
      );

      duplicatesCorrected += 1;
      continue;
    }

    duplicateKeys.forEach((key) => seenFingerprints.add(key));

    const ruleFailure = getCurrentCreditRuleFailure(
      transaction,
      approvedCreditPhrases
    );

    if (ruleFailure) {
      await db.collection("reconciliationTransactions").updateOne(
        { _id: transaction._id, ownerId },
        {
          $set: {
            status: "ignored",
            ignoredReason: ruleFailure,
            suggestedInvoiceId: null,
            suggestedInvoiceNumber: "",
            suggestedInvoiceToken: "",
            suggestedCustomer: "",
            confidence: 0,
            rematchedAt: now,
            updatedAt: now,
          },
        }
      );

      ignored += 1;
      continue;
    }

    const best = chooseBestInvoiceMatch(transaction, invoices);

    if (best?.status === "matched") {
      const matchedInvoice = await markInvoicePaid(db, best.invoice, {
        paymentReference: transaction.reference,
        paidAmount: transaction.amount,
        paidAt: transaction.transactionDate || now,
        paymentProvider: "Bank Statement Upload",
        verificationMethod: "bank_statement_rematch",
        notificationStatus: best.invoice.phone ? "prepared" : "unavailable",
      });

      try {
        await deliverPaymentConfirmation({
          db,
          invoice: matchedInvoice,
          owner,
          amount: transaction.amount,
        });
      } catch (error) {
        console.error("RECONCILIATION REMATCH WHATSAPP CONFIRMATION ERROR:", error);
      }

      await db.collection("reconciliationTransactions").updateOne(
        { _id: transaction._id, ownerId },
        {
          $set: {
            status: "matched",
            confidence: best.confidence,
            matchedInvoiceId: matchedInvoice._id,
            matchedInvoiceNumber: getInvoiceToken(matchedInvoice),
            matchedInvoiceToken: getInvoiceToken(matchedInvoice),
            matchedCustomer: getInvoiceCustomerName(matchedInvoice),
            suggestedInvoiceId: null,
            suggestedInvoiceNumber: "",
            suggestedInvoiceToken: "",
            suggestedCustomer: "",
            matchReasons: best.reasons || [],
            rematchedAt: now,
            updatedAt: now,
          },
        }
      );

      invoices = invoices
        .map((invoice) =>
          String(invoice._id) === String(matchedInvoice._id)
            ? matchedInvoice
            : invoice
        )
        .filter((invoice) => getInvoiceOutstandingAmount(invoice) > 0);

      matched += 1;
      continue;
    }

    if (!best || best.status !== "suggested_match") {
      await db.collection("reconciliationTransactions").updateOne(
        { _id: transaction._id, ownerId },
        {
          $set: {
            status:
              transaction.status === "overpayment"
                ? "overpayment"
                : transaction.status === "pending_review"
                  ? "pending_review"
                  : "pending_review",
            confidence: best?.confidence || 0,
            suggestedInvoiceId: null,
            suggestedInvoiceNumber: "",
            suggestedInvoiceToken: "",
            suggestedCustomer: "",
            reviewReason:
              transaction.status === "pending_review"
                ? transaction.reviewReason ||
                  "Needs user validation before marking unmatched"
                : "Needs user validation before marking unmatched",
            matchReasons: best?.reasons || [],
            rematchedAt: now,
            updatedAt: now,
          },
        }
      );

      continue;
    }

    await db.collection("reconciliationTransactions").updateOne(
      { _id: transaction._id, ownerId },
      {
        $set: {
          status: "suggested_match",
          confidence: best.confidence,
          suggestedInvoiceId: best.invoice._id,
          suggestedInvoiceNumber: getInvoiceToken(best.invoice),
          suggestedInvoiceToken: getInvoiceToken(best.invoice),
          suggestedCustomer: getInvoiceCustomerName(best.invoice),
          matchReasons: best.reasons || [],
          rematchedAt: now,
          updatedAt: now,
        },
      }
    );

    suggested += 1;
  }

  const visibleTransactions = dedupeTransactionRecords(
    await db
      .collection("reconciliationTransactions")
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .limit(300)
      .toArray()
  );

  const visibleQueues = visibleTransactions.reduce(
    (queues, transaction) => {
      const status = String(transaction.status || "").toLowerCase();

      if (status === "matched") queues.matched += 1;
      if (status === "suggested_match") queues.suggested += 1;
      if (status === "unmatched") queues.unmatched += 1;

      if (
        ["overpayment", "pending_review", "duplicate", "rejected"].includes(
          status
        )
      ) {
        queues.review += 1;
      }

      return queues;
    },
    {
      matched: 0,
      suggested: 0,
      unmatched: 0,
      review: 0,
    }
  );

  return {
    scannedTransactions: pendingTransactions.length + matchedTransactions.length,
    visibleTransactions: visibleTransactions.length,
    openInvoices: invoices.length,
    matched,
    suggested,
    ignored,
    duplicatesCorrected,
    refreshed,
    matchedFlaggedForReview,
    visibleQueues,
  };
}
