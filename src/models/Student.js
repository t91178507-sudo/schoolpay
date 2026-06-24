import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  name: String,
  class: String,
  parent: String,
  phone: String, // ✅ (important for WhatsApp)

  token: {
    type: String,
    unique: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Student ||
  mongoose.model("Student", StudentSchema);