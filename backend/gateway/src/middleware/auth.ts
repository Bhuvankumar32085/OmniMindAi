import { Request, Response, NextFunction } from "express";
import redis from "../configs/redis.js";

export interface IUser {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: IUser | null;
}

export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const sessionID = req.cookies.session;
    if (!sessionID) {
      res.status(401).json({
        success: false,
        message: "Please Login - sessionID missing",
      });
      return;
    }

    const session = await redis.get(`session-${sessionID}`);
    if (!session) {
      res.status(401).json({
        success: false,
        message: "Please Login - session expired",
      });
      return;
    }
    req.user = JSON.parse(session!);
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Please Login",
    });
  }
};
