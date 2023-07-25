import { Contract } from "fabric-network";
declare module 'asn1.js';

export type Election = {
  electionID?: string;
  electionName: string;
  electionLocation: string;
  electionDate: string[];
  electionShowResult: boolean;
  owner: string;
  docType: string;
};

export type Participant = {
  participantID?: number;
  participantRegisterID: number;
  participantName: string;
  electionID?: string;
  docType: string;
};

export type Ballot = {
  ballotID?: string;
  electionID: string;
  ballotVotableItem: string;
  pick?: string;
  isCasted: boolean;
  isDeleted: boolean;
  docType: string;
};

export type Candidate = {
  candidateID?: string;
  candidateName: string;
  candidateDescription: string;
  candidatePhotoURL?: string;
  docType: string;
};

export const enum HLDocType {
  Election = "Election",
  Participant = "Participant",
  Ballot = "Ballot",
  Candidates = "Candidate",
}

export type JobData = {
  uid: string;
  txName: string;
  txArgs: string[];
  txState?: Buffer;
  txIds: string[];
};

export type JobResult = {
  txPayload?: Buffer;
  txError?: string;
};

export type JobSummary = {
  jobId: string;
  txIds: string[];
  txPayload?: string;
  txError?: string;
};

export const enum CreateElectionStep {
  CreateElection,
  CreateCandidates,
  RegisterFabricCA,
  CreateBallot,
  Finish,
}

export type createElectionJobTxID = {
  stepName: any;
  txId: string[];
};

export type createElectionStepDetail = {
  step: any;
  txPayload:string;
  txSubmitJobsId: string;
};

export type createElectionJobData = {
  step: any;
  uid: string;
  currentStatus?:string;
  progress?: number | undefined;
  createTempData?: TempCreateElectionData;
  electionData?: object | unknown;
};

export type createElectionJobResult = {
  txSubmitList : createElectionStepDetail[];
};

export type electionReqBodyDataType = {
  electionName: string;
  electionDate: string[];
  electionLocation: string;
  candidateList: Candidates[];
  participantList: Participant[];
};

export type TempCreateElectionData = {
  electionId?: string;
  candidateList?: string[];
}

export type CCResponse = {
  status?:number;
  message?:string;
  error?:striing;
}

export type ContractList = {
  qsccContract:Contract;
  assetContract:Contract;
}