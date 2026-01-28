import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.4/+esm';

console.log("admin-payment-terms.js script running.");

const supabase = createClient("https://sfknzqkiqxivzcualcau.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma256cWtpcXhpdnpjdWFsY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTU0ODksImV4cCI6MjA3MjM3MTQ4OX0.JKjOS9NRdbVH1UanfqmBeHmMSnlWlZtDr-5LdKw5YaA");

// --- DOM Elements for Payment Terms ---
const termsList = document.getElementById('terms-list');
const termModal = document.getElementById('term-modal');
const closeTermModalBtn = document.getElementById('term-modal-close');
const createTermBtn = document.getElementById('create-term-btn');
const saveTermBtn = document.getElementById('save-term-btn');
const termModalTitle = document.getElementById('modal-title');
const termIdInput = document.getElementById('term-id');
const termNameInput = document.getElementById('term-name');
const termDescriptionInput = document.getElementById('term-description');
const paymentScheduleBuilder = document.getElementById('payment-schedule-builder');
const addScheduleItemBtn = document.getElementById('add-schedule-item-btn');
const loader = document.getElementById('loader');

// --- DOM Elements for Payment Events ---
const eventModal = document.getElementById('event-modal');
const manageEventsBtn = document.getElementById('manage-events-btn');
const closeEventModalBtn = document.getElementById('event-modal-close');
const saveEventBtn = document.getElementById('save-event-btn');
const eventsTableBody = document.querySelector('#events-table tbody');
const eventNameInput = document.getElementById('event-name');
const sourceTableInput = document.getElementById('source-table');
const dateColumnInput = document.getElementById('date-column');
const eventDescriptionInput = document.getElementById('event-description');

let availableEvents = [];

async function loadAvailableEvents() {
    const { data, error } = await supabase.from('payment_event_definitions').select('event_name');
    if (error) {
        console.error('Error loading available events:', error);
        return;
    }
    availableEvents = data;
}

// --- Data Functions (Payment Terms) ---

async function loadPaymentTerms() {
    console.log("Attempting to load payment terms...");
    loader.style.display = 'flex';

    const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .order('name', { ascending: true });

    console.log("Supabase response received.", { data, error });

    if (error) {
        console.error('Error loading payment terms:', error);
        termsList.innerHTML = `<p>Error loading data: ${error.message}</p>`;
        loader.style.display = 'none';
        return;
    }

    renderTermsList(data);
    loader.style.display = 'none';
}

async function savePaymentTerm() {
    const termData = {
        id: termIdInput.value || undefined,
        name: termNameInput.value,
        description: termDescriptionInput.value,
        payment_schedule: JSON.parse(getScheduleFromBuilder()),
    };

    if (!termData.name) {
        alert('Term Name is required.');
        return;
    }

    const { data, error } = await supabase.from('payment_terms').upsert(termData).select();

    if (error) {
        console.error('Error saving payment term:', error);
        alert('Failed to save payment term: ' + error.message);
    } else {
        closeTermModal();
        loadPaymentTerms();
    }
}

async function deletePaymentTerm(termId, termName) {
    if (!confirm(`Are you sure you want to delete the term "${termName}"?`)) {
        return;
    }
    const { error } = await supabase.from('payment_terms').delete().eq('id', termId);
    if (error) {
        alert('Failed to delete payment term: ' + error.message);
    } else {
        loadPaymentTerms();
    }
}

// --- UI Functions (Payment Terms) ---

function renderScheduleBuilder(schedule = []) {
    // Clear only the items, not the header
    paymentScheduleBuilder.querySelectorAll('.schedule-item').forEach(el => el.remove());

    if (schedule.length === 0) {
        addScheduleItem(); // Start with one item if empty
    } else {
        schedule.forEach(item => addScheduleItem(item));
    }
}

function addScheduleItem(item = {}) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'schedule-item';
    const eventOptions = availableEvents.map(e => `<option value="${e.event_name}" ${item.event === e.event_name ? 'selected' : ''}>${e.event_name}</option>`).join('');

    itemDiv.innerHTML = `
        <input type="number" class="percentage-input" placeholder="%" value="${item.percentage || ''}">
        <select class="event-select">${eventOptions}</select>
        <input type="number" class="days-after-input" placeholder="Days After" value="${item.days_after || ''}">
        <button class="btn btn-danger btn-sm remove-item-btn">&times;</button>
    `;
    paymentScheduleBuilder.appendChild(itemDiv);

    itemDiv.querySelector('.remove-item-btn').addEventListener('click', () => {
        itemDiv.remove();
    });
}

function getScheduleFromBuilder() {
    const items = [];
    const itemDivs = paymentScheduleBuilder.querySelectorAll('.schedule-item');
    itemDivs.forEach(div => {
        const item = {
            event: div.querySelector('.event-select').value,
            percentage: parseInt(div.querySelector('.percentage-input').value, 10),
            days_after: parseInt(div.querySelector('.days-after-input').value, 10) || null
        };
        if (item.event && !isNaN(item.percentage)) {
            items.push(item);
        }
    });
    return JSON.stringify(items);
}

