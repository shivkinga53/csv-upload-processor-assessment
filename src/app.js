import express from "express";
import multer from "multer";
const app = express();

app.use(express.json());
const upload = multer({ dest: "uploads/" });

app.get("/health", (req, res) => {
    res.send("OK");
});

app.post("/upload", upload.single("file"), (req, res) => {
    console.log(req.file);
    res.send("File uploaded successfully");
});

export default app;