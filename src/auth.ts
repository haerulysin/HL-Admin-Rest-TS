import { NextFunction, Request, Response } from "express";
import { HeaderAPIKeyStrategy } from "passport-headerapikey";
import passport from "passport";
import { getReasonPhrase } from "http-status-codes";

export const fabricAPIKeyStrategy: HeaderAPIKeyStrategy =
  new HeaderAPIKeyStrategy(
    { header: "x-api-key", prefix: "" },
    true,
    (apiKey: string, done, req) => {
      if (!req?.app.locals[apiKey]) {
        return done(null, false);
      }
      return done(null, apiKey);
    }
  );

export const passportAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  passport.authenticate(
    "headerapikey",
    { session: false },
    (err: Error, user: string, _info: any) => {
      if (!user) {
        return res.status(401).json({
          status: getReasonPhrase(401),
          reason: "NO_VALID_APIKEY",
          timestamp: new Date().toISOString(),
        });
      }
      req.logIn(user, { session: false }, async (err) => {
        if (err) return next(err);
        return next();
      });
    }
  )(req, res, next);
};