function renderTermsList(terms) {
    console.log("Rendering terms list with:", terms);
    termsList.innerHTML = '';
    if (!terms || terms.length === 0) {
        termsList.innerHTML = `<p>No payment terms found.</p>`;
        return;
    }

    terms.forEach(term => {
        const termCard = document.createElement('div');
        termCard.className = 'term-card';
        termCard.innerHTML = `
            <div class="term-details">
                <h4>${term.name}</h4>
                <p>${term.description || ''}</p>
            </div>
            <div class="term-actions">
                <a href="#" class="btn-icon button-secondary edit-btn" title="Edit"><i class="fas fa-pen-to-square"></i></a>
                <a href="#" class="btn-icon button-secondary delete-btn" title="Delete"><i class="fas fa-trash"></i></a>
            </div>
        `;
        termCard.querySelector('.edit-btn').addEventListener('click', (e) => { e.preventDefault(); openEditModal(term); });
        termCard.querySelector('.delete-btn').addEventListener('click', (e) => { e.preventDefault(); deletePaymentTerm(term.id, term.name); });
        termsList.appendChild(termCard);
    });
}

function openCreateModal() {
    termModalTitle.textContent = 'Create Payment Term';
    termIdInput.value = '';
    termNameInput.value = '';
    termDescriptionInput.value = '';
    renderScheduleBuilder([], availableEvents);
    termModal.style.display = 'flex';
}

function openEditModal(term) {
    termModalTitle.textContent = 'Edit Payment Term';
    termIdInput.value = term.id;
    termNameInput.value = term.name;
    termDescriptionInput.value = term.description;
    renderScheduleBuilder(term.payment_schedule, availableEvents);
    termModal.style.display = 'flex';
}

function closeTermModal() { termModal.style.display = 'none'; }


// --- Data Functions (Events) ---

async function loadEvents() {
    const { data, error } = await supabase
        .from('payment_event_definitions')
        .select('*')
        .order('event_name');

    if (error) {
        console.error('Error loading events:', error);
        eventsTableBody.innerHTML = `<tr><td colspan="4">Error loading events.</td></tr>`;
        return;
    }
    renderEventsTable(data);
}

async function saveNewEvent() {
    const eventData = {
        event_name: eventNameInput.value,
        source_table: sourceTableInput.value,
        date_column: dateColumnInput.value,
        description: eventDescriptionInput.value
    };

    if (!eventData.event_name || !eventData.source_table || !eventData.date_column) {
        alert('Event Name, Source Table, and Date Column are required.');
        return;
    }

    // Call the edge function instead of inserting directly
    const { data, error } = await supabase.functions.invoke('create-payment-event', {
        body: eventData,
    });

    if (error) {
        alert(`Failed to save event: ${error.message}`);
    } else {
        alert(data.message); // Show success message from function
        eventNameInput.value = '';
        sourceTableInput.value = '';
        dateColumnInput.value = '';
        eventDescriptionInput.value = '';
        loadEvents(); // Refresh the list
    }
}

async function deleteEvent(eventName) {
    if (!confirm(`Are you sure you want to delete the event "${eventName}"? This cannot be undone.`)) {
        return;
    }

    const { error } = await supabase.from('payment_event_definitions').delete().eq('event_name', eventName);

    if (error) {
        alert('Failed to delete event: ' + error.message);
    } else {
        loadEvents();
    }
}

// --- UI Functions (Events) ---

function renderEventsTable(events) {
    eventsTableBody.innerHTML = '';
    if (!events || events.length === 0) {
        eventsTableBody.innerHTML = `<tr><td colspan="4">No events defined.</td></tr>`;
        return;
    }

    events.forEach(event => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${event.event_name}</td>
            <td>${event.source_table}</td>
            <td>${event.date_column}</td>
            <td><a href="#" class="btn-icon button-secondary delete-event-btn" title="Delete"><i class="fas fa-trash"></i></a></td>
        `;
        tr.querySelector('.delete-event-btn').addEventListener('click', () => deleteEvent(event.event_name));
        eventsTableBody.appendChild(tr);
    });
}

function openEventsModal() {
    eventModal.style.display = 'flex';
    loadEvents();
}

function closeEventsModal() {
    eventModal.style.display = 'none';
}


// --- Event Listeners ---

// Term Modal
createTermBtn.addEventListener('click', openCreateModal);
closeTermModalBtn.addEventListener('click', closeTermModal);
saveTermBtn.addEventListener('click', savePaymentTerm);
addScheduleItemBtn.addEventListener('click', (e) => { e.preventDefault(); addScheduleItem(); });

// Event Modal
manageEventsBtn.addEventListener('click', openEventsModal);
closeEventModalBtn.addEventListener('click', closeEventsModal);
saveEventBtn.addEventListener('click', saveNewEvent);

window.onclick = function(event) {
    if (event.target == termModal) {
        closeTermModal();
    }
    if (event.target == eventModal) {
        closeEventsModal();
    }
}

// --- Initial Load ---
loadAvailableEvents();
loadPaymentTerms();

