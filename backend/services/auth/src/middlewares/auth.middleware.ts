import { Request, Response, NextFunction } from "express";
import User, { UserRole } from "../model/user.model.js";

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
}

export const isAuthHeader = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized - User ID header missing",
    });
    return;
  }
  next();
};

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const userRole = req.headers["x-user-role"] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (userRole === UserRole.ADMIN) {
      next();
      return;
    }

    // Fallback DB check for bulletproof role verification
    const user = await User.findById(userId);
    if (!user || user.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during authorization check",
    });
  }
};
