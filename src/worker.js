import "dotenv/config";
import { Worker } from "bullmq";
import Redis from "ioredis";

const redisConnection = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
    maxRetriesPerRequest: null,
});

const worker = new Worker(
    "upload-queue",
    async (job) => {
    console.log("Processing job:", job.data);
  },
  { connection: redisConnection }
);

console.log("Worker is running and listening to Redis...");