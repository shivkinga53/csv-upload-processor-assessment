import { Queue } from "bullmq";
import redisConnection from "../config/redis.js";

const uploadQueue = new Queue("upload-queue", {
    connection: redisConnection
});

export const enqueueJob = async (jobId, filePath) => {
    console.log(`[QueueService] Adding job ${jobId} to the queue...`);

    return await uploadQueue.add("process-csv", {
        jobId,
        filePath
    }, {
        removeOnComplete: true,
        removeOnFail: false
    });
};