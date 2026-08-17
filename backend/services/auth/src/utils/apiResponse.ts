import { Response } from "express";

export const sendSuccess = (
  res: Response,
  message: string,
  data: any = null, //data parameter ka type = any , default value = null
  statusCode = 200, //  default status code 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  data: any = null,
  statusCode = 400,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
};