import fs from "fs";
import * as fastCsv from "fast-csv";
import Job from "../models/Job.js";
import { validateRow } from "./csvValidator.js";

export const processCsvFile = (jobId, inputFilePath, outputFilePath) => {
    return new Promise((resolve, reject) => {
        let totalRows = 0;
        let rowsProcessed = 0;
        let invalidRows = 0;

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
                rowsProcessed++;

                const validation = validateRow(row);
                
                if (validation.valid) {
                    row.validation_status = "valid";
                    row.validation_reason = "";
                } else {
                    invalidRows++;
                    row.validation_status = "invalid";
                    row.validation_reason = validation.reason;
                }

                csvStream.write(row);

                if (rowsProcessed % 100 === 0) {
                    await Job.update(
                        { totalRows, rowsProcessed, invalidRows },
                        { where: { jobId } }
                    ).catch(console.error);
                }
            })
            .on("data-invalid", async (row, rowNumber, reason) => {
                totalRows++;
                rowsProcessed++;
                invalidRows++;

                let formattedRow = {};
                if (Array.isArray(row)) {
                    formattedRow = {
                        id: row[0] || "",
                        date: row[1] || "",
                        description: row[2] || "",
                        amount: row[3] || "",
                        category: row[4] || ""
                    };
                } else {
                    formattedRow = row;
                }

                formattedRow.validation_status = "invalid";
                formattedRow.validation_reason = `Malformed structure: ${reason}`;

                csvStream.write(formattedRow);

                if (rowsProcessed % 100 === 0) {
                    await Job.update(
                        { totalRows, rowsProcessed, invalidRows },
                        { where: { jobId } }
                    ).catch(console.error);
                }
            })
            .on("error", (error) => {
                console.error(`[CsvService] Error parsing CSV for job ${jobId}:`, error);
                reject(error);
            })
            .on("end", async () => {
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