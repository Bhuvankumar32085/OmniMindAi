import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL as string);
    console.log("Auth DB Connected");
  } catch (err) {
    console.error("AUTH DB connection error", err);
  }
};