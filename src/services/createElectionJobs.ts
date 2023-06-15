import { Queue, Worker, ConnectionOptions, Job } from "bullmq";
import * as config from "../utils/config.js";
import { Application } from "express";
import {
  CreateElectionStep,
  createElectionJobData,
  createElectionJobResult,
  electionReqBodyDataType,
  JobData,
  JobResult,
  JobSummary,
  createElectionStepDetail,
  CCResponse,
  Participant,
} from "../utils/types.js";
import {
  CreateBallotServices,
  CreateCandidatesServices,
  CreateElectionServices,
  RegisterFabricCAServices,
} from "./createElection.js";
import { getJobSummary } from "../jobs.js";
// import { InitialStep } from "./createElection.js";

const redisConnection: ConnectionOptions = {
  host: config.redisHost,
  port: config.redisPort,
  username: config.redisUsername,
  password: config.redisPassword,
};

export const createNewElectionTransactionJob = async (
  jqueue: Queue<createElectionJobData, createElectionJobResult>,
  electionData: object | unknown,
  uid: string
) => {
  const job = await jqueue.add(config.CREATE_ELECTION_QUEUE_NAME, {
    // step: CreateElectionStep.RegisterFabricCA,
    step: CreateElectionStep.CreateElection,
    electionData,
    uid,
  });

  if (job.id === undefined) {
    throw new Error("Create Election Job ID not available");
  }
  return job.id;
};

export const initCreateElectionJobs = (): Queue => {
  const createElectionQueue: Queue = new Queue(
    config.CREATE_ELECTION_QUEUE_NAME,
    { connection: redisConnection }
  );
  return createElectionQueue;
};

export const initCreateElectionWorker = (app: Application): Worker => {
  const createElectionWorker = new Worker<
    createElectionJobData,
    createElectionJobResult
  >(
    config.CREATE_ELECTION_QUEUE_NAME,
    async (job, token) => {
      const txSubmitJob: Queue = app.locals.jobq;
      let step = job.data.step;
      let stepJobId: string = "";
      while (step !== CreateElectionStep.Finish) {
        switch (step) {
          case CreateElectionStep.CreateElection: {
            const generatedElectionID: string = await CreateElectionServices(
              app,
              job.data.electionData as electionReqBodyDataType,
              job.data.uid
            );
            await job.update({
              ...job.data,
              step: CreateElectionStep.CreateCandidates,
              createTempData: { electionId: generatedElectionID as string },
            });
            step = CreateElectionStep.CreateCandidates;
            break;
          }

          case CreateElectionStep.CreateCandidates: {
            const electionData = job.data
              .electionData as electionReqBodyDataType;
            const submittedCandidates = await CreateCandidatesServices(
              app,
              electionData.candidateList,
              job.data.createTempData?.electionId as string,
              job.data.uid
            );
            await job.update({
              ...job.data,
              step: CreateElectionStep.RegisterFabricCA,
            });
            step = CreateElectionStep.RegisterFabricCA;
            break;
          }

          case CreateElectionStep.RegisterFabricCA: {
            const participantList: Participant[] = (
              job.data.electionData as electionReqBodyDataType
            ).participantList;
            const registerIdentities = await RegisterFabricCAServices(
              participantList,
              job.data.uid as string
            );

            await job.update({
              ...job.data,
              step: CreateElectionStep.CreateBallot,
            });

            step = CreateElectionStep.CreateBallot;
            break;
          }

          case CreateElectionStep.CreateBallot: {
            let currentStatus: string = "";
            const participantList: Participant[] = (
              job.data.electionData as electionReqBodyDataType
            ).participantList;
            try {
              const createBallot = await CreateBallotServices(
                app,
                participantList,
                job.data.createTempData?.electionId as string,
                job.data.uid as string
              );
              currentStatus = createBallot;
            } catch (e: any) {
              currentStatus = e.message;
            }
            await job.update({
              ...job.data,
              step: CreateElectionStep.Finish,
              currentStatus,
            });

            console.log(job.data);
            step = CreateElectionStep.Finish;
            return step;
          }
          default: {
            throw new Error("Invalid Step");
          }
        }
      }
    },
    { connection: redisConnection }
  );
  return createElectionWorker;
};
