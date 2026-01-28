import { supabase } from './supabase-client.js';

// --- DOM Elements ---
const loader = document.getElementById('loader');
const totalPayableEl = document.getElementById('total-payable');
const totalOverdueEl = document.getElementById('total-overdue');
const payableThisMonthEl = document.getElementById('payable-this-month');
const paymentsMadeYtdEl = document.getElementById('payments-made-ytd');
const statusChartCanvas = document.getElementById('status-chart');
const upcomingPaymentsChartCanvas = document.getElementById('upcoming-payments-chart');
const tableBody = document.querySelector('#payments-table tbody');
const tableHeaders = document.querySelectorAll('#payments-table th[data-sort]');
const searchBar = document.getElementById('search-bar');
const statusFilter = document.getElementById('status-filter');
const paginationControls = document.getElementById('pagination-controls');

let allPaymentsData = [];
let statusChart = null;

// Table state
let currentPage = 1;
let rowsPerPage = 50;  // Changed from 10 to 50
let sortColumn = 'due_date';
let sortDirection = 'asc';

const formatRelativeDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    const diffTime = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1) return `in ${diffDays} days`;
    if (diffDays === -1) return 'Yesterday';
    return `${-diffDays} days ago`;
};

// --- Data Loading ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
};

const drawEmptyChartMessage = (canvas, message) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#6c757d';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.restore();
};

// --- Data Loading ---
async function loadDashboardData() {
    loader.style.display = 'flex';
    
    const { data, error } = await supabase
        .from('supplier_payments')
        .select(`
            *,
            supplier (name),
            shipment (
                reference_code,
                letter_of_credit (
                    bank (name)
                )
            )
        `);

    if (error) {
        console.error('Error fetching supplier payments:', error);
        loader.style.display = 'none';
        return;
    }

    allPaymentsData = data;
    updateDashboard(data);

    loader.style.display = 'none';
}

// --- Dashboard Updates ---
function updateDashboard(data) {
    updateKpis(data);
    renderStatusChart(data);
    renderUpcomingPaymentsList(data);
    renderSparkCharts(); // Add this call
    handleFilterAndSearch(); // Use the handler to render the table with default filters
}

async function getMonthlyData(month, year) {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0).toISOString();

    const { data, error } = await supabase
        .from('supplier_payments')
        .select('total_amount, amount_paid, due_date, status, updated_at')
        .or(`and(due_date.gte.${startDate},due_date.lte.${endDate}),and(updated_at.gte.${startDate},updated_at.lte.${endDate})`);

    if (error) {
        console.error(`Error fetching data for ${month + 1}/${year}:`, error);
        return { totalPayable: 0, totalOverdue: 0, payableThisMonth: 0, paymentsMade: 0 };
    }

    const kpis = data.reduce((acc, payment) => {
        const remaining = payment.total_amount - payment.amount_paid;
        const isPaid = payment.status === 'paid';
        const dueDate = payment.due_date ? new Date(payment.due_date) : null;
        const paymentDate = new Date(payment.updated_at);

        if (!isPaid) {
            acc.totalPayable += remaining;
            if (dueDate && dueDate < new Date(endDate) && payment.status !== 'partially_paid') {
                acc.totalOverdue += remaining;
            }
            if (dueDate && dueDate.getMonth() === month && dueDate.getFullYear() === year) {
                acc.payableThisMonth += remaining;
            }
        }

        if (payment.amount_paid > 0 && paymentDate.getMonth() === month && paymentDate.getFullYear() === year) {
            acc.paymentsMade += payment.amount_paid;
        }

        return acc;
    }, { totalPayable: 0, totalOverdue: 0, payableThisMonth: 0, paymentsMade: 0 });

    return kpis;
}

async function loadSparkChartData() {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: d.getMonth(), year: d.getFullYear() });
    }

    const promises = months.map(m => getMonthlyData(m.month, m.year));
    const monthlyData = await Promise.all(promises);

    return {
        labels: months.map(m => `${m.month + 1}/${m.year}`),
        payable: monthlyData.map(d => d.totalPayable),
        overdue: monthlyData.map(d => d.totalOverdue),
        payableMonth: monthlyData.map(d => d.payableThisMonth),
        paymentsMade: monthlyData.map(d => d.paymentsMade)
    };
}

