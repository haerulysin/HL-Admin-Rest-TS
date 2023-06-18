import { ConnectionOptions, Queue, Job, Worker } from "bullmq";
import * as config from "./utils/config.js";
import { Application } from "express";
import { ContractList, JobData, JobResult, JobSummary } from "./utils/types.js";
import { Contract, Transaction } from "fabric-network";
import { submitTransaction } from "./fabric.js";
import {
  JobNotFoundError,
  RetryAction,
  getRetryAction,
} from "./utils/errors.js";
const redisConnection: ConnectionOptions = {
  host: config.redisHost,
  port: config.redisPort,
  username: config.redisUsername,
  password: config.redisPassword,
};

export const initJobQueue = (): Queue => {
  const submitQueue: Queue = new Queue(config.JOB_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: config.submitJobAttempts,
      backoff: {
        type: config.submitJobBackoffType,
        delay: config.submitJobBackoffDelay,
      },
      removeOnComplete: config.maxCompletedSubmitJobs,
      removeOnFail: config.maxFailedSubmitJobs,
    },
  });

  return submitQueue;
};

export const initJobWorker = (app: Application): Worker => {
  const worker = new Worker<JobData, JobResult>(
    config.JOB_QUEUE_NAME,
    async (job): Promise<JobResult> => {
      return await processSubmitTransactionJob(app, job);
    },
    { connection: redisConnection, concurrency: config.submitJobConcurrency }
  );

  return worker;
};

export const addSubmitTransactionJob = async (
  submitQueue: Queue<JobData, JobResult>,
  uid: string,
  txName: string,
  ...txArgs: string[]
): Promise<string> => {
  const jobName = `submit ${txName} transaction`;
  const job = await submitQueue.add(jobName, {
    uid,
    txName,
    txArgs,
    txIds: [],
  });

  if (job?.id === undefined) {
    throw new Error("Submit transaction job ID not available");
  }

  return job.id;
};

export const processSubmitTransactionJob = async (
  app: Application,
  job: Job<JobData, JobResult>
): Promise<JobResult> => {
  const contract = (app.locals[job.data.uid] as ContractList)
    .assetContract as Contract;

  if (contract === undefined)
    return { txError: undefined, txPayload: undefined };

  const args = job.data.txArgs;
  let transaction: Transaction;

  if (job.data.txState) {
    const savedState = job.data.txState;
    transaction = contract.deserializeTransaction(savedState);
  } else {
    transaction = contract.createTransaction(job.data.txName);
    await updateJobData(job, transaction);
  }

  try {
    const payload = await submitTransaction(transaction, ...args);
    return {
      txError: undefined,
      txPayload: payload,
    };
  } catch (err) {
    const retryAction = getRetryAction(err);
    if (retryAction === RetryAction.None) {
      return {
        txError: `${err}`,
        txPayload: undefined,
      };
    }

    if (retryAction === RetryAction.WithNewTransactionId) {
      await updateJobData(job, undefined);
    }
    throw err;
  }
};

export const updateJobData = async (
  job: Job<JobData, JobResult>,
  transaction: Transaction | undefined
): Promise<void> => {
  const newData = { ...job.data };

  if (transaction != undefined) {
    const txids = ([] as string[]).concat(
      newData.txIds,
      transaction.getTransactionId()
    );

    newData.txIds = txids;
    newData.txState = transaction.serialize();
  } else {
    newData.txState = undefined;
  }
  await job.update(newData);
};

export const getJobSummary = async (
  queue: Queue,
  jobId: string
): Promise<JobSummary> => {
  const job: Job<JobData, JobResult> | undefined = await queue.getJob(jobId);
  if (!(job && job.id != undefined)) {
    throw new JobNotFoundError(`Job ${jobId} not found`, jobId);
  }

  let txIds: string[];

  if (job.data && job.data.txIds) {
    txIds = job.data.txIds;
  } else {
    txIds = [];
  }

  let txError;
  let txPayload;

  const returnValue = job.returnvalue;
  if (returnValue) {
    if (returnValue.txError) {
      txError = returnValue.txError;
    }
    if (returnValue.txPayload) {
      txPayload = Buffer.from(returnValue.txPayload as Buffer).toString();
    } else {
      txPayload = "";
    }
  }

  const jobSummary: JobSummary = {
    jobId: job.id,
    txIds,
    txError,
    txPayload,
  };

  return jobSummary;
};
