// Global state
let availableColumns = [];
let criteriaCount = 0;
let currentDatabase = '';
let currentSchema = '';
let currentTable = '';
let recordToDelete = null;
let recordToEdit = null;
let allRecords = [];
let primaryKeys = [];
let currentMode = 'simple';

// Initialize app
window.onload = async () => {
    console.log('[Frontend] App loaded');
    try {
        const response = await fetch('/api/connection-status');
        const data = await response.json();
        if (data.connected) showMainPage(data.server, data.username);
    } catch (error) {
        console.error('[Frontend] Connection check failed:', error);
    }
};

// Mode switching
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    // Hide all modes
    document.getElementById('simpleMode').classList.add('hidden');
    document.getElementById('customMode').classList.add('hidden');
    document.getElementById('joinsMode').classList.add('hidden');
    document.getElementById('aggregationsMode').classList.add('hidden');
    document.getElementById('schemaMode').classList.add('hidden');
    document.getElementById('backupMode').classList.add('hidden');
    
    // Show selected mode
    if (mode === 'simple') {
        document.getElementById('simpleMode').classList.remove('hidden');
    } else if (mode === 'custom') {
        document.getElementById('customMode').classList.remove('hidden');
        loadDatabasesForCustom();
    } else if (mode === 'joins') {
        document.getElementById('joinsMode').classList.remove('hidden');
        loadDatabasesForJoins();
    } else if (mode === 'aggregations') {
        document.getElementById('aggregationsMode').classList.remove('hidden');
        loadDatabasesForAggregations();
    } else if (mode === 'schema') {
        document.getElementById('schemaMode').classList.remove('hidden');
        loadDatabasesForSchema();
    } else if (mode === 'backup') {
        document.getElementById('backupMode').classList.remove('hidden');
        initBackupMode();
    }
    
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('message').classList.add('hidden');
}

// Load databases for joins mode
async function loadDatabasesForJoins() {
    try {
        const response = await fetch('/api/databases');
        const databases = await response.json();
        const select = document.getElementById('joinDatabase');
        select.innerHTML = '<option value="">-- Select Database --</option>';
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            select.appendChild(option);
        });
    } catch (error) {
        showMessage('Failed to load databases: ' + error.message, 'error');
    }
}

// Load databases for aggregations mode
async function loadDatabasesForAggregations() {
    try {
        const response = await fetch('/api/databases');
        const databases = await response.json();
        const select = document.getElementById('aggDatabase');
        select.innerHTML = '<option value="">-- Select Database --</option>';
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            select.appendChild(option);
        });
    } catch (error) {
        showMessage('Failed to load databases: ' + error.message, 'error');
    }
}

// Load databases for schema viewer mode
async function loadDatabasesForSchema() {
    try {
        const response = await fetch('/api/databases');
        const databases = await response.json();
        const select = document.getElementById('schemaDatabase');
        select.innerHTML = '<option value="">-- Select Database --</option>';
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            select.appendChild(option);
        });
    } catch (error) {
        showMessage('Failed to load databases: ' + error.message, 'error');
    }
}

// Authentication field toggle
function toggleAuthFields() {
    const authType = document.getElementById('authType').value;
    const sqlAuthFields = document.getElementById('sqlAuthFields');
    const windowsCustomFields = document.getElementById('windowsCustomFields');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const windowsUsernameInput = document.getElementById('windowsUsername');
    const windowsPasswordInput = document.getElementById('windowsPassword');
    
    sqlAuthFields.style.display = 'none';
    windowsCustomFields.style.display = 'none';
    
    usernameInput.removeAttribute('required');
    passwordInput.removeAttribute('required');
    windowsUsernameInput.removeAttribute('required');
    windowsPasswordInput.removeAttribute('required');
    
    if (authType === 'sql') {
        sqlAuthFields.style.display = 'block';
        usernameInput.setAttribute('required', 'required');
        passwordInput.setAttribute('required', 'required');
    } else if (authType === 'windowsCustom') {
        windowsCustomFields.style.display = 'block';
        windowsUsernameInput.setAttribute('required', 'required');
        windowsPasswordInput.setAttribute('required', 'required');
    }
}

// Connection handler
document.getElementById('connectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const server = document.getElementById('server').value;
    const authType = document.getElementById('authType').value;
    const database = document.getElementById('database').value;
    const encrypt = document.getElementById('encrypt').checked;
    const trustCertificate = document.getElementById('trustCertificate').checked;
    const errorDiv = document.getElementById('connectionError');
    errorDiv.classList.add('hidden');

    let requestBody = {
        server,
        database,
        encrypt,
        trustCertificate
    };

    if (authType === 'sql') {
        requestBody.username = document.getElementById('username').value;
        requestBody.password = document.getElementById('password').value;
        requestBody.useWindowsAuth = false;
    } else if (authType === 'windows') {
        requestBody.useWindowsAuth = true;
    } else if (authType === 'windowsCustom') {
        requestBody.useWindowsAuth = true;
        requestBody.windowsDomain = document.getElementById('windowsDomain').value;
        requestBody.windowsUsername = document.getElementById('windowsUsername').value;
        requestBody.windowsPassword = document.getElementById('windowsPassword').value;
    }

    try {
        const response = await fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        if (response.ok) {
            showMainPage(data.server, data.username);
        } else {
            errorDiv.textContent = data.error || 'Connection failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error: ' + error.message;
        errorDiv.classList.remove('hidden');
    }
});

// Show main page
async function showMainPage(server, username) {
    document.getElementById('connectionPage').classList.add('hidden');
    document.getElementById('mainPage').classList.remove('hidden');
    document.getElementById('serverInfo').textContent = server;
    document.getElementById('userInfo').textContent = username;
    await loadDatabases();
}

