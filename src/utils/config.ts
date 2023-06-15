import dotenv from 'dotenv';
import env from "env-var";

dotenv.config();
export const ORG: string = env.get("ORG_NAME").default("SampleOrg").asString();
export const MSPID: string = env.get("MSP_ID").default("SampleOrg").asString();
export const JOB_QUEUE_NAME = "submitContract";
export const CREATE_ELECTION_QUEUE_NAME='CreateElection';

export const port = env
  .get("PORT")
  .default("3000")
  .example("3000")
  .asPortNumber();

export const asLocalhost: boolean = env
  .get("AS_LOCAL_HOST")
  .default("true")
  .example("true")
  .asBoolStrict();

export const channelName: string = env
  .get("HLF_CHANNEL_NAME")
  .default("ch1")
  .asString();

export const chaincodeName: string = env
  .get("HLF_CHAINCODE_NAME")
  .default("mycc")
  .example("evote")
  .asString();

//Fabric-CA Config
export const fabricAdminUser: string = env
  .get("HLF_CA_ADMIN_USER")
  .default("admin")
  .asString();
export const fabricAdminPw: string = env
  .get("HLF_CA_ADMIN_PW")
  .default("adminpw")
  .asString();

export const fabricCAHostname: string = env
  .get("HLF_CA_HOSTNAME")
  .default("http://localhost:7054")
  .asString();

//REDIS
export const redisPort = env.get("REDIS_PORT").default("6379").asPortNumber();
export const redisHost: string = env
  .get("REDIS_HOST")
  .default("localhost")
  .asString();
export const redisUsername: string = env
  .get("REDIS_USERNAME")
  .default("default")
  .asString();
export const redisPassword: string = env
  .get("REDIS_PASSWORD")
  .default("12345678")
  .asString();

export const submitJobBackoffType = env
  .get("SUBMIT_JOB_BACKOFF_TYPE")
  .default("fixed")
  .asEnum(["fixed", "exponential"]);

export const submitJobBackoffDelay = env
  .get("SUBMIT_JOB_BACKOFF_DELAY")
  .default("3000")
  .example("3000")
  .asIntPositive();

export const submitJobAttempts = env
  .get("SUBMIT_JOB_ATTEMPTS")
  .default("5")
  .example("5")
  .asIntPositive();

export const submitJobConcurrency = env
  .get("SUBMIT_JOB_CONCURRENCY")
  .default("5")
  .example("5")
  .asIntPositive();

export const maxCompletedSubmitJobs = env
  .get("MAX_COMPLETED_SUBMIT_JOBS")
  .default("1000")
  .example("1000")
  .asIntPositive();

export const maxFailedSubmitJobs = env
  .get("MAX_FAILED_SUBMIT_JOBS")
  .default("1000")
  .example("1000")
  .asIntPositive();

export const submitJobQueueScheduler = env
  .get("SUBMIT_JOB_QUEUE_SCHEDULER")
  .default("true")
  .example("true")
  .asBoolStrict();