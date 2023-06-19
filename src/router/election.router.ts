import express, { Request, Response, Router } from "express";
import { body, validationResult } from "express-validator";
import { getReasonPhrase } from "http-status-codes";
import { Queue } from "bullmq";
import {
  ContractList,
  CreateElectionStep,
  electionReqBodyDataType,
} from "../utils/types.js";
import { getJobSummary } from "../jobs.js";
import { createNewElectionTransactionJob } from "../services/createElectionJobs.js";
import { Contract } from "fabric-network";
import { evaluateTransaction } from "../fabric.js";

export const ElectionRouter: Router = express.Router();

ElectionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const contract = (req.app.locals[req.user as string] as ContractList)
      .assetContract as Contract;
    const data = await evaluateTransaction(contract, "GetElectionList");
    let assets = [];
    if (data.length > 0) {
      assets = JSON.parse(data.toString());
    }
    return res.status(200).json(assets);
  } catch (e: any) {
    return res.status(e.status).json({
      status: getReasonPhrase(e.status),
      reason: e.message,
      timestamp: new Date().toISOString(),
    });
  }
});
ElectionRouter.post(
  "/create",
  body("electionName").notEmpty(),
  body("electionDate").notEmpty(),
  body("electionLocation").notEmpty(),
  body("candidateList").notEmpty(),
  body("participantList").notEmpty(),
  async (req: Request, res: Response) => {
    const validation = validationResult(req);
    const bodyData: electionReqBodyDataType = req.body;
    if (!validation.isEmpty()) {
      return res.status(400).json({
        status: getReasonPhrase(400),
        message: "VALIDATION_ERROR",
        error: validation.array(),
        timestamp: new Date().toISOString(),
      });
    }
    const bodyDataSizeMB = (
      Buffer.byteLength(JSON.stringify(bodyData)) /
      (1024 * 1024)
    ).toFixed(2);
    try {
      const jqueue = req.app.locals.cjobq as Queue;
      const uid = req.user as string;
      // const jobid = await createNewElectionTransactionJob(
      //   jqueue,
      //   bodyData,
      //   uid
      // );
      return res.status(200).json({
        jobId: 110,
      });
    } catch (err) {
      console.log(err);
    }
  }
);

ElectionRouter.get("/jobs/:jobsid", async (req, res) => {
  try {
    const jq: Queue = req.app.locals.cjobq;
    const jobd = await jq.getJob(req.params.jobsid);
    const percentProgress = (jobd?.data.step / CreateElectionStep.Finish) * 100;
    let status = 201;
    if (jobd?.data.step === CreateElectionStep.Finish) {
      status = 200;
    }
    return res.status(status).json({
      status: getReasonPhrase(status),
      progress: percentProgress,
    });
  } catch (err) {
    return res.status(500).json({
      status: getReasonPhrase(500),
    });
  }
});

ElectionRouter.get("/jj/:jid", async (req, res) => {
  const jj: Queue = req.app.locals.jobq;
  const sm = await getJobSummary(jj, req.params.jid);
  res.send(JSON.stringify(sm));
});
