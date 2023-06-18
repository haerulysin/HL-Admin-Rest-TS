import { JobData, Queue, Worker } from "bullmq";
import createServer from "./server.js";
import dotenv from "dotenv";
import { createWallet, createGateway, getNetwork, GetContract, pingChaincode } from "./fabric.js";
import { initJobQueue, initJobWorker } from "./jobs.js";
import { ContractList, JobResult } from "./utils/types.js";
import { initCreateElectionJobs, initCreateElectionWorker } from "./services/createElectionJobs.js";

let jobQueue: Queue | undefined;
let createElectionJobQueue: Queue | undefined;
let jobQueueWorker: Worker | undefined;
let createElectionJobQueueWorker: Worker | undefined;
const cb64 = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNkekNDQWg2Z0F3SUJBZ0lVU0JVMFc0ME5JTTVjUUNKYzBtWDhUYnFQWGNzd0NnWUlLb1pJemowRUF3SXcKY2pFTE1Ba0dBMVVFQmhNQ1NVUXhGVEFUQmdOVkJBZ1RERU5sYm5SeVlXd2dTbUYyWVRFUk1BOEdBMVVFQnhNSQpRbUZ1ZVhWdFlYTXhHakFZQmdOVkJBb1RFV1YyYjNSbExtVjRZVzF3YkdVdVkyOXRNUjB3R3dZRFZRUURFeFJqCllTNWxkbTkwWlM1bGVHRnRjR3hsTG1OdmJUQWVGdzB5TXpBME1qRXdNVFV6TURCYUZ3MHlOREEwTWpBd01UVTQKTURCYU1ITXhDekFKQmdOVkJBWVRBa2xFTVJVd0V3WURWUVFJRXd4RFpXNTBjbUZzSUVwaGRtRXhFVEFQQmdOVgpCQWNUQ0VKaGJubDFiV0Z6TVJvd0dBWURWUVFLRXhGbGRtOTBaUzVsZUdGdGNHeGxMbU52YlRFT01Bd0dBMVVFCkN4TUZZV1J0YVc0eERqQU1CZ05WQkFNVEJXRmtiV2x1TUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0QKUWdBRU5kUHdZY0UvVHhyeC9seTFFMU5xZDhjN2RxWHNkVHBpT2FKcTVQWndHQS9YYnkxVTVSd3Z3MS9QOWhobQpWbi9DbzlTYjhNWVVobDBUVWhlelVueVlTS09Ca0RDQmpUQU9CZ05WSFE4QkFmOEVCQU1DQjRBd0RBWURWUjBUCkFRSC9CQUl3QURBZEJnTlZIUTRFRmdRVWlDNUhtNFBramNnekNJTjZWZmVCOUMwV2hHb3dId1lEVlIwakJCZ3cKRm9BVWRkYzR6TGhtQk9YOWlZT1ljdm14ckFoOEFYNHdMUVlEVlIwUkJDWXdKSUlQUkVWVFMxUlBVQzAyTnpaQgpTRUpGZ2hGbGRtOTBaUzVsZUdGdGNHeGxMbU52YlRBS0JnZ3Foa2pPUFFRREFnTkhBREJFQWlCUjhnbzBSOU5NCis1bm1zd01ja3V3bTgwWnlZeUhZOG1VeVhHdE8zeUUzT1FJZ0JRRXZLaDA2dmN0VFk3MVorTm5tK2lmVGdnVSsKZ09nSTd3VWNpS1QvdW1BPQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0t';
const pb64 = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JR0hBZ0VBTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEJHMHdhd0lCQVFRZy81OFFvUVRXbVBVOVlibm8KR1A1eVgvRTcvT2NiVllXTGZZZDZsbVpHZXFpaFJBTkNBQVExMC9CaHdUOVBHdkgrWExVVFUycDN4enQycGV4MQpPbUk1b21yazluQVlEOWR2TFZUbEhDL0RYOC8yR0daV2Y4S2oxSnZ3eGhTR1hSTlNGN05TZkpoSQotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0t';

async function main() {
  dotenv.config();
  const app = await createServer();

  //dev
  const { uid, wallet } = await createWallet(cb64, pb64);
  const gw = await createGateway(wallet, uid);
  const nw = await getNetwork(gw);
  const cc = await GetContract(nw);
  app.locals[uid] = cc as ContractList;
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
