import mongoose from "mongoose";

const QuickPayProfileSchema = new mongoose.Schema({
  token: String,
  ownerId: String,
  customerId: String,
  customerToken: String,
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  businessName: String,
  businessLogo: String,
  description: String,
  amount: Number,
  gateway: String,
  active: Boolean,
  createdAt: Date,
  updatedAt: Date,
});

export default mongoose.models.QuickPayProfile ||
  mongoose.model("QuickPayProfile", QuickPayProfileSchema);
