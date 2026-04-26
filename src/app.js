import express from "express";
import multer from "multer";
import fs from "fs";
import Job from "./models/Job.js";
import Transaction from "./models/Transaction.js";
import { enqueueJob } from "./services/queueService.js";
import { hashFile } from "./services/hashService.js";
import { Op } from "sequelize";

const app = express();
app.use(express.json());
app.use(express.static("public"));
const upload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
            cb(null, true);
        } else {
            cb(new Error("INVALID_FILE_TYPE"));
        }
    }
});

// Health check endpoint
app.get("/health", (req, res) => res.send("OK"));

// Upload endpoint
app.post("/upload", (req, res) => {
    upload.single("file")(req, res, async (err) => {
        if (err) {
            if (err.message === "INVALID_FILE_TYPE") {
                return res.status(400).json({ error: "Invalid file format. Please upload a .csv file." });
            }
            return res.status(500).json({ error: "File upload failed." });
        }

        if (!req.file) return res.status(400).json({ error: "No file uploaded." });

        console.log("\n[API] Received upload request...");

        try {
            const filePath = req.file.path;
            const hash = await hashFile(filePath);

            console.log(`[API] Attempting to create Job record in database...`);

            const job = await Job.create({ hash, filePath, status: "queued" });
            console.log(`[API] Success! Created new job: ${job.jobId}`);

            await enqueueJob(job.jobId, filePath);

            return res.json({ jobId: job.jobId, duplicate: false, status: "queued" });

        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                console.log("[API] Duplicate file detected! Fetching existing job...");
                const existingJob = await Job.findOne({ where: { hash: error.fields.hash } });

                if (existingJob) {
                    await fs.promises.unlink(req.file.path).catch(console.error);
                    console.log(`[API] Deleted redundant file. Returning existing jobId: ${existingJob.jobId}`);
                    return res.json({ jobId: existingJob.jobId, duplicate: true, status: existingJob.status });
                }
            }

            console.error("[API] Error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
});

// Status endpoint
app.get("/status/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(jobId)) {
            return res.status(404).json({ error: "Job not found (Invalid ID format)" });
        }
        const job = await Job.findOne({ where: { jobId } });

        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }

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

// Get all jobs with pagination
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

// Get all transactions with pagination
// 5. STAGE 10: Get Transactions with Advanced Filtering and Pagination
app.get("/transactions", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;

        const { startDate, endDate, dateType, sortBy, sortOrder } = req.query;

        let whereClause = {};
        const dateField = dateType === 'createdAt' ? 'createdAt' : 'date';

        if (startDate && endDate) {
            const end = dateField === 'createdAt' ? new Date(`${endDate}T23:59:59.999Z`) : new Date(endDate);
            whereClause[dateField] = { [Op.between]: [new Date(startDate), end] };
        } else if (startDate) {
            whereClause[dateField] = { [Op.gte]: new Date(startDate) };
        } else if (endDate) {
            const end = dateField === 'createdAt' ? new Date(`${endDate}T23:59:59.999Z`) : new Date(endDate);
            whereClause[dateField] = { [Op.lte]: end };
        }

        const orderField = sortBy || 'date';
        const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        const { count, rows } = await Transaction.findAndCountAll({
            where: whereClause,
            order: [[orderField, orderDir], ['createdAt', 'DESC']],
            limit,
            offset
        });

        res.json({
            totalItems: count,
            totalPages: Math.ceil(count / limit) || 1,
            currentPage: page,
            transactions: rows
        });
    } catch (error) {
        console.error("[API] Error fetching transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Global Export with 90-Day Safety Limit
app.get("/transactions/export", async (req, res) => {
    try {
        const { startDate, endDate, dateType, sortBy, sortOrder } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: "Start Date and End Date are required for global exports." });
        }

        const start = new Date(startDate);
        const dateField = dateType === 'createdAt' ? 'createdAt' : 'date';
        const end = dateField === 'createdAt' ? new Date(`${endDate}T23:59:59.999Z`) : new Date(endDate);

        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 90) {
            return res.status(400).json({ error: "Date range cannot exceed 90 days for exports." });
        }

        const orderField = sortBy || 'date';
        const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        const transactions = await Transaction.findAll({
            where: { [dateField]: { [Op.between]: [start, end] } },
            order: [[orderField, orderDir]]
        });

        if (transactions.length === 0) {
            return res.status(404).json({ error: "No transactions found in this range." });
        }

        let csvContent = "Transaction Date,Upload Date,Description,Amount,Category\n";
        transactions.forEach(t => {
            const uploadDate = new Date(t.createdAt).toISOString().split('T')[0];
            csvContent += `${t.date},${uploadDate},"${t.description}",${t.amount},${t.category || ''}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="export_${startDate}_to_${endDate}.csv"`);
        res.status(200).send(csvContent);

    } catch (error) {
        console.error("[API] Error exporting transactions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Exporting valid transactions
app.get("/export/job/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;

        const job = await Job.findOne({ where: { jobId } });
        if (!job) return res.status(404).json({ error: "Job not found" });

        const transactions = await Transaction.findAll({
            where: { jobId },
            order: [['date', 'ASC']]
        });

        if (transactions.length === 0) {
            return res.status(404).json({ error: "No valid transactions found for this job." });
        }

        let csvContent = "date,description,amount,category\n";

        transactions.forEach(t => {
            csvContent += `${t.date},"${t.description}",${t.amount},${t.category || ''}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="valid_transactions_${jobId}.csv"`);
        res.status(200).send(csvContent);

    } catch (error) {
        console.error(`[API] Error exporting valid transactions for job ${req.params.jobId}:`, error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default app;