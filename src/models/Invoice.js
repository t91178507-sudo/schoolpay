import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema({
  customer: String,
  customerName: String,
  category: String,
  phone: String,
  email: String,
  token: String,
  amount: Number,
  status: String,
  date: Date,
  businessName: String,
  customerToken: String,
  paymentReference: String,
  paymentProvider: String,
  paymentVerificationMethod: String,
  paidAt: Date,
  paidAmount: Number,
  pendingPaymentReference: String,
  pendingPaymentAmount: Number,
  pendingPaymentProvider: String,
  pendingPaymentCreatedAt: Date,
});

export default mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
