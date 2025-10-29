// Show insert modal
function showInsertModal() {
    if (!currentDatabase || !currentSchema || !currentTable || availableColumns.length === 0) {
        showMessage('Please select a table first', 'error');
        return;
    }
    
    const insertWarning = document.getElementById('insertWarning');
    insertWarning.classList.add('hidden');
    
    let formHtml = '<div style="max-height: 400px; overflow-y: auto;">';
    availableColumns.forEach(col => {
        const isPK = primaryKeys.includes(col);
        
        formHtml += `<div class="form-group"><label>${col} ${isPK ? '<span style="color: #4285f4;">(Primary Key)</span>' : ''}</label>`;
        formHtml += `<input type="text" id="insert-${col}" placeholder="Enter value or leave empty for NULL">`;
        formHtml += `</div>`;
    });
    formHtml += '</div>';
    
    document.getElementById('insertFormContainer').innerHTML = formHtml;
    document.getElementById('insertModal').classList.add('active');
}

// Close insert modal
function closeInsertModal() {
    document.getElementById('insertModal').classList.remove('active');
}

// Confirm insert
async function confirmInsert() {
    const values = {};
    
    availableColumns.forEach(col => {
        const input = document.getElementById(`insert-${col}`);
        if (input) {
            let value = input.value.trim();
            if (value === '') {
                values[col] = null;
            } else if (!isNaN(value) && value !== '') {
                values[col] = parseFloat(value);
            } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                values[col] = value.toLowerCase() === 'true';
            } else {
                values[col] = value;
            }
        }
    });
    
    try {
        const response = await fetch(`/api/record/${currentDatabase}/${currentSchema}/${currentTable}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values })
        });
        const result = await response.json();
        if (response.ok) {
            showMessage('Record inserted successfully!', 'success');
            closeInsertModal();
            await performSearch();
        } else {
            showMessage(result.error || 'Insert failed', 'error');
        }
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
}

// Show edit modal
function showEditModal(recordIndex) {
    recordToEdit = allRecords[recordIndex];
    const columns = Object.keys(recordToEdit);
    const editWarning = document.getElementById('editWarning');
    
    if (primaryKeys.length === 0) {
        editWarning.textContent = '⚠️ This table has no primary key. All column values will be used to identify this record.';
        editWarning.classList.remove('hidden');
    } else {
        editWarning.classList.add('hidden');
    }
    
    let formHtml = '<div style="max-height: 400px; overflow-y: auto;">';
    columns.forEach(col => {
        const value = recordToEdit[col];
        const isPK = primaryKeys.includes(col);
        
        formHtml += `<div class="form-group"><label>${col} ${isPK ? '<span style="color: #4285f4;">(Primary Key)</span>' : ''}</label>`;
        
        if (isPK) {
            formHtml += `<input type="text" id="edit-${col}" value="${value !== null ? value : ''}" disabled style="background: rgba(60, 64, 67, 0.5);">`;
        } else if (value === null) {
            formHtml += `<input type="text" id="edit-${col}" value="" placeholder="NULL">`;
        } else if (typeof value === 'number') {
            formHtml += `<input type="number" id="edit-${col}" value="${value}" step="any">`;
        } else {
            const strValue = String(value);
            if (strValue.length > 100) {
                formHtml += `<textarea id="edit-${col}" rows="4">${strValue}</textarea>`;
            } else {
                formHtml += `<input type="text" id="edit-${col}" value="${strValue}">`;
            }
        }
        formHtml += `</div>`;
    });
    formHtml += '</div>';
    
    document.getElementById('editFormContainer').innerHTML = formHtml;
    document.getElementById('editModal').classList.add('active');
}

// Close edit modal
function closeEditModal() {
    recordToEdit = null;
    document.getElementById('editModal').classList.remove('active');
}

// Confirm update
async function confirmUpdate() {
    if (!recordToEdit) return;
    
    const uniqueKeys = {};
    const updates = {};
    
    if (primaryKeys.length > 0) {
        primaryKeys.forEach(pk => uniqueKeys[pk] = recordToEdit[pk]);
        
        Object.keys(recordToEdit).forEach(col => {
            if (!primaryKeys.includes(col)) {
                const input = document.getElementById(`edit-${col}`);
                if (input) {
                    let value = input.value;
                    if (value === '') updates[col] = null;
                    else if (input.type === 'number') updates[col] = parseFloat(value);
                    else updates[col] = value;
                }
            }
        });
    } else {
        Object.keys(recordToEdit).forEach(col => {
            uniqueKeys[col] = recordToEdit[col];
        });
        
        Object.keys(recordToEdit).forEach(col => {
            const input = document.getElementById(`edit-${col}`);
            if (input) {
                let value = input.value;
                if (value === '') updates[col] = null;
                else if (input.type === 'number') updates[col] = parseFloat(value);
                else updates[col] = value;
            }
        });
    }
    
    try {
        const response = await fetch(`/api/record/${currentDatabase}/${currentSchema}/${currentTable}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uniqueKeys, updates })
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Record updated!', 'success');
            closeEditModal();
            await performSearch();
        } else {
            showMessage(data.error || 'Update failed', 'error');
        }
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
    }
}

// Show delete modal
function showDeleteModal(recordIndex) {
    recordToDelete = allRecords[recordIndex];
    const deleteWarning = document.getElementById('deleteWarning');
    
    if (primaryKeys.length === 0) {
        deleteWarning.textContent = '⚠️ WARNING: This table has no primary key. All column values will be used to identify and delete this record. This may delete multiple rows if they have identical values. Are you sure you want to continue?';
    } else {
        deleteWarning.textContent = 'Are you sure you want to delete this record? This action cannot be undone.';
    }
    
    document.getElementById('deleteModal').classList.add('active');
}

// Close delete modal
function closeDeleteModal() {
    recordToDelete = null;
    document.getElementById('deleteModal').classList.remove('active');
}

// Confirm delete
async function confirmDelete() {
    if (!recordToDelete) return;
    
    const uniqueKeys = {};
    
    if (primaryKeys.length > 0) {
        primaryKeys.forEach(pk => uniqueKeys[pk] = recordToDelete[pk]);
    } else {
        Object.keys(recordToDelete).forEach(col => {
            uniqueKeys[col] = recordToDelete[col];
        });
    }
    
    try {
        const response = await fetch(`/api/record/${currentDatabase}/${currentSchema}/${currentTable}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uniqueKeys })
        });
        const data = await response.json();
        if (response.ok) {
            showMessage('Record deleted!', 'success');
            closeDeleteModal();
            await performSearch();
        } else {
            showMessage(data.error || 'Delete failed', 'error');
            closeDeleteModal();
        }
    } catch (error) {
        showMessage('Error: ' + error.message, 'error');
        closeDeleteModal();
    }
}