async function renderSparkCharts() {
    const sparkChartData = await loadSparkChartData();

    const sparkChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { 
                enabled: true,
                mode: 'index',
                intersect: false,
             }
        },
        scales: {
            x: { display: false },
            y: { display: false }
        },
        elements: {
            point: { radius: 0 },
            line: {
                borderWidth: 2,
                tension: 0.4
            }
        }
    };

    const createGradient = (context, color) => {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) {
            return null;
        }
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, color);
        return gradient;
    };

    new Chart(document.getElementById('payable-spark-chart'), {
        type: 'line',
        data: {
            labels: sparkChartData.labels,
            datasets: [{
                borderColor: '#3B82F6',
                data: sparkChartData.payable,
                fill: true,
                backgroundColor: (context) => createGradient(context, 'rgba(59, 130, 246, 0.2)')
            }]
        },
        options: sparkChartOptions
    });

    new Chart(document.getElementById('overdue-spark-chart'), {
        type: 'line',
        data: {
            labels: sparkChartData.labels,
            datasets: [{
                borderColor: '#EF4444',
                data: sparkChartData.overdue,
                fill: true,
                backgroundColor: (context) => createGradient(context, 'rgba(239, 68, 68, 0.2)')
            }]
        },
        options: sparkChartOptions
    });

    new Chart(document.getElementById('payable-month-spark-chart'), {
        type: 'line',
        data: {
            labels: sparkChartData.labels,
            datasets: [{
                borderColor: '#F59E0B',
                data: sparkChartData.payableMonth,
                fill: true,
                backgroundColor: (context) => createGradient(context, 'rgba(245, 158, 11, 0.2)')
            }]
        },
        options: sparkChartOptions
    });

    new Chart(document.getElementById('payments-made-spark-chart'), {
        type: 'line',
        data: {
            labels: sparkChartData.labels,
            datasets: [{
                borderColor: '#10B981',
                data: sparkChartData.paymentsMade,
                fill: true,
                backgroundColor: (context) => createGradient(context, 'rgba(16, 185, 129, 0.2)')
            }]
        },
        options: sparkChartOptions
    });
}

function updateKpis(data) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const kpis = data.reduce((acc, payment) => {
        const remaining = payment.total_amount - payment.amount_paid;
        const isPaid = payment.status === 'paid';
        const dueDate = payment.due_date ? new Date(payment.due_date) : null;

        if (!isPaid) {
            acc.totalPayable += remaining;

            if (dueDate && dueDate < now && payment.status !== 'partially_paid') {
                acc.totalOverdue += remaining;
            }

            if (dueDate && dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear) {
                acc.payableThisMonth += remaining;
            }
        }

        const paymentDate = new Date(payment.updated_at);
        if (payment.amount_paid > 0 && paymentDate.getFullYear() === currentYear) {
            acc.paymentsMadeYtd += payment.amount_paid;
        }

        return acc;
    }, { totalPayable: 0, totalOverdue: 0, payableThisMonth: 0, paymentsMadeYtd: 0 });

    totalPayableEl.textContent = formatCurrency(kpis.totalPayable);
    totalOverdueEl.textContent = formatCurrency(kpis.totalOverdue);
    payableThisMonthEl.textContent = formatCurrency(kpis.payableThisMonth);
    paymentsMadeYtdEl.textContent = formatCurrency(kpis.paymentsMadeYtd);
}

