import { Sequelize } from "sequelize";
import "../models/Job.js";

const sequelize = new Sequelize({
    dialect: "postgres",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: false,
});

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected successfully");

        // await Job.sync({ alter: true });

        await sequelize.sync({ alter: true });
        console.log("Database tables synchronized successfully.");

    } catch (error) {
        console.error("Unable to connect to the database:", error);
    }
};

export default sequelize;