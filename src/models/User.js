import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  businessName: String,
});

export default mongoose.models.User || mongoose.model("User", UserSchema);
