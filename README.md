# CSV Upload Processor

## Overview
This application is a CSV upload processor designed to allow users to upload CSV files containing transaction rows (date, description, amount, category). It processes the uploaded files asynchronously in the background.

The core features include:
- A `POST /upload` API endpoint that receives a CSV file, enqueues a background job, and returns a Job ID immediately.
- A `GET /status/:jobId` API endpoint that tracks the status of a job (queued, processing, done, or failed) and reports the progress (number of rows processed).
- Deduplication: Kicking off an upload job is prevented if the same file has already been submitted.
- Result Summary: Invalid rows or missing columns are safely tracked and reported.
- A front-end interface to upload CSVs, track the real-time processing status of jobs, and view the processed CSV results once a job finishes.

## Prerequisites & Requirements
To run this project, you need the following dependencies installed on your system (Windows, Linux, or macOS):
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

*Note: Since the application runs within Docker containers, you do not need to install Node.js, Redis, or PostgreSQL directly on your local machine to run the application using Docker Compose.*

## Setup and Running the Application

This project uses Docker Compose to easily orchestrate the API server, background worker, Redis queue, and PostgreSQL database.

### 1. Clone the repository
```bash
git clone https://github.com/shivkinga53/csv-upload-processor-assessment.git
cd csv-upload-processor-assessment
```

### 2. Environment Configuration
The application is pre-configured to work out-of-the-box with Docker using the provided `docker-compose.yml` file. You can find example environment variables in the `.envexample` file.

### 3. Running the Stack

**Option A: Run in the Foreground (with Logs)**
To start the application and see the logs in your current terminal:
```bash
docker-compose up --build
```
*Note: Use `Ctrl+C` to stop the application when running in the foreground.*

**Option B: Run in the Background (Detached Mode)**
To start the application in the background:
```bash
docker-compose up -d --build
```

### 4. Accessing the Application
Once the containers are running, you can access the application at:
- **Frontend / UI:** http://localhost:3000
- **API Server:** http://localhost:3000

## Code Quality: Linting and Testing

The project is built with robust testing and code quality tools, including `eslint` for linting and `jest` for testing.

When running the application via Docker Compose in detached mode, you can execute linting and tests directly inside the API container.

### Running the Linter
To run ESLint and check for code styling issues:
```bash
docker-compose exec api npm run lint
```

### Running the Tests
To run the Jest test suite:
```bash
docker-compose exec api npm test
```

## CI/CD Pipeline Integration

This project uses GitHub Actions for Continuous Integration (CI). 
The CI pipeline is triggered on every `push` or `pull_request` to the `main` or `master` branches.

The pipeline automatically provisions a Node.js environment along with Redis and PostgreSQL service containers, and performs the following steps:
1. Checks out the repository.
2. Sets up Node.js.
3. Installs NPM dependencies.
4. Runs the linter (`npm run lint`) to enforce code quality.
5. Runs the test suite (`npm test`) against the provided services to ensure nothing is broken.

You can view the configuration for this pipeline in `.github/workflows/ci.yml`.

## API Endpoints

### 1. Health Check
- **GET** `/health`
- **Response (200 OK):** `OK`

### 2. Upload CSV
- **POST** `/upload`
- **Request Body:** `multipart/form-data` with a `file` field containing the `.csv` file.
- **Success Response (200 OK):**
  ```json
  {
    "jobId": "123e4567-e89b-12d3-a456-426614174000",
    "duplicate": false,
    "status": "queued"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "Invalid file format. Please upload a .csv file." }`
  - `400 Bad Request`: `{ "error": "No file uploaded." }`
  - `500 Internal Server Error`: `{ "error": "File upload failed." }` or `{ "error": "Internal server error" }`

### 3. Get Job Status
- **GET** `/status/:jobId`
- **Success Response (200 OK):**
  ```json
  {
    "jobId": "123e4567-e89b-12d3-a456-426614174000",
    "status": "done",
    "totalRows": 150,
    "rowsProcessed": 150,
    "invalidRows": 2,
    "createdAt": "2024-04-26T20:15:00.000Z",
    "downloadUrl": "/download/123e4567-e89b-12d3-a456-426614174000"
  }
  ```
  *(Note: `downloadUrl` is only present when `status` is `"done"`)*
- **Error Responses:**
  - `404 Not Found`: `{ "error": "Job not found (Invalid ID format)" }`
  - `404 Not Found`: `{ "error": "Job not found" }`
  - `500 Internal Server Error`: `{ "error": "Internal server error" }`

