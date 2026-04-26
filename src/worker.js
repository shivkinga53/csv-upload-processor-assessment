// src/worker.js
import "dotenv/config";
import { Worker } from "bullmq";
import redisConnection from "./config/redis.js";
import Job from "./models/Job.js";

const worker = new Worker("upload-queue", async (job) => {
  const { jobId, filePath } = job.data;
  console.log(`\n[Worker] Picked up job ${jobId}`);
  console.log(`[Worker] File located at: ${filePath}`);

  try {

    await Job.update(
      { status: 'processing', rowsProcessed: 0, invalidRows: 0 },
      { where: { jobId } }
    );
    console.log(`[Worker] Job ${jobId} status updated to 'processing'`);

    console.log(`[Worker] Simulating heavy CSV parsing...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    await Job.update(
      { status: 'done' },
      { where: { jobId } }
    );
    console.log(`[Worker] Job ${jobId} finished successfully! Status updated to 'done'`);

  } catch (error) {
    console.error(`[Worker] Job ${jobId} failed:`, error);
    await Job.update(
      { status: 'failed' },
      { where: { jobId } }
    );
    throw error;
  }
}, { connection: redisConnection });

console.log("Worker is running and listening to Redis...");