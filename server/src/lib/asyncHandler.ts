import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Forwards rejected async route handlers into Express's error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