function renderStatusChart(data) {
    if (statusChart) {
        statusChart.destroy();
    }

    if (!data || data.length === 0) {
        drawEmptyChartMessage(statusChartCanvas, 'No payment data available.');
        return;
    }

    const statusCounts = data.reduce((acc, p) => {
        let status = p.status;
        if (status === 'pending' && p.due_date && new Date(p.due_date) < new Date()) {
            status = 'overdue';
        }
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const chartData = {
        labels: Object.keys(statusCounts).map(s => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: [
                '#ffc107', // pending
                '#17a2b8', // partially_paid
                '#28a745', // paid
                '#dc3545'  // overdue
            ],
            borderColor: '#fff',
            borderWidth: 2
        }]
    };

    statusChart = new Chart(statusChartCanvas, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

function renderUpcomingPaymentsList(data) {
    const listContainer = document.getElementById('upcoming-payments-list');
    if (!listContainer) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const unpaid = data
        .filter(p => p.status !== 'paid' && p.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    if (unpaid.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-secondary-color);">No upcoming or overdue payments.</p>';
        return;
    }

    const groups = {
        overdue: [],
        dueSoon: [],
        upcoming: []
    };

    unpaid.forEach(p => {
        const dueDate = new Date(p.due_date);
        const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 0) {
            groups.overdue.push(p);
        } else if (diffDays <= 7) {
            groups.dueSoon.push(p);
        } else {
            groups.upcoming.push(p);
        }
    });

    let html = '';

    const createGroupHtml = (title, payments, iconClass, groupClass) => {
        if (payments.length === 0) return '';
        let groupHtml = `<div class="payment-group ${groupClass}"><h4><i class="fas ${iconClass}"></i> ${title}</h4>`;
        payments.forEach(p => {
            const bankName = p.shipment?.letter_of_credit?.bank?.name || 'N/A';
            const isOverdue = groupClass === 'overdue-group' ? 'overdue' : '';
            groupHtml += `
                <div class="payment-item ${isOverdue}" data-shipment-id="${p.shipment_id}">
                    <div class="payment-info">
                        <span class="supplier-name">${p.supplier.name}</span>
                        <span class="shipment-ref">${p.shipment.reference_code} &bull; ${bankName}</span>
                    </div>
                    <div class="payment-due">
                        <span class="amount">${formatCurrency(p.total_amount - p.amount_paid)}</span>
                        <span class="due-date">${formatRelativeDate(p.due_date)}</span>
                    </div>
                </div>
            `;
        });
        return groupHtml + '</div>';
    };

    html += createGroupHtml('Overdue', groups.overdue, 'fa-exclamation-circle', 'overdue-group');
    html += createGroupHtml('Due in next 7 days', groups.dueSoon, 'fa-calendar-alt', 'due-soon-group');
    html += createGroupHtml('Upcoming', groups.upcoming, 'fa-calendar-day', 'upcoming-group');

    listContainer.innerHTML = html;
}

function renderTable(data) {
    // 1. Sort data
    const sortedData = [...data].sort((a, b) => {
        const aValue = getNestedValue(a, sortColumn);
        const bValue = getNestedValue(b, sortColumn);

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // 2. Paginate data
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = sortedData.slice(startIndex, endIndex);

    // 3. Render rows
    tableBody.innerHTML = '';
    if (paginatedData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">No payments found matching your criteria.</td></tr>';
        renderPagination(0);
        return;
    }

    paginatedData.forEach(p => {
        const remaining = p.total_amount - p.amount_paid;
        let status = p.status;
        if (status !== 'paid' && p.due_date && new Date(p.due_date) < new Date()) {
            status = 'overdue';
        }
        const bankName = p.shipment?.letter_of_credit?.bank?.name || 'N/A';

        const tr = document.createElement('tr');
        tr.dataset.shipmentId = p.shipment_id; // Add this line
        if (status === 'overdue') {
            tr.classList.add('overdue-payment');
        }
        tr.innerHTML = `
            <td>${p.supplier.name}</td>
            <td>${p.shipment.reference_code}</td>
            <td>${bankName}</td>
            <td>${formatCurrency(p.total_amount)}</td>
            <td>${formatCurrency(p.amount_paid)}</td>
            <td>${formatCurrency(remaining)}</td>
            <td>${p.dollar_rate ? 'Rs ' + parseFloat(p.dollar_rate).toFixed(2) : 'N/A'}</td>
            <td>${p.due_date ? new Date(p.due_date).toLocaleDateString() : 'N/A'}</td>
            <td><span class="status-pill status-${status.replace(/ /g, '_')}">${status.replace(/_/g, ' ')}</span></td>
            <td class="action-cell">
                <button class="button-secondary btn-icon log-payment-btn" title="Log Payment"><i class="fas fa-plus-circle"></i></button>
                <a href="shipment_tracker.html?id=${p.shipment_id}" class="button-secondary btn-icon" title="View Details"><i class="fas fa-eye"></i></a>
            </td>
        `;
        tr.querySelector('.log-payment-btn').addEventListener('click', () => openPaymentLogModal(p));
        tableBody.appendChild(tr);
    });

    // 4. Render pagination
    renderPagination(sortedData.length);
    updateSortIcons();
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    paginationControls.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo; Prev';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            handleFilterAndSearch();
        }
    });
    paginationControls.appendChild(prevButton);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        pageButton.addEventListener('click', () => {
            currentPage = i;
            handleFilterAndSearch();
        });
        paginationControls.appendChild(pageButton);
    }

    // Next button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = 'Next &raquo;';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            handleFilterAndSearch();
        }
    });
    paginationControls.appendChild(nextButton);
}

