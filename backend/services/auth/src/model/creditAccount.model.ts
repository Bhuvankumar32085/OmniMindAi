import mongoose, { Document, Schema } from "mongoose";

export interface ICreditAccount extends Document {
  userId: string;
  balance: number;
  totalGranted: number;
  totalPurchased: number;
  totalConsumed: number;
  reserved: number;
  createdAt: Date;
  updatedAt: Date;
}

const creditAccountSchema = new Schema<ICreditAccount>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 100,
      min: 0,
    },
    totalGranted: {
      type: Number,
      default: 100,
    },
    totalPurchased: {
      type: Number,
      default: 0,
    },
    totalConsumed: {
      type: Number,
      default: 0,
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const CreditAccount = mongoose.model<ICreditAccount>(
  "CreditAccount",
  creditAccountSchema
);

export default CreditAccount;
