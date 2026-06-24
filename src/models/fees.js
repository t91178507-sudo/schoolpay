import mongoose from "mongoose";

const FeeSchema = new mongoose.Schema({
  className: String,
  amount: Number,
});

export default mongoose.models.Fee ||
  mongoose.model("Fee", FeeSchema);