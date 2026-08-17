import mongoose, { Schema } from "mongoose";

export interface IAIUsage {
  userId: string;
  conversationId?: string;
  taskId?: string;
  messageId?: string;
  agent: string;
  model?: string;
  creditCost: number;
  status: "success" | "failed";
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const aiUsageSchema = new Schema<IAIUsage>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      index: true,
    },
    taskId: {
      type: String,
      index: true,
    },
    messageId: String,
    agent: {
      type: String,
      required: true,
    },
    model: String,
    creditCost: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },
    inputTokens: Number,
    outputTokens: Number,
    totalTokens: Number,
  },
  { timestamps: true }
);

const AIUsage = mongoose.model<IAIUsage>("AIUsage", aiUsageSchema);

export default AIUsage;
