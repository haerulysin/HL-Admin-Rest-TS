import { JobData, Queue, Worker } from "bullmq";
import createServer from "./server.js";
import dotenv from "dotenv";
import { createWallet, createGateway, getNetwork, GetContract, pingChaincode } from "./fabric.js";
import { initJobQueue, initJobWorker } from "./jobs.js";
import { ContractList, JobResult } from "./utils/types.js";
import { initCreateElectionJobs, initCreateElectionWorker } from "./services/createElectionJobs.js";
import * as config from './utils/config.js';
import { enrollUser } from "./fabric.ca.js";

let jobQueue: Queue | undefined;
let createElectionJobQueue: Queue | undefined;
let jobQueueWorker: Worker | undefined;
let createElectionJobQueueWorker: Worker | undefined;
async function main() {
  dotenv.config();
  const app = await createServer();

  //DEV
  //START SET DEFAULT ADMIN
  const { uid, wallet } = await createWallet(config.ADMIN_CB64, config.ADMIN_PB64);
  const gw = await createGateway(wallet, uid);
  const nw = await getNetwork(gw);
  const cc = await GetContract(nw);
  app.locals[uid] = cc as ContractList;
  //END SET DEFAULT ADMIN

  //test
  const x = await enrollUser('evoteadmin','evoteadminpw');
  //

  jobQueue = initJobQueue();
  jobQueueWorker = initJobWorker(app);
  app.locals.jobq = jobQueue;
  createElectionJobQueue = initCreateElectionJobs();
  createElectionJobQueueWorker = initCreateElectionWorker(app);
  app.locals.cjobq = createElectionJobQueue;
  let rep = await createElectionJobQueue.getRepeatableJobs();
  rep.forEach(async job=>{
    await createElectionJobQueue?.removeRepeatableByKey(job.key)
  })
  createElectionJobQueue.drain(true);

  let rep2 = await jobQueue.getRepeatableJobs();
  rep2.forEach(async j => {
    await jobQueue?.removeRepeatableByKey(j.key)
  });
  jobQueue.drain(true);
  console.log(`Contract Initialized ( ${uid} )`)
}

main().catch(async(err)=> {
  if(jobQueue!=undefined){
    await jobQueue.close();
  }

  if(jobQueueWorker!=undefined){
    await jobQueueWorker.close();
  }

});
