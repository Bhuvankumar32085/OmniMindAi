import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";

export const isAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Please Login",
    });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Forbidden: Admin role required",
    });
    return;
  }

  next();
};
