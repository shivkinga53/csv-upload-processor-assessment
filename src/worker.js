import "dotenv/config";
import { Worker } from "bullmq";
import redisConnection from "./config/redis.js";
import Job from "./models/Job.js";
import { processCsvFile } from "./services/csvService.js";

new Worker("upload-queue", async (job) => {
  const { jobId, filePath } = job.data;
  console.log(`\n[Worker] Picked up job ${jobId}`);
  console.log(`[Worker] File located at: ${filePath}`);

  try {

    await Job.update(
      { status: 'processing', rowsProcessed: 0, invalidRows: 0 },
      { where: { jobId } }
    );
    const outputPath = `uploads/processed-${jobId}.csv`;
    console.log(`[Worker] Output file located at: ${outputPath}`);

    console.log(`[Worker] Streaming and validating CSV...`);
    const result = await processCsvFile(jobId, filePath, outputPath);
    console.log(`[Worker] CSV processed successfully!`);

    console.log(result);

    await Job.update(
      {
        status: 'done',
        totalRows: result.totalRows,
        rowsProcessed: result.rowsProcessed,
        invalidRows: result.invalidRows
      },
      { where: { jobId } }
    );
    console.log(`[Worker] Job ${jobId} finished! Total: ${result.totalRows}, Invalid: ${result.invalidRows}`);

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