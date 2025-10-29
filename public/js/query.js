// Perform search
async function performSearch() {
    if (!currentDatabase || !currentSchema || !currentTable) {
        showMessage('Please select database and table', 'error');
        return;
    }
    
    const criteria = {};
    const criteriaModes = {};
    const rows = document.querySelectorAll('.criteria-row');
    
    rows.forEach(row => {
        const id = row.id.split('-')[1];
        const field = document.getElementById(`field-${id}`)?.value;
        const value = document.getElementById(`value-${id}`)?.value;
        const mode = document.getElementById(`mode-${id}`)?.value || 'contains';
        
        if (field && value) {
            criteria[field] = value;
            criteriaModes[field] = mode;
        }
    });
    
    const limit = document.getElementById('resultLimit')?.value || 100;
    const orderBy = document.getElementById('orderByColumn')?.value || '';
    const orderDirection = document.getElementById('orderDirection')?.value || 'ASC';
    const distinct = document.getElementById('distinctResults')?.checked || false;
    
    // Check if searching with no criteria
    const hasCriteria = Object.keys(criteria).length > 0;
    
    if (!hasCriteria && !orderBy) {
        showMessage('⚠️ Searching all records with no ORDER BY. This will return random rows. Consider adding ORDER BY for meaningful results.', 'warning');
    } else if (!hasCriteria) {
        showMessage(`Fetching top ${limit || 1000} rows ordered by ${orderBy}...`, 'info');
    } else {
        showMessage('Searching...', 'info');
    }
    
    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                database: currentDatabase, 
                schema: currentSchema, 
                table: currentTable, 
                criteria, 
                criteriaModes,
                limit: limit ? parseInt(limit) : null,
                orderBy,
                orderDirection,
                distinct,
                searchMode: 'contains' // Default for backward compatibility
            })
        });
        const data = await response.json();
        if (response.ok) {
            // Build a readable query description for history
            let queryDesc = `SELECT${distinct ? ' DISTINCT' : ''} TOP ${limit || 1000} * FROM [${currentSchema}].[${currentTable}]`;
            if (Object.keys(criteria).length > 0) {
                const whereParts = Object.entries(criteria).map(([k, v]) => `${k}='${v}'`);
                queryDesc += ` WHERE ${whereParts.join(' AND ')}`;
            }
            if (orderBy) {
                queryDesc += ` ORDER BY ${orderBy} ${orderDirection}`;
            }
            
            // Save to history
            QueryHistory.saveQuery(queryDesc, currentDatabase, 'simple', {
                schema: currentSchema,
                table: currentTable,
                criteria: criteria,
                limit: limit,
                orderBy: orderBy,
                orderDirection: orderDirection,
                distinct: distinct
            });
            
            const noCriteriaNote = data.noCriteria && orderBy ? 
                ` - Showing top ${limit || 1000} by ${orderBy}` : '';
            displayResults(data.records, data.limited, data.duration, false, noCriteriaNote);
        } else {
            // Show helpful error with suggestion
            const errorMsg = data.error || 'Search failed';
            const suggestion = data.suggestion ? `\n\n💡 Tip: ${data.suggestion}` : '';
            showMessage(errorMsg + suggestion, 'error');
        }
    } catch (error) {
        showMessage('Connection error: ' + error.message, 'error');
    }
}

// Execute custom query
async function executeCustomQuery() {
    const database = document.getElementById('customDatabase').value;
    const query = document.getElementById('customQuery').value.trim();
    
    if (!database) {
        showMessage('Please select a database', 'error');
        return;
    }
    
    if (!query) {
        showMessage('Please enter a SQL query', 'error');
        return;
    }
    
    showMessage('Executing query...', 'info');
    
    try {
        const response = await fetch('/api/custom-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ database, query })
        });
        const data = await response.json();
        if (response.ok) {
            // Save to history
            QueryHistory.saveQuery(query, database, 'custom');
            
            displayResults(data.records, false, data.duration, true);
        } else {
            showMessage(data.error || 'Query failed', 'error');
        }
    } catch (error) {
        showMessage('Connection error: ' + error.message, 'error');
    }
}

// Display results
function displayResults(records, limited, duration, isCustomQuery = false, searchModeText = '') {
    if (records.length === 0) {
        showMessage('No records found', 'info');
        return;
    }
    
    allRecords = records;
    const container = document.getElementById('resultsContainer');
    const tableDiv = document.getElementById('resultsTable');
    const count = document.getElementById('resultCount');
    count.textContent = records.length + (limited ? '+' : '');
    
    const columns = Object.keys(records[0]);
    
    let html = '<table><thead><tr>';
    columns.forEach(col => html += `<th>${col}</th>`);
    
    // Only show actions column for simple search mode
    if (!isCustomQuery && currentMode === 'simple') {
        html += '<th>Actions</th>';
    }
    
    html += '</tr></thead><tbody>';
    
    records.forEach((record, index) => {
        html += '<tr>';
        columns.forEach(col => {
            const value = record[col];
            let displayValue = '';
            if (value === null || value === undefined) {
                displayValue = '<em style="color: #999;">NULL</em>';
            } else if (value instanceof Date) {
                displayValue = value.toLocaleString();
            } else {
                const strValue = String(value);
                displayValue = strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue;
            }
            html += `<td>${displayValue}</td>`;
        });
        
        if (!isCustomQuery && currentMode === 'simple') {
            html += `<td><button class="edit-btn-inline" onclick="showEditModal(${index})">Edit</button><button class="delete-btn-inline" onclick="showDeleteModal(${index})">Delete</button></td>`;
        }
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
    container.classList.remove('hidden');
    
    let message = `Found ${records.length} records in ${duration}ms${searchModeText}`;
    if (!isCustomQuery && primaryKeys.length === 0) {
        message += ' ⚠️ No primary key - using all columns for identification';
    }
    if (limited) {
        message += ' 🔔 Results limited - refine your search for more specific results';
    }
    showMessage(message, primaryKeys.length > 0 || isCustomQuery ? 'success' : 'warning');
}
