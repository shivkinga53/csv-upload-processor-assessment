const tabs = {
    upload: document.getElementById('tab-upload'),
    history: document.getElementById('tab-history'),
    data: document.getElementById('tab-data')
};
const views = {
    upload: document.getElementById('view-upload'),
    history: document.getElementById('view-history'),
    data: document.getElementById('view-data')
};

function switchTab(activeTabId, activeViewId) {
    Object.values(tabs).forEach(tab => {
        tab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        tab.classList.add('text-gray-500');
    });
    Object.values(views).forEach(view => view.classList.add('hidden'));
    tabs[activeTabId].classList.remove('text-gray-500');
    tabs[activeTabId].classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    views[activeViewId].classList.remove('hidden');

    if (activeTabId === 'history') loadJobHistory();
    if (activeTabId === 'data') loadTransactions();
}

tabs.upload.addEventListener('click', () => switchTab('upload', 'upload'));
tabs.history.addEventListener('click', () => switchTab('history', 'history'));
tabs.data.addEventListener('click', () => switchTab('data', 'data'));

let pollingInterval;
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const file = document.getElementById('fileInput').files[0];
    if (!file) return;

    submitBtn.disabled = true;
    submitBtn.innerText = 'Uploading...';
    document.getElementById('statusArea').classList.remove('hidden');
    document.getElementById('downloadBtn').classList.add('hidden');
    clearInterval(pollingInterval);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        pollStatus(data.jobId);
    } catch (error) {
        alert('Upload failed: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.innerText = 'Upload & Process';
    }
});

function pollStatus(jobId) {
    const statusText = document.getElementById('statusText');
    pollingInterval = setInterval(async () => {
        try {
            const res = await fetch(`/status/${jobId}`);
            const data = await res.json();

            statusText.innerText = data.status;
            document.getElementById('processedCount').innerText = data.rowsProcessed;
            document.getElementById('totalCount').innerText = data.totalRows;
            document.getElementById('invalidCount').innerText = data.invalidRows;

            if (data.status === 'done') {
                clearInterval(pollingInterval);
                const btn = document.getElementById('downloadBtn');
                btn.href = data.downloadUrl;
                // Only show download button if there were invalid rows
                if (data.invalidRows > 0) btn.classList.remove('hidden');

                document.getElementById('submitBtn').disabled = false;
                document.getElementById('submitBtn').innerText = 'Upload Another File';
            }
        } catch (err) { console.error(err); }
    }, 1000);
}

async function loadJobHistory() {
    const tbody = document.getElementById('jobsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">Loading...</td></tr>';

    try {
        const res = await fetch('/jobs');
        const jobs = await res.json();

        tbody.innerHTML = jobs.map(job => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 font-mono text-xs">${job.jobId.split('-')[0]}...</td>
                <td class="px-4 py-2 capitalize ${job.status === 'done' ? 'text-green-600' : 'text-blue-600'}">${job.status}</td>
                <td class="px-4 py-2">${job.totalRows}</td>
                <td class="px-4 py-2 text-red-600">${job.invalidRows > 0 ? job.invalidRows : '-'}</td>
                <td class="px-4 py-2 text-xs text-gray-500">${new Date(job.createdAt).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-red-500">Failed to load history</td></tr>';
    }
}

let currentPage = 1;

async function loadTransactions() {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-500">Loading...</td></tr>';

    try {
        const res = await fetch(`/transactions?page=${currentPage}&limit=10`);
        const data = await res.json();

        if (data.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-500">No clean data found. Upload a file first!</td></tr>';
            return;
        }

        tbody.innerHTML = data.transactions.map(t => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 whitespace-nowrap">${t.date}</td>
                <td class="px-4 py-2 truncate max-w-xs" title="${t.description}">${t.description}</td>
                <td class="px-4 py-2"><span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">${t.category || 'None'}</span></td>
                <td class="px-4 py-2 font-mono text-right ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}">${Number(t.amount).toFixed(2)}</td>
            </tr>
        `).join('');

        document.getElementById('pageIndicator').innerText = `Page ${data.currentPage} of ${data.totalPages}`;
        document.getElementById('prevPageBtn').disabled = data.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = data.currentPage >= data.totalPages;

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">Failed to load transactions</td></tr>';
    }
}

document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; loadTransactions(); }
});
document.getElementById('nextPageBtn').addEventListener('click', () => {
    currentPage++; loadTransactions();
});