import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  password: String,
  businessName: String,
  businessType: String,
  businessLogo: String,
  businessEmail: String,
  businessPhone: String,
  businessAddress: String,
  website: String,
  taxId: String,
  defaultPaymentGateway: String,
  paymentGateways: mongoose.Schema.Types.Mixed,
  defaultWhatsAppProvider: String,
  whatsappProviders: mongoose.Schema.Types.Mixed,
  role: String,
  createdAt: Date,
  lastActive: Date,
});

export default mongoose.models.User || mongoose.model("User", UserSchema);
