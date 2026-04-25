// src/models/Job.js
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Job = sequelize.define("Job", {
    jobId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    hash: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM("queued", "processing", "done", "failed"),
        defaultValue: "queued",
    },
    totalRows: { type: DataTypes.INTEGER, defaultValue: 0 },
    rowsProcessed: { type: DataTypes.INTEGER, defaultValue: 0 },
    invalidRows: { type: DataTypes.INTEGER, defaultValue: 0 },
    filePath: { type: DataTypes.STRING, allowNull: false },
    outputPath: { type: DataTypes.STRING, allowNull: true }
});

export default Job;