function handleSort(e) {
    const newSortColumn = e.currentTarget.dataset.sort;
    
    if (sortColumn === newSortColumn) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = newSortColumn;
        sortDirection = 'asc';
    }
    currentPage = 1; // Reset to first page on new sort
    handleFilterAndSearch();
}

function updateSortIcons() {
    tableHeaders.forEach(header => {
        if (header.dataset.sort === sortColumn) {
            header.classList.add(sortDirection);
        } else {
            header.classList.remove('asc', 'desc');
        }
    });
}

function getNestedValue(obj, path) {
    if (path === 'amount_remaining') {
        return obj.total_amount - obj.amount_paid;
    }
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

export function initPaymentSection(supabase, shipmentData, totalAmount) {
    const paymentContainer = document.getElementById('supplier-payment-container');
    if (!paymentContainer) return;

    const payment = shipmentData.supplier_payments;
    if (!payment) {
        paymentContainer.innerHTML = '<h3>Supplier Payment Details</h3><p>No payment information available for this shipment.</p>';
        return;
    }

    const amountRemaining = payment.total_amount - payment.amount_paid;
    const percentagePaid = (payment.amount_paid / payment.total_amount) * 100;

    let paymentHtml = `
        <h3>Supplier Payment Details</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <span class="label">Payment Term</span>
                <span class="value">${payment.payment_terms.name}</span>
            </div>
            <div class="summary-item">
                <span class="label">Total Amount</span>
                <span class="value">${formatCurrency(payment.total_amount)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Amount Paid</span>
                <span class="value">${formatCurrency(payment.amount_paid)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Amount Remaining</span>
                <span class="value">${formatCurrency(amountRemaining)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Dollar Rate</span>
                <span class="value">${payment.dollar_rate ? 'Rs ' + parseFloat(payment.dollar_rate).toFixed(2) : 'N/A'}</span>
            </div>
            <div class="summary-item">
                <span class="label">Due Date</span>
                <span class="value">${payment.due_date ? new Date(payment.due_date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div class="summary-item">
                <span class="label">Status</span>
                <span class="value"><span class="status-pill status-${payment.status.replace(/ /g, '_')}">${payment.status.replace(/_/g, ' ')}</span></span>
            </div>
        </div>
        <div class="payment-progress" style="margin-top: 15px;">
            <div class="progress-bar" style="width: ${percentagePaid}%;"></div>
        </div>
        <div style="margin-top: 15px;">
            <button class="button-secondary" onclick="openPaymentLogModalFromDetails()">View Payment Log</button>
        </div>
    `;

    paymentContainer.innerHTML = paymentHtml;

    window.openPaymentLogModalFromDetails = () => {
        openPaymentLogModal(payment);
    };
}

// --- Payment Log Modal Functions ---

const paymentLogModal = document.getElementById('payment-log-modal');
const paymentLogModalClose = document.getElementById('payment-log-modal-close');
const paymentLogTitle = document.getElementById('payment-log-title');
const transactionList = document.getElementById('transaction-list');
const currentSupplierPaymentIdInput = document.getElementById('current-supplier-payment-id');
const saveTransactionBtn = document.getElementById('save-transaction-btn');

async function openPaymentLogModal(payment) {
    paymentLogTitle.textContent = `Payment Log for ${payment.shipment.reference_code}`;
    currentSupplierPaymentIdInput.value = payment.id;

    // Render payment summary
    const summaryContainer = document.getElementById('payment-summary');
    const amountRemaining = payment.total_amount - payment.amount_paid;
    const percentagePaid = (payment.amount_paid / payment.total_amount) * 100;

    summaryContainer.innerHTML = `
        <div class="summary-item">
            <h4>Total Amount</h4>
            <p>${formatCurrency(payment.total_amount)}</p>
        </div>
        <div class="summary-item">
            <h4>Amount Paid</h4>
            <p>${formatCurrency(payment.amount_paid)}</p>
        </div>
        <div class="summary-item remaining">
            <h4>Remaining</h4>
            <p>${formatCurrency(amountRemaining)}</p>
        </div>
        <div class="summary-item">
            <h4>Dollar Rate</h4>
            <p>${payment.dollar_rate ? 'Rs ' + parseFloat(payment.dollar_rate).toFixed(2) : 'N/A'}</p>
        </div>
        <div class="payment-progress">
            <div class="progress-bar" style="width: ${percentagePaid}%"></div>
        </div>
    `;

    // Render quick pay buttons
    const quickPayContainer = document.getElementById('quick-pay-buttons');
    quickPayContainer.innerHTML = ''; // Clear previous buttons
    if (amountRemaining > 0) {
        const quickPay50 = payment.total_amount * 0.5;
        if (payment.amount_paid < quickPay50) {
            quickPayContainer.innerHTML += `<button class="quick-pay-btn" data-amount="${quickPay50 - payment.amount_paid}">Pay 50%</button>`;
        }
        quickPayContainer.innerHTML += `<button class="quick-pay-btn" data-amount="${amountRemaining}">Pay Remaining</button>`;
    }

    const paymentAmountInput = document.getElementById('payment-amount');
    quickPayContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-pay-btn')) {
            paymentAmountInput.value = e.target.dataset.amount;
        }
    });

    // Pre-fill dollar rate from payment record
    const dollarRateInput = document.getElementById('payment-dollar-rate');
    if (dollarRateInput && payment.dollar_rate) {
        dollarRateInput.value = payment.dollar_rate;
    }

    await loadTransactions(payment.id);
    paymentLogModal.style.display = 'flex';
}

