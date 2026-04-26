import express from "express";
import multer from "multer";
import fs from "fs/promises";
import Job from "./models/Job.js";
import Transaction from "./models/Transaction.js";
import { enqueueJob } from "./services/queueService.js";
import { hashFile } from "./services/hashService.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));
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

// Status endpoint
app.get("/status/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await Job.findOne({ where: { jobId } });

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        // Return a clean payload matching our planned structure
        const response = {
            jobId: job.jobId,
            status: job.status,
            totalRows: job.totalRows,
            rowsProcessed: job.rowsProcessed,
            invalidRows: job.invalidRows,
            createdAt: job.createdAt,
        };

        if (job.status === "done") {
            response.downloadUrl = `/download/${job.jobId}`;
        }

        res.json(response);
    } catch (error) {
        console.error(`[API] Error fetching status for job ${req.params.jobId}:`, error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// download route
app.get("/download/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await Job.findOne({ where: { jobId } });

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

        if (job.status !== "done") {
            return res.status(400).json({ error: "Job is not finished yet" });
        }

        if (!job.outputPath) {
            return res.status(404).json({ error: "Processed file not found" });
        }

        res.download(job.outputPath, `processed_transactions_${jobId}.csv`, (err) => {
            if (err) {
                console.error(`[API] Error downloading file for job ${jobId}:`, err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Error downloading file" });
                }
            }
        });
    } catch (error) {
        console.error(`[API] Error in download route for job ${req.params.jobId}:`, error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/jobs", async (req, res) => {
    try {
        const jobs = await Job.findAll({
            order: [['createdAt', 'DESC']],
            attributes: ['jobId', 'status', 'totalRows', 'rowsProcessed', 'invalidRows', 'createdAt'],
            limit: 50
        });
        res.json(jobs);
    } catch (error) {
        console.error("[API] Error fetching jobs:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/transactions", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;

        const { count, rows } = await Transaction.findAndCountAll({
            order: [['date', 'DESC'], ['createdAt', 'DESC']],
            limit,
            offset
        });

        res.json({
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            transactions: rows
        });
    } catch (error) {
        console.error("[API] Error fetching transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default app;