import mongoose, { Document, Schema } from "mongoose";

export enum TransactionType {
  FREE_GRANT = "FREE_GRANT",
  PURCHASE = "PURCHASE",
  USAGE = "USAGE",
  REFUND = "REFUND",
  ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT",
}

export interface ICreditTransaction extends Document {
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  referenceId: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const creditTransactionSchema = new Schema<ICreditTransaction>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      default: "SYSTEM",
    },
    referenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const CreditTransaction = mongoose.model<ICreditTransaction>(
  "CreditTransaction",
  creditTransactionSchema
);

export default CreditTransaction;
