import mongoose, { Document, Schema } from "mongoose";

export enum PurchaseStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export interface IPurchase extends Document {
  userId: string;
  planId: string;
  amount: number; // in paise
  currency: string;
  creditsGranted: number;
  status: PurchaseStatus;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    creditsGranted: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PurchaseStatus),
      default: PurchaseStatus.PENDING,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    razorpaySignature: String,
  },
  { timestamps: true }
);

const Purchase = mongoose.model<IPurchase>("Purchase", purchaseSchema);

export default Purchase;
