import { Queue, ConnectionOptions, Worker, Job } from "bullmq";
import * as config from "../utils/config.js";
import {
  Candidate,
  ContractList,
  Election,
  HLDocType,
  Participant,
  electionReqBodyDataType,
} from "../utils/types.js";
import { Application } from "express";
import { addSubmitTransactionJob } from "../jobs.js";
import { Contract } from "fabric-network";
import { createHash } from "crypto";
import { registerUser } from "../fabric.ca.js";
import { handleError } from "../utils/errors.js";

export const CreateElectionServices = async (
  app: Application,
  electionData: electionReqBodyDataType,
  uid: string
): Promise<string> => {
  const election: Election = {
    electionName: electionData.electionName,
    electionDate: electionData.electionDate,
    electionLocation: electionData.electionLocation,
    electionShowResult: false,
    owner: uid,
    docType: HLDocType.Election,
  };
  // const submitQueue = app.locals.jobq as Queue;
  // const jobid = await addSubmitTransactionJob(submitQueue, uid, 'CreateElection', JSON.stringify(election));
  try {
    const contract = (app.locals[uid] as ContractList)
      .assetContract as Contract;
    const resp = await contract.submitTransaction(
      "CreateElection",
      JSON.stringify(election)
    );
    const result = JSON.parse(Buffer.from(resp as Buffer).toString());
    return result.message;
  } catch (err: any) {
    throw handleError("0", err);
  }
};

export const CreateCandidatesServices = async (
  app: Application,
  candidatesData: Candidate[],
  electionId: string,
  uid: string
): Promise<string> => {
  let candidateList: Candidate[] = [];
  candidatesData.forEach((data) => {
    candidateList.push({
      ...data,
      docType: HLDocType.Candidates,
    });
  });
  const contract = (app.locals[uid] as ContractList).assetContract as Contract;
  const resp = await contract.submitTransaction(
    "CreateCandidate",
    JSON.stringify(candidateList),
    electionId
  );
  const result = JSON.parse(Buffer.from(resp as Buffer).toString());
  return result.message;
};

export const CreateBallotServices = async (
  app: Application,
  participantData: Participant[],
  electionId: string,
  uid: string
): Promise<string> => {
  try {
    const contract = (app.locals[uid] as ContractList)
      .assetContract as Contract;
    const participantList: string[] = [];

    participantData.forEach(async (value) => {
      const data: Participant = value;
      data.docType = HLDocType.Participant;
      const participantHash = createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
      participantList.push(participantHash);
    });
    const submit = await contract.submitTransaction(
      "CreateBallot",
      JSON.stringify({ data: participantList }),
      electionId
    );
    return JSON.parse(Buffer.from(submit as Buffer).toString()).message;
  } catch (e) {
    throw handleError("0", e);
  }
};

export const RegisterFabricCAServices = async (
  participantData: Participant[],
  electionID: string,
  uid: string
): Promise<string[]> => {
  let participantHashList: string[] = [];
  participantData.forEach(async (value) => {
    const data: Participant = value;
    data.docType = HLDocType.Participant;
    const participantHash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    const x = await registerUser(participantHash, electionID, uid);
    participantHashList.push(participantHash);
  });
  return participantHashList;
};