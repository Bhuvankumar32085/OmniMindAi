import mongoose, { Document } from "mongoose";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export interface IUser extends Document {
  name: string;
  firebaseUID?: string;
  email: string;
  avatar: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    firebaseUID: {
      type: String,
      unique: true,
    },
    name: String,
    email: String,
    avatar: String,
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
  },
  { timestamps: true },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;

