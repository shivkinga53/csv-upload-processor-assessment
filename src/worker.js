import "dotenv/config";
import { Worker } from "bullmq";
import redisConnection from "./config/redis.js";

const worker = new Worker("upload-queue", async (job) => {
  console.log("Processing job:", job.data);
}, { connection: redisConnection });

console.log("Worker is running and listening to Redis...");