const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitBtn');
const statusArea = document.getElementById('statusArea');
const statusText = document.getElementById('statusText');
const processedCount = document.getElementById('processedCount');
const totalCount = document.getElementById('totalCount');
const invalidCount = document.getElementById('invalidCount');
const downloadBtn = document.getElementById('downloadBtn');

let pollingInterval;

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) return;

    submitBtn.disabled = true;
    submitBtn.innerText = 'Uploading...';
    statusArea.classList.remove('hidden');
    downloadBtn.classList.add('hidden');
    clearInterval(pollingInterval);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        pollStatus(data.jobId);

    } catch (error) {
        alert('Upload failed: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.innerText = 'Upload & Process';
    }
});

function pollStatus(jobId) {
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/status/${jobId}`);
            const data = await response.json();

            statusText.innerText = data.status;
            processedCount.innerText = data.rowsProcessed;
            totalCount.innerText = data.totalRows;
            invalidCount.innerText = data.invalidRows;
            if (data.status === 'done') {
                clearInterval(pollingInterval);
                downloadBtn.href = data.downloadUrl;
                downloadBtn.classList.remove('hidden');

                submitBtn.disabled = false;
                submitBtn.innerText = 'Upload Another File';
            }

            if (data.status === 'failed') {
                clearInterval(pollingInterval);
                statusText.classList.replace('text-blue-600', 'text-red-600');
                submitBtn.disabled = false;
                submitBtn.innerText = 'Try Again';
            }

        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 1000);
}