function closePaymentLogModal() {
    paymentLogModal.style.display = 'none';
}

async function loadTransactions(supplierPaymentId) {
    transactionList.innerHTML = '<p>Loading...</p>';
    const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('supplier_payment_id', supplierPaymentId)
        .order('paid_at', { ascending: false });

    if (error) {
        transactionList.innerHTML = '<p class="error-message">Error loading transactions.</p>';
        return;
    }

    if (data.length === 0) {
        transactionList.innerHTML = '<p>No transactions have been logged yet.</p>';
        return;
    }

    let html = '';
    data.forEach(tx => {
        let iconClass = 'fa-money-bill-wave';
        let methodClass = 'other';
        if (tx.method?.toLowerCase().includes('card')) {
            iconClass = 'fa-credit-card';
            methodClass = 'credit-card';
        } else if (tx.method?.toLowerCase().includes('transfer')) {
            iconClass = 'fa-university';
            methodClass = 'bank-transfer';
        }

        html += `
            <div class="transaction-item ${methodClass}">
                <div class="transaction-icon"><i class="fas ${iconClass}"></i></div>
                <div class="transaction-details">
                    <span class="amount">${formatCurrency(tx.amount)}</span>
                    <span class="transaction-meta">${new Date(tx.paid_at).toLocaleDateString()}</span>
                </div>
                <div class="transaction-meta">
                    <span>${tx.method || 'N/A'} / ${tx.reference_code || 'N/A'}</span>
                    ${tx.dollar_rate ? `<span style="margin-left: 10px; color: var(--text-secondary-color);">@ Rs ${parseFloat(tx.dollar_rate).toFixed(2)}</span>` : ''}
                    ${tx.attachment_url ? `<a href="${tx.attachment_url}" target="_blank">View Attachment</a>` : ''}
                </div>
            </div>
        `;
    });
    transactionList.innerHTML = html;
}

