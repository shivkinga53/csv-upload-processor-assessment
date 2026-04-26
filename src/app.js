import express from "express";
import multer from "multer";
import fs from "fs/promises";
import Job from "./models/Job.js";
import { enqueueJob } from "./services/queueService.js";
import { hashFile } from "./services/hashService.js";

const app = express();
app.use(express.json());
const upload = multer({ dest: "uploads/" });

// Health check endpoint
app.get("/health", (req, res) => res.send("OK"));

// Upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
    console.log("[API] Received upload request...");

    if (!req.file) {
        console.log("[API] No file found in request.");
        return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    console.log(filePath);
    try {
        const hash = await hashFile(filePath);

        console.log("[API] Attempting to create Job record in database...");
        const job = await Job.create({ hash, filePath, status: "queued" });

        console.log(`[API] Success! Created new job: ${job.jobId}`);

        // STAGE 2 UPDATE: Push it to the background queue!
        await enqueueJob(job.jobId, filePath);

        return res.json({ jobId: job.jobId, duplicate: false, status: "queued" });

    } catch (error) {
        console.log("[API] Error:", error);
        if (error.name === "SequelizeUniqueConstraintError") {
            const { hash } = error.fields;
            console.log("[API] Duplicate file detected! Fetching existing job...");
            const existingJob = await Job.findOne({ where: { hash } });

            await fs.unlink(filePath).catch(console.error);
            console.log(`[API] Deleted redundant file. Returning existing jobId: ${existingJob.jobId}`);

            return res.json({ jobId: existingJob.jobId, duplicate: true, status: existingJob.status });
        }

        console.error("[API] Unexpected error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default app;