### 4. Download Processed CSV
- **GET** `/download/:jobId`
- **Response (200 OK):** Initiates a file download (`processed_transactions_<jobId>.csv`).
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "Job is not finished yet" }`
  - `404 Not Found`: `{ "error": "Job not found" }`
  - `404 Not Found`: `{ "error": "Processed file not found" }`
  - `500 Internal Server Error`: `{ "error": "Error downloading file" }` or `{ "error": "Internal server error" }`

### 5. List All Jobs
- **GET** `/jobs`
- **Success Response (200 OK):** Returns a list (up to 50) of recent jobs.
  ```json
  [
    {
      "jobId": "123e4567-...",
      "status": "done",
      "totalRows": 100,
      "rowsProcessed": 100,
      "invalidRows": 0,
      "createdAt": "2024-04-26T20:15:00.000Z"
    }
  ]
  ```
- **Error Responses:**
  - `500 Internal Server Error`: `{ "error": "Internal server error" }`

### 6. List Transactions
- **GET** `/transactions`
- **Query Parameters:** `page`, `limit`, `startDate`, `endDate`, `dateType`, `sortBy`, `sortOrder`
- **Success Response (200 OK):**
  ```json
  {
    "totalItems": 150,
    "totalPages": 2,
    "currentPage": 1,
    "transactions": [
      {
        "id": 1,
        "date": "2024-01-01",
        "description": "Coffee",
        "amount": 5.50,
        "category": "Food",
        "jobId": "123e4567-..."
      }
    ]
  }
  ```
- **Error Responses:**
  - `500 Internal Server Error`: `{ "error": "Internal server error" }`

### 7. Export Transactions (Global)
- **GET** `/transactions/export`
- **Query Parameters:** `startDate` (required), `endDate` (required), `dateType`, `sortBy`, `sortOrder`
- **Response (200 OK):** Initiates a CSV file download of transactions matching the filter criteria. Max range 90 days.
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "Start Date and End Date are required for global exports." }`
  - `400 Bad Request`: `{ "error": "Date range cannot exceed 90 days for exports." }`
  - `404 Not Found`: `{ "error": "No transactions found in this range." }`
  - `500 Internal Server Error`: `{ "error": "Internal server error" }`

### 8. Export Valid Transactions for a specific Job
- **GET** `/export/job/:jobId`
- **Response (200 OK):** Initiates a CSV file download (`valid_transactions_<jobId>.csv`).
- **Error Responses:**
  - `404 Not Found`: `{ "error": "Job not found" }`
  - `404 Not Found`: `{ "error": "No valid transactions found for this job." }`
  - `500 Internal Server Error`: `{ "error": "Internal server error" }`

## Data Processing & Validation

### 1. How Validations Work
When the background worker picks up a CSV file, it streams and parses it row-by-row.
Each row undergoes the following validations:
- **Missing Columns:** Ensures required fields like `date` and `description` are not blank or purely whitespace.
- **Data Type & Format Checks:** 
  - `amount` must be a valid number. It automatically strips out currency symbols, commas, and unicode minus signs before parsing.
  - `date` must be parsable into a valid date format.
- **Structural Integrity:** If a row has too many or too few columns compared to the headers, the parser catches it as a malformed row.

### 2. How Data is Stored
To optimize for performance and memory constraints regardless of file size:
- The CSV file is read using streams.
- Rows that pass validation are buffered in memory and bulk-inserted into the PostgreSQL database in **batches of 500**.
- The overall Job state (total rows, processed rows, invalid rows) is continuously updated in the database every 100 rows, allowing the frontend to show real-time progress.

### 3. Handling Invalid Rows
Invalid rows are safely handled without crashing the job or being quietly dropped:
- If a row is flagged as invalid (either logically or structurally), it is **skipped** from the database insertion.
- The skipped row is instead written into a resulting "processed" CSV file.
- The specific reason for failure is appended to the row under new columns: `validation_status` ("invalid") and `validation_reason` (e.g., "Amount must be a valid number").
- Once the job is marked as "done", users can download this processed file to see exactly which rows failed and why.

## Architecture & Technical Decisions
- **API Server**: Built with Express.js to quickly ingest files and handle status polling.
- **Worker**: A separate Node.js process using BullMQ to handle background processing, ensuring the API stays fast regardless of file size.
- **Queue**: Redis, managed by BullMQ for robust job processing, retries, and tracking.
- **Database**: PostgreSQL to reliably store processed transactions and job states.
- **Frontend**: A minimal frontend interface to interact with the API, showing job queue states and the parsed results.
- **Graceful Shutdown**: The worker process listens for system signals (`SIGINT`, `SIGTERM`) to gracefully shut down in the event of a container stop, crash, or manual interruption. It ensures active queues are safely closed and connections are severed before exiting, preventing jobs from being left in a stalled state.

## Potential Improvements (Given More Time)
- Add websockets for real-time status updates instead of client-side polling.
- Implement more robust file validation before enqueuing to the worker.
- Add paginated views for large processed CSV files on the frontend.
- Implement storage solutions like AWS S3 instead of local storage for uploaded CSVs.