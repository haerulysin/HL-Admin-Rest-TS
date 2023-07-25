import express, { Request, Response } from "express";
import { getReasonPhrase } from "http-status-codes";
import { enrollUser, registerUser } from "../fabric.ca.js";
import { X509Certificate, createHash, createPrivateKey } from "crypto";
import { body, validationResult } from "express-validator";
import { Contract } from "fabric-network";

import {
  createWallet,
  createGateway,
  getNetwork,
  GetContract,
  pingChaincode,
} from "../fabric.js";
import { passportAuthMiddleware } from "../auth.js";
import { ContractList } from "../utils/types.js";

export const authRouter = express.Router();

const testCert = (pub: string, prv: string): any => {
  const deCert = Buffer.from(pub, "base64").toString("ascii");
  try {
    new X509Certificate(deCert);
    return 200;
  } catch (err) {
    return err;
  }
};
authRouter.post(
  "/login",
  body().isObject().withMessage("Body must contain an asset object"),
  body("certificate", "must be a base64 string").notEmpty(),
  body("privateKey", "must be a base64 string").notEmpty(),
  async (req: Request, res: Response) => {
    const validation = validationResult(req);

    if (!validation.isEmpty()) {
      return res.status(400).json({
        status: getReasonPhrase(400),
        reason: "VALIDATION_ERROR",
        message: "Invalid request body",
        timestamp: new Date().toISOString(),
        errors: validation.array(),
      });
    }

    const certb64 = req.body.certificate;
    const privKeyb64 = req.body.privateKey;
    const tcert = testCert(certb64, privKeyb64);

    if (tcert !== 200) {
      return res.status(401).json({
        status: getReasonPhrase(401),
        reason: "Client ECERT wrong format",
        error: tcert,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const { uid, wallet } = await createWallet(certb64, privKeyb64);
      const gw = await createGateway(wallet, uid);
      const nw = await getNetwork(gw);
      const cc = await GetContract(nw);
      const pingCC = await pingChaincode(cc.assetContract);
      return res.status(200).json({
        status: getReasonPhrase(200),
        uid: uid,
      });
    } catch (e: any) {
      res.status(500).json({
        status: getReasonPhrase(500),
        reason: e.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

authRouter.get(
  "/ping",
  passportAuthMiddleware,
  async (req: Request, res: Response) => {
    const ApiKey = req.user as string;
    const contract: Contract = (req.app.locals[ApiKey] as ContractList).assetContract;
    if (!contract) {
      return res.status(400).json({
        status: getReasonPhrase(400),
        message: "X-API-KEY Not Available, Try login/enroll first.",
      });
    }
    try {
      await pingChaincode(contract);
      return res.status(200).json({
        status: getReasonPhrase(200),
        api_keys: ApiKey,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: getReasonPhrase(500),
        timestamp: new Date().toISOString(),
      });
    }
  }
);