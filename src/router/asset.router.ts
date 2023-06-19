import express, { Request, Response } from "express";
import { getReasonPhrase } from "http-status-codes";
import { enrollUser, registerUser } from "../fabric.ca.js";
import { X509Certificate, createHash, createPrivateKey } from "crypto";
import { body, validationResult } from "express-validator";
import { Contract } from "fabric-network";
import { evaluateTransaction } from "../fabric.js";
import { Job, Queue } from "bullmq";
import { addSubmitTransactionJob } from "../jobs.js";
import { JobResult, JobData, JobSummary, ContractList } from "../utils/types.js";

export const AssetRouter = express.Router();

AssetRouter.get("/", async (req: Request, res: Response) => {
  try {
    const contract = req.app.locals[req.user as string];
    const buffer = await evaluateTransaction(contract, "GetAllAsset");
    const data: any[] = JSON.parse(buffer.toString());
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(err.status).json({
      status: getReasonPhrase(err.status),
      reason: err.message,
    });
  }
});

AssetRouter.get('/:assetId', async(req:Request, res:Response) => {

  try{

    const contract = (req.app.locals[req.user as string] as ContractList).assetContract;
    const electionData = await evaluateTransaction(contract,'ReadAsset',req.params.assetId);
    return res.status(200).json(JSON.parse(Buffer.from(electionData as Buffer).toString()));

  }catch(e:any){
    let statuscode = 500;
    if(e.status){
      statuscode = e.status
    }
    return res.status(statuscode).json({
      status:getReasonPhrase(statuscode),
      message:e.message,
      timestamp: new Date().toISOString()
    })
  }
});