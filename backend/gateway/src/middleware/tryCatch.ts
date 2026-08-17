import { Request, Response, RequestHandler, NextFunction } from "express";

const tryCatch = (handler: RequestHandler): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error("Error in handler:", error);
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };
};

export default tryCatch;