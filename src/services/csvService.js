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

        fastCsv.parseStream(readStream, { headers: true, ignoreEmpty: true })
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