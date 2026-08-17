import mongoose, { Document, Schema } from "mongoose";

export interface IPlan extends Document {
  name: string;
  description: string;
  price: number; // in paise
  currency: string;
  credits: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    credits: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: String,
  },
  { timestamps: true }
);

const Plan = mongoose.model<IPlan>("Plan", planSchema);

export default Plan;
