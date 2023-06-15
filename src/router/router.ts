import express from "express";
import { authRouter } from "./auth.router.js";
import { Contract } from "fabric-network";
import { AssetRouter } from "./asset.router.js";
import { fabricAPIKeyStrategy, passportAuthMiddleware } from "../auth.js";
import { ElectionRouter } from "./election.router.js";

export const router = express.Router();

const routeList = [
  { path: "/auth", route: authRouter },
  { path: "/asset", route: AssetRouter },
  { path: "/election", route: ElectionRouter },
];

for (let r of routeList) {
  if (r.path == "/auth") {
    router.use(r.path, r.route);
    continue;
  }
  router.use(r.path, passportAuthMiddleware, r.route);
}