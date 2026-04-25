import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/database.js";
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await connectDB();
});

process.on("uncaughtException", async (error) => {
    console.log("Uncaught Exception", error);
    process.exit(1);
});

process.on("unhandledRejection", async (error) => {
    console.log("Unhandled Rejection", error);
    process.exit(1);
});