// Load databases
async function loadDatabases() {
    try {
        const response = await fetch('/api/databases');
        const databases = await response.json();
        const select = document.getElementById('databaseSelect');
        select.innerHTML = '<option value="">-- Select Database --</option>';
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            select.appendChild(option);
        });
    } catch (error) {
        showMessage('Failed to load databases: ' + error.message, 'error');
    }
}

// Load databases for custom query mode
async function loadDatabasesForCustom() {
    try {
        const response = await fetch('/api/databases');
        const databases = await response.json();
        const select = document.getElementById('customDatabase');
        select.innerHTML = '<option value="">-- Select Database --</option>';
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            select.appendChild(option);
        });
    } catch (error) {
        showMessage('Failed to load databases: ' + error.message, 'error');
    }
}

// Load tables
async function loadTables() {
    const database = document.getElementById('databaseSelect').value;
    const tableSelect = document.getElementById('tableSelect');
    const searchSection = document.getElementById('searchSection');
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (!database) {
        tableSelect.disabled = true;
        tableSelect.innerHTML = '<option value="">-- Select Table --</option>';
        searchSection.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        return;
    }
    
    currentDatabase = database;
    
    try {
        const response = await fetch(`/api/tables/${database}`);
        const tables = await response.json();
        tableSelect.disabled = false;
        tableSelect.innerHTML = '<option value="">-- Select Table --</option>';
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ schema: table.schema, name: table.name });
            option.textContent = table.fullName;
            tableSelect.appendChild(option);
        });
        searchSection.classList.add('hidden');
        resultsContainer.classList.add('hidden');
    } catch (error) {
        showMessage('Failed to load tables: ' + error.message, 'error');
    }
}

// Load columns
async function loadColumns() {
    const tableSelect = document.getElementById('tableSelect');
    const tableValue = tableSelect.value;
    const searchSection = document.getElementById('searchSection');
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (!tableValue) {
        searchSection.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        return;
    }
    
    const tableInfo = JSON.parse(tableValue);
    currentSchema = tableInfo.schema;
    currentTable = tableInfo.name;
    
    try {
        const response = await fetch(`/api/columns/${currentDatabase}/${currentSchema}/${currentTable}`);
        const data = await response.json();
        availableColumns = data.columns.map(col => col.COLUMN_NAME);
        primaryKeys = data.primaryKeys || [];
        console.log('[Frontend] Primary keys:', primaryKeys);
        
        // Populate ORDER BY dropdown
        const orderBySelect = document.getElementById('orderByColumn');
        orderBySelect.innerHTML = '<option value="">-- None --</option>';
        availableColumns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            orderBySelect.appendChild(option);
        });
        
        document.getElementById('criteriaContainer').innerHTML = '';
        criteriaCount = 0;
        searchSection.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        addCriteria();
    } catch (error) {
        showMessage('Failed to load columns: ' + error.message, 'error');
    }
}

// Add search criteria
function addCriteria() {
    criteriaCount++;
    const container = document.getElementById('criteriaContainer');
    const row = document.createElement('div');
    row.className = 'criteria-row';
    row.id = `criteria-${criteriaCount}`;
    
    const selectHtml = availableColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    
    row.innerHTML = `
        <div class="form-group">
            <label>Field</label>
            <select id="field-${criteriaCount}">${selectHtml}</select>
        </div>
        <div class="form-group">
            <label>Value</label>
            <input type="text" id="value-${criteriaCount}" placeholder="Search value...">
        </div>
        <div class="form-group">
            <label>Mode</label>
            <select id="mode-${criteriaCount}">
                <option value="exact">Exact</option>
                <option value="startsWith">Starts With</option>
                <option value="contains" selected>Contains</option>
            </select>
        </div>
        ${criteriaCount > 1 ? `<button class="remove-btn" onclick="removeCriteria(${criteriaCount})">✕</button>` : '<div></div>'}
    `;
    
    container.appendChild(row);
}

// Remove criteria
function removeCriteria(id) {
    const row = document.getElementById(`criteria-${id}`);
    if (row) row.remove();
}

// Disconnect
async function disconnect() {
    try {
        await fetch('/api/disconnect', { method: 'POST' });
        document.getElementById('mainPage').classList.add('hidden');
        document.getElementById('connectionPage').classList.remove('hidden');
        document.getElementById('searchSection').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('criteriaContainer').innerHTML = '';
        document.getElementById('connectionForm').reset();
        document.getElementById('trustCertificate').checked = true;
        criteriaCount = 0;
    } catch (error) {
        console.error('[Frontend] Disconnect failed:', error);
    }
}

// Show message
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove('hidden');
    setTimeout(() => messageDiv.classList.add('hidden'), 5000);
}

// Clear search
function clearSearchAndResults() {
    const rows = document.querySelectorAll('.criteria-row');
    rows.forEach(row => {
        const id = row.id.split('-')[1];
        const valueInput = document.getElementById(`value-${id}`);
        if (valueInput) valueInput.value = '';
    });
    
    document.getElementById('orderByColumn').value = '';
    document.getElementById('distinctResults').checked = false;
    
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.classList.add('hidden');
    document.getElementById('resultsTable').innerHTML = '';
    document.getElementById('resultCount').textContent = '0';
    
    document.getElementById('message').classList.add('hidden');
    
    allRecords = [];
    
    showMessage('Search cleared', 'info');
    setTimeout(() => document.getElementById('message').classList.add('hidden'), 2000);
}

// Clear custom query
function clearCustomQuery() {
    document.getElementById('customQuery').value = '';
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('message').classList.add('hidden');
    allRecords = [];
    showMessage('Query cleared', 'info');
    setTimeout(() => document.getElementById('message').classList.add('hidden'), 2000);
}