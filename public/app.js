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
        tab.classList.remove('text-blue-400', 'border-b-2', 'border-blue-400');
        tab.classList.add('text-gray-400');
    });
    Object.values(views).forEach(view => view.classList.add('hidden'));

    tabs[activeTabId].classList.remove('text-gray-400');
    tabs[activeTabId].classList.add('text-blue-400', 'border-b-2', 'border-blue-400');
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
    statusText.classList.remove('text-red-400');
    statusText.classList.add('text-blue-400');

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
                if (data.invalidRows > 0) btn.classList.remove('hidden');

                document.getElementById('submitBtn').disabled = false;
                document.getElementById('submitBtn').innerText = 'Upload Another File';
            }
            else if (data.status === 'failed') {
                clearInterval(pollingInterval);
                statusText.classList.remove('text-blue-400');
                statusText.classList.add('text-red-400');

                document.getElementById('submitBtn').disabled = false;
                document.getElementById('submitBtn').innerText = 'Upload Failed - Try Again';
            }
        } catch (err) { console.error('Polling error:', err); }
    }, 1000);
}

async function loadJobHistory() {
    const tbody = document.getElementById('jobsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">Loading...</td></tr>';

    try {
        const res = await fetch('/jobs');
        const jobs = await res.json();

        if (jobs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No jobs found.</td></tr>';
            return;
        }

        tbody.innerHTML = jobs.map(job => `
            <tr class="hover:bg-gray-700/50 transition">
                <td class="px-4 py-3 font-mono text-xs text-gray-400">${job.jobId.split('-')[0]}...</td>
                <td class="px-4 py-3 capitalize font-medium ${job.status === 'done' ? 'text-green-400' : (job.status === 'failed' ? 'text-red-400' : 'text-blue-400')}">${job.status}</td>
                <td class="px-4 py-3 text-gray-300">${job.totalRows}</td>
                <td class="px-4 py-3 text-red-400 font-medium">${job.invalidRows > 0 ? job.invalidRows : '-'}</td>
                <td class="px-4 py-3 text-xs text-gray-400">${new Date(job.createdAt).toLocaleString('en-CA')}</td>
                <td class="px-4 py-3 text-xs space-y-2">
                    ${job.status === 'done' && (job.totalRows - job.invalidRows > 0) ?
                `<a href="/export/job/${job.jobId}" class="block text-center bg-blue-900/30 text-blue-400 px-2 py-1.5 rounded hover:bg-blue-900/50 border border-blue-800 transition">⬇️ Valid Data</a>` : ''}
                    
                    ${job.status === 'done' && job.invalidRows > 0 ?
                `<a href="/download/${job.jobId}" class="block text-center bg-red-900/30 text-red-400 px-2 py-1.5 rounded hover:bg-red-900/50 border border-red-800 transition">⬇️ Error Report</a>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Failed to load history</td></tr>';
    }
}

let currentPage = 1;
let currentSortBy = 'date';
let currentSortOrder = 'DESC';

const filterDateType = document.getElementById('filterDateType');
const filterStart = document.getElementById('filterStart');
const filterEnd = document.getElementById('filterEnd');

// Default filters to the last 30 days
const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

if (filterEnd && filterStart) {
    filterEnd.value = today.toISOString().split('T')[0];
    filterStart.value = thirtyDaysAgo.toISOString().split('T')[0];
    if (filterDateType) filterDateType.value = 'createdAt';
}

function buildQueryString(isExport = false) {
    const params = new URLSearchParams({
        dateType: filterDateType ? filterDateType.value : 'date',
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
    });

    if (filterStart && filterStart.value) params.append('startDate', filterStart.value);
    if (filterEnd && filterEnd.value) params.append('endDate', filterEnd.value);

    if (!isExport) {
        params.append('page', currentPage);
        params.append('limit', 10);
    }
    return params.toString();
}

async function loadTransactions() {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">Loading...</td></tr>';

    try {
        const res = await fetch(`/transactions?${buildQueryString()}`);
        const data = await res.json();

        if (data.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No data found for these filters.</td></tr>';
            document.getElementById('pageIndicator').innerText = `Page 0 of 0`;
            return;
        }

        tbody.innerHTML = data.transactions.map(t => `
            <tr class="hover:bg-gray-700/50 transition">
                <td class="px-4 py-3 whitespace-nowrap text-gray-300">${t.date}</td>
                <td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">${new Date(t.createdAt).toLocaleDateString('en-CA')}</td>
                <td class="px-4 py-3 truncate max-w-xs text-gray-300" title="${t.description}">${t.description}</td>
                <td class="px-4 py-3"><span class="bg-gray-700 border border-gray-600 text-gray-300 px-2.5 py-1 rounded-full text-xs">${t.category || 'None'}</span></td>
                <td class="px-4 py-3 font-mono text-right font-medium ${t.amount < 0 ? 'text-red-400' : 'text-green-400'}">${Number(t.amount).toFixed(2)}</td>
            </tr>
        `).join('');

        document.getElementById('pageIndicator').innerText = `Page ${data.currentPage} of ${data.totalPages} (${data.totalItems} items)`;
        document.getElementById('prevPageBtn').disabled = data.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = data.currentPage >= data.totalPages;

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-red-500">Failed to load transactions</td></tr>';
    }
}

window.toggleSort = function (column) {
    if (currentSortBy === column) {
        currentSortOrder = currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
        currentSortBy = column;
        currentSortOrder = 'DESC';
    }
    currentPage = 1;
    loadTransactions();
};

const applyBtn = document.getElementById('applyFiltersBtn');
if (applyBtn) {
    applyBtn.addEventListener('click', () => {
        currentPage = 1;
        loadTransactions();
    });
}

const clearBtn = document.getElementById('clearFiltersBtn');
if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        filterStart.value = '';
        filterEnd.value = '';
        currentPage = 1;
        loadTransactions();
    });
}

const prevBtn = document.getElementById('prevPageBtn');
if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; loadTransactions(); }
    });
}

const nextBtn = document.getElementById('nextPageBtn');
if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        currentPage++; loadTransactions();
    });
}

const exportBtn = document.getElementById('globalExportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        if (!filterStart.value || !filterEnd.value) {
            return alert("Please set both a Start Date and End Date to export data.");
        }

        window.location.href = `/transactions/export?${buildQueryString(true)}`;
    });
}