import fs from "fs";
import * as fastCsv from "fast-csv";
import Job from "../models/Job.js";
import Transaction from "../models/Transaction.js"; // <--- Import the new model
import { validateRow } from "./csvValidator.js";

export const processCsvFile = (jobId, inputFilePath, outputFilePath) => {
    return new Promise((resolve, reject) => {
        let totalRows = 0;
        let rowsProcessed = 0;
        let invalidRows = 0;

        let validRowsBuffer = [];
        const BATCH_SIZE = 500;

        const readStream = fs.createReadStream(inputFilePath);
        const writeStream = fs.createWriteStream(outputFilePath);
        const csvStream = fastCsv.format({ headers: true });
        csvStream.pipe(writeStream);

        fastCsv.parseStream(readStream, {
            headers: true,
            ignoreEmpty: true,
            strictColumnHandling: true
        })
            .on("data", async (row) => {
                totalRows++;
                const validation = validateRow(row);

                if (validation.valid) {
                    validRowsBuffer.push({
                        jobId: jobId,
                        date: validation.cleanData.date,
                        description: validation.cleanData.description,
                        amount: validation.cleanData.amount,
                        category: validation.cleanData.category
                    });

                    if (validRowsBuffer.length >= BATCH_SIZE) {
                        readStream.pause();
                        await Transaction.bulkCreate(validRowsBuffer).catch(console.error);
                        validRowsBuffer = [];
                        readStream.resume();
                    }
                } else {
                    invalidRows++;
                    row.validation_status = "invalid";
                    row.validation_reason = validation.reason;
                    csvStream.write(row);
                }

                rowsProcessed++;
                if (rowsProcessed % 100 === 0) {
                    await Job.update({ totalRows, rowsProcessed, invalidRows }, { where: { jobId } }).catch(console.error);
                }
            })
            .on("data-invalid", async (row, rowNumber, reason) => {
                totalRows++;
                rowsProcessed++;
                invalidRows++;

                let formattedRow = Array.isArray(row) ? {
                    id: row[0] || "", date: row[1] || "", description: row[2] || "", amount: row[3] || "", category: row[4] || ""
                } : row;

                formattedRow.validation_status = "invalid";
                formattedRow.validation_reason = `Malformed structure: ${reason}`;
                csvStream.write(formattedRow);
            })
            .on("error", reject)
            .on("end", async () => {
                if (totalRows === 0) {
                    await fs.promises.unlink(inputFilePath).catch(console.error);
                    return reject(new Error("File is empty or contains only headers."));
                }

                if (validRowsBuffer.length > 0) {
                    await Transaction.bulkCreate(validRowsBuffer).catch(console.error);
                }

                csvStream.end();

                await Job.update(
                    { totalRows, rowsProcessed, invalidRows, outputPath: outputFilePath },
                    { where: { jobId } }
                );

                await fs.promises.unlink(inputFilePath).catch(console.error);

                resolve({ totalRows, rowsProcessed, invalidRows });
            });
    });
};