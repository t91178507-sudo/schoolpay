import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema({
  student: String,
  phone: String,
  token: String,
  amount: Number,
  status: String,
  date: Date,
});

export default mongoose.models.Invoice ||
  mongoose.model("Invoice", InvoiceSchema);
``