async function saveNewTransaction() {
    const supplierPaymentId = currentSupplierPaymentIdInput.value;
    const amount = document.getElementById('payment-amount').value;
    const paid_at = document.getElementById('payment-date').value;
    const attachmentFile = document.getElementById('payment-attachment').files[0];
    const transactionMessage = document.getElementById('transaction-message');

    if (!amount || !paid_at) {
        transactionMessage.textContent = 'Payment Amount and Payment Date are required.';
        transactionMessage.className = 'message error';
        transactionMessage.style.display = 'block';
        return;
    }

    saveTransactionBtn.disabled = true;
    saveTransactionBtn.textContent = 'Saving...';
    transactionMessage.style.display = 'none';

    let attachment_url = null;

    // 1. Handle file upload
    if (attachmentFile) {
        const { data: fileData, error: fileError } = await supabase.storage
            .from('shipment-docs') // Or a more specific bucket
            .upload(`${supplierPaymentId}/${attachmentFile.name}`, attachmentFile, { upsert: true });

        if (fileError) {
            transactionMessage.textContent = 'Error uploading attachment: ' + fileError.message;
            transactionMessage.className = 'message error';
            transactionMessage.style.display = 'block';
            saveTransactionBtn.disabled = false;
            saveTransactionBtn.textContent = 'Save Transaction';
            return;
        }

        const { data: urlData } = supabase.storage.from('shipment-docs').getPublicUrl(fileData.path);
        attachment_url = urlData.publicUrl;
    }

    // 2. Insert transaction record
    const dollarRate = document.getElementById('payment-dollar-rate').value;
    const transactionData = {
        supplier_payment_id: supplierPaymentId,
        amount: parseFloat(amount),
        paid_at: paid_at,
        method: document.getElementById('payment-method').value,
        reference_code: document.getElementById('payment-reference').value,
        notes: document.getElementById('payment-notes').value,
        attachment_url: attachment_url,
        dollar_rate: dollarRate ? parseFloat(dollarRate) : null
    };

    const { error: insertError } = await supabase.from('payment_transactions').insert(transactionData);

    if (insertError) {
        transactionMessage.textContent = 'Error saving transaction: ' + insertError.message;
        transactionMessage.className = 'message error';
        transactionMessage.style.display = 'block';
    } else {
        transactionMessage.textContent = 'Transaction saved successfully!';
        transactionMessage.className = 'message success';
        transactionMessage.style.display = 'block';

        // Clear form and reload data
        document.getElementById('payment-amount').value = '';
        document.getElementById('payment-date').value = '';
        document.getElementById('payment-attachment').value = '';
        document.getElementById('payment-dollar-rate').value = '';
        document.getElementById('payment-method').value = '';
        document.getElementById('payment-reference').value = '';
        document.getElementById('payment-notes').value = '';
        
        await loadTransactions(supplierPaymentId);
        await loadDashboardData(); // Reload main dashboard data to reflect updates

        setTimeout(() => {
            transactionMessage.style.display = 'none';
        }, 3000);
    }

    saveTransactionBtn.disabled = false;
    saveTransactionBtn.textContent = 'Save Transaction';
}


if(paymentLogModalClose){
    paymentLogModalClose.addEventListener('click', closePaymentLogModal);
}
if(saveTransactionBtn){
    if(saveTransactionBtn){
    saveTransactionBtn.addEventListener('click', saveNewTransaction);
}
}

// --- Initial Load & Event Listeners ---
function handleFilterAndSearch(resetPage = false) {
    if (resetPage) {
        currentPage = 1;
    }
    const searchTerm = searchBar.value.toLowerCase();
    const status = statusFilter.value;

    const filteredData = allPaymentsData.filter(p => {
        const supplierMatch = p.supplier.name.toLowerCase().includes(searchTerm);
        const shipmentMatch = p.shipment.reference_code.toLowerCase().includes(searchTerm);
        
        let paymentStatus = p.status;
        if (paymentStatus !== 'paid' && p.due_date && new Date(p.due_date) < new Date()) {
            paymentStatus = 'overdue';
        }
        const statusMatch = !status || paymentStatus === status;

        return (supplierMatch || shipmentMatch) && statusMatch;
    });

    renderTable(filteredData);
}

// --- Initial Load & Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    searchBar.addEventListener('input', () => handleFilterAndSearch(true));
    statusFilter.addEventListener('change', () => handleFilterAndSearch(true));
    tableHeaders.forEach(header => {
        header.addEventListener('click', handleSort);
    });

    const upcomingPaymentsList = document.getElementById('upcoming-payments-list');
    if (upcomingPaymentsList) {
        upcomingPaymentsList.addEventListener('click', (e) => {
            const paymentItem = e.target.closest('.payment-item');
            if (paymentItem) {
                const shipmentId = paymentItem.dataset.shipmentId;
                const tableRow = document.querySelector(`#payments-table tbody tr[data-shipment-id="${shipmentId}"]`);
                if (tableRow) {
                    tableRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    tableRow.classList.add('highlight');
                    setTimeout(() => {
                        tableRow.classList.remove('highlight');
                    }, 2000);
                }
            }
        });
    }
});