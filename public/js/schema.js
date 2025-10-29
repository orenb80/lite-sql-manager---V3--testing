// Schema Viewer
const SchemaViewer = {
    currentDatabase: '',
    currentSchema: '',
    currentTable: '',

    // Load tables for schema viewer
    async loadTablesForSchema() {
        const database = document.getElementById('schemaDatabase').value;
        
        if (!database) {
            document.getElementById('schemaDetails').classList.add('hidden');
            return;
        }
        
        this.currentDatabase = database;

        try {
            const response = await fetch(`/api/tables/${database}`);
            const tables = await response.json();
            
            const tableSelect = document.getElementById('schemaTable');
            tableSelect.innerHTML = '<option value="">-- Select Table --</option>';
            
            tables.forEach(table => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ schema: table.schema, name: table.name });
                option.textContent = table.fullName;
                tableSelect.appendChild(option);
            });
            
            document.getElementById('schemaDetails').classList.add('hidden');
            showMessage('Tables loaded', 'success');
        } catch (error) {
            showMessage('Failed to load tables: ' + error.message, 'error');
        }
    },

    // Load table schema details
    async loadTableSchema() {
        const tableSelect = document.getElementById('schemaTable');
        const tableValue = tableSelect.value;
        
        if (!tableValue) {
            document.getElementById('schemaDetails').classList.add('hidden');
            return;
        }
        
        const tableInfo = JSON.parse(tableValue);
        this.currentSchema = tableInfo.schema;
        this.currentTable = tableInfo.name;
        
        showMessage('Loading schema information...', 'info');
        
        try {
            // Load column information
            const columnsResponse = await fetch(`/api/columns/${this.currentDatabase}/${this.currentSchema}/${this.currentTable}`);
            const columnsData = await columnsResponse.json();
            
            // Load foreign keys
            const fkResponse = await fetch(`/api/foreign-keys/${this.currentDatabase}/${this.currentSchema}/${this.currentTable}`);
            const fkData = await fkResponse.json();
            
            // Load indexes
            const indexResponse = await fetch(`/api/indexes/${this.currentDatabase}/${this.currentSchema}/${this.currentTable}`);
            const indexData = await indexResponse.json();
            
            // Display table info
            this.displayTableInfo(columnsData, fkData, indexData);
            
            document.getElementById('schemaDetails').classList.remove('hidden');
            showMessage('Schema loaded successfully', 'success');
        } catch (error) {
            showMessage('Failed to load schema: ' + error.message, 'error');
        }
    },

    // Display table information
    displayTableInfo(columnsData, fkData, indexData) {
        // Table basic info
        const tableInfoHtml = `
            <div style="background: rgba(60, 64, 67, 0.3); padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                <strong>Full Name:</strong> ${this.currentSchema}.${this.currentTable}<br>
                <strong>Schema:</strong> ${this.currentSchema}<br>
                <strong>Table:</strong> ${this.currentTable}<br>
                <strong>Total Columns:</strong> ${columnsData.columns.length}
            </div>
        `;
        document.getElementById('schemaTableInfo').innerHTML = tableInfoHtml;
        
        // Columns
        let columnsHtml = '<table style="width: 100%;"><thead><tr><th>Column Name</th><th>Data Type</th><th>Max Length</th><th>Nullable</th><th>Default</th></tr></thead><tbody>';
        
        columnsData.columns.forEach(col => {
            const isPK = columnsData.primaryKeys.includes(col.COLUMN_NAME);
            const pkBadge = isPK ? ' <span style="background: #4285f4; padding: 2px 6px; border-radius: 3px; font-size: 11px;">PK</span>' : '';
            const nullable = col.IS_NULLABLE === 'YES' ? 'Yes' : 'No';
            const defaultValue = col.COLUMN_DEFAULT || '-';
            const maxLength = col.CHARACTER_MAXIMUM_LENGTH || '-';
            
            columnsHtml += `
                <tr>
                    <td><strong>${col.COLUMN_NAME}</strong>${pkBadge}</td>
                    <td>${col.DATA_TYPE}</td>
                    <td>${maxLength}</td>
                    <td>${nullable}</td>
                    <td style="font-family: monospace; font-size: 12px;">${defaultValue}</td>
                </tr>
            `;
        });
        
        columnsHtml += '</tbody></table>';
        document.getElementById('schemaColumns').innerHTML = columnsHtml;
        
        // Primary Keys
        if (columnsData.primaryKeys.length === 0) {
            document.getElementById('schemaPrimaryKeys').innerHTML = '<div class="info">No primary keys defined</div>';
        } else {
            let pkHtml = '<div style="background: rgba(66, 133, 244, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #4285f4;">';
            pkHtml += columnsData.primaryKeys.map(pk => `<span style="background: #4285f4; padding: 4px 8px; margin-right: 5px; border-radius: 3px; display: inline-block; margin-bottom: 5px;">${pk}</span>`).join('');
            pkHtml += '</div>';
            document.getElementById('schemaPrimaryKeys').innerHTML = pkHtml;
        }
        
        // Foreign Keys
        if (!fkData.foreignKeys || fkData.foreignKeys.length === 0) {
            document.getElementById('schemaForeignKeys').innerHTML = '<div class="info">No foreign keys defined</div>';
        } else {
            let fkHtml = '<table style="width: 100%;"><thead><tr><th>Column</th><th>References</th><th>FK Name</th></tr></thead><tbody>';
            
            fkData.foreignKeys.forEach(fk => {
                fkHtml += `
                    <tr>
                        <td><strong>${fk.column}</strong></td>
                        <td>${fk.referencedTable}.${fk.referencedColumn}</td>
                        <td style="font-size: 11px; color: #9aa0a6;">${fk.name}</td>
                    </tr>
                `;
            });
            
            fkHtml += '</tbody></table>';
            document.getElementById('schemaForeignKeys').innerHTML = fkHtml;
        }
        
        // Indexes
        if (!indexData.indexes || indexData.indexes.length === 0) {
            document.getElementById('schemaIndexes').innerHTML = '<div class="info">No indexes defined</div>';
        } else {
            let indexHtml = '<table style="width: 100%;"><thead><tr><th>Index Name</th><th>Columns</th><th>Type</th><th>Unique</th></tr></thead><tbody>';
            
            indexData.indexes.forEach(idx => {
                const uniqueBadge = idx.is_unique ? '<span style="background: #34a853; padding: 2px 6px; border-radius: 3px; font-size: 11px;">UNIQUE</span>' : '';
                
                indexHtml += `
                    <tr>
                        <td><strong>${idx.name}</strong></td>
                        <td>${idx.columns}</td>
                        <td>${idx.type}</td>
                        <td>${uniqueBadge || 'No'}</td>
                    </tr>
                `;
            });
            
            indexHtml += '</tbody></table>';
            document.getElementById('schemaIndexes').innerHTML = indexHtml;
        }
    }
};
