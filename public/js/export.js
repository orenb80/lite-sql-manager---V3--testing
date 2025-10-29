// Export to CSV
function exportToCSV() {
    if (allRecords.length === 0) {
        showMessage('No data to export', 'warning');
        return;
    }
    
    const columns = Object.keys(allRecords[0]);
    let csv = columns.join(',') + '\n';
    
    allRecords.forEach(record => {
        const row = columns.map(col => {
            const value = record[col];
            if (value === null || value === undefined) return '';
            const strValue = String(value);
            // Escape quotes and wrap in quotes if contains comma or quote
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return '"' + strValue.replace(/"/g, '""') + '"';
            }
            return strValue;
        });
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showMessage('CSV exported successfully!', 'success');
}

// Export to JSON
function exportToJSON() {
    if (allRecords.length === 0) {
        showMessage('No data to export', 'warning');
        return;
    }
    
    const json = JSON.stringify(allRecords, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showMessage('JSON exported successfully!', 'success');
}

// Export to Excel
function exportToExcel() {
    if (allRecords.length === 0) {
        showMessage('No data to export', 'warning');
        return;
    }
    
    // Create worksheet from records
    const worksheet = XLSX.utils.json_to_sheet(allRecords);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `export_${Date.now()}.xlsx`);
    
    showMessage('Excel exported successfully!', 'success');
}