// Aggregations Builder
const AggregationsBuilder = {
    selectedColumns: [],
    aggregateFunctions: [],
    groupByColumns: [],
    havingConditions: [],
    availableColumns: [],
    currentDatabase: '',
    currentSchema: '',
    currentTable: '',

    // Load tables for aggregations
    async loadTablesForAgg() {
        const database = document.getElementById('aggDatabase').value;
        
        if (!database) {
            return;
        }
        
        this.currentDatabase = database;

        try {
            const response = await fetch(`/api/tables/${database}`);
            const tables = await response.json();
            
            const tableSelect = document.getElementById('aggTable');
            tableSelect.innerHTML = '<option value="">-- Select Table --</option>';
            
            tables.forEach(table => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ schema: table.schema, name: table.name });
                option.textContent = table.fullName;
                tableSelect.appendChild(option);
            });
            
            showMessage('Tables loaded', 'success');
        } catch (error) {
            showMessage('Failed to load tables: ' + error.message, 'error');
        }
    },

    // Load columns for selected table
    async loadColumnsForAgg() {
        const tableSelect = document.getElementById('aggTable');
        const tableValue = tableSelect.value;
        
        if (!tableValue) {
            document.getElementById('aggControls').classList.add('hidden');
            return;
        }
        
        const tableInfo = JSON.parse(tableValue);
        this.currentSchema = tableInfo.schema;
        this.currentTable = tableInfo.name;
        
        try {
            const response = await fetch(`/api/columns/${this.currentDatabase}/${this.currentSchema}/${this.currentTable}`);
            const data = await response.json();
            this.availableColumns = data.columns.map(col => col.COLUMN_NAME);
            
            document.getElementById('aggControls').classList.remove('hidden');
            this.renderColumnSelection();
            this.renderGroupBySelection();
            this.updateSQL();
        } catch (error) {
            showMessage('Failed to load columns: ' + error.message, 'error');
        }
    },

    // Render column selection checkboxes
    renderColumnSelection() {
        const container = document.getElementById('aggColumnsContainer');
        let html = '<div class="checkbox-group" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">';
        
        this.availableColumns.forEach(col => {
            const checked = this.selectedColumns.includes(col) ? 'checked' : '';
            html += `
                <label style="margin: 5px 0;">
                    <input type="checkbox" ${checked} onchange="AggregationsBuilder.toggleColumn('${col}')">
                    ${col}
                </label>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },

    // Toggle column selection
    toggleColumn(column) {
        const index = this.selectedColumns.indexOf(column);
        if (index >= 0) {
            this.selectedColumns.splice(index, 1);
        } else {
            this.selectedColumns.push(column);
        }
        this.updateSQL();
    },

    // Render GROUP BY selection
    renderGroupBySelection() {
        const container = document.getElementById('aggGroupByContainer');
        let html = '<div class="checkbox-group" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">';
        
        this.availableColumns.forEach(col => {
            const checked = this.groupByColumns.includes(col) ? 'checked' : '';
            html += `
                <label style="margin: 5px 0;">
                    <input type="checkbox" ${checked} onchange="AggregationsBuilder.toggleGroupBy('${col}')">
                    ${col}
                </label>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },

    // Toggle GROUP BY column
    toggleGroupBy(column) {
        const index = this.groupByColumns.indexOf(column);
        if (index >= 0) {
            this.groupByColumns.splice(index, 1);
        } else {
            this.groupByColumns.push(column);
        }
        this.updateSQL();
    },

    // Add aggregate function
    addAggregateFunction() {
        const id = Date.now();
        this.aggregateFunctions.push({
            id: id,
            function: 'COUNT',
            column: this.availableColumns[0] || '',
            alias: ''
        });
        this.renderAggregateFunctions();
        this.updateSQL();
    },

    // Remove aggregate function
    removeAggregateFunction(id) {
        this.aggregateFunctions = this.aggregateFunctions.filter(f => f.id !== id);
        this.renderAggregateFunctions();
        this.updateSQL();
    },

    // Update aggregate function
    updateAggregateFunction(id, property, value) {
        const func = this.aggregateFunctions.find(f => f.id === id);
        if (func) {
            func[property] = value;
            this.updateSQL();
        }
    },

    // Render aggregate functions
    renderAggregateFunctions() {
        const container = document.getElementById('aggFunctionsContainer');
        
        if (this.aggregateFunctions.length === 0) {
            container.innerHTML = '<div class="info">No aggregate functions added. Click "Add Function" to add one.</div>';
            return;
        }
        
        let html = '';
        this.aggregateFunctions.forEach(func => {
            html += `
                <div class="criteria-row" style="margin-bottom: 15px;">
                    <div class="form-group">
                        <label>Function</label>
                        <select onchange="AggregationsBuilder.updateAggregateFunction(${func.id}, 'function', this.value)">
                            <option value="COUNT" ${func.function === 'COUNT' ? 'selected' : ''}>COUNT</option>
                            <option value="SUM" ${func.function === 'SUM' ? 'selected' : ''}>SUM</option>
                            <option value="AVG" ${func.function === 'AVG' ? 'selected' : ''}>AVG</option>
                            <option value="MIN" ${func.function === 'MIN' ? 'selected' : ''}>MIN</option>
                            <option value="MAX" ${func.function === 'MAX' ? 'selected' : ''}>MAX</option>
                            <option value="COUNT_DISTINCT" ${func.function === 'COUNT_DISTINCT' ? 'selected' : ''}>COUNT DISTINCT</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Column</label>
                        <select onchange="AggregationsBuilder.updateAggregateFunction(${func.id}, 'column', this.value)">
                            <option value="*" ${func.column === '*' ? 'selected' : ''}>* (all)</option>
                            ${this.availableColumns.map(col => `
                                <option value="${col}" ${func.column === col ? 'selected' : ''}>${col}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Alias (optional)</label>
                        <input type="text" value="${func.alias}" 
                               onchange="AggregationsBuilder.updateAggregateFunction(${func.id}, 'alias', this.value)"
                               placeholder="e.g., total_count">
                    </div>
                    <button class="remove-btn" onclick="AggregationsBuilder.removeAggregateFunction(${func.id})">✕</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    // Add HAVING condition
    addHavingCondition() {
        const id = Date.now();
        this.havingConditions.push({
            id: id,
            function: 'COUNT',
            column: this.availableColumns[0] || '',
            operator: '>',
            value: ''
        });
        this.renderHavingConditions();
        this.updateSQL();
    },

    // Remove HAVING condition
    removeHavingCondition(id) {
        this.havingConditions = this.havingConditions.filter(c => c.id !== id);
        this.renderHavingConditions();
        this.updateSQL();
    },

    // Update HAVING condition
    updateHavingCondition(id, property, value) {
        const condition = this.havingConditions.find(c => c.id === id);
        if (condition) {
            condition[property] = value;
            this.updateSQL();
        }
    },

    // Render HAVING conditions
    renderHavingConditions() {
        const container = document.getElementById('aggHavingContainer');
        
        if (this.havingConditions.length === 0) {
            container.innerHTML = '<div class="info">No HAVING conditions. Click "Add Condition" to add one.</div>';
            return;
        }
        
        let html = '';
        this.havingConditions.forEach(cond => {
            html += `
                <div class="criteria-row" style="margin-bottom: 15px;">
                    <div class="form-group">
                        <label>Function</label>
                        <select onchange="AggregationsBuilder.updateHavingCondition(${cond.id}, 'function', this.value)">
                            <option value="COUNT" ${cond.function === 'COUNT' ? 'selected' : ''}>COUNT</option>
                            <option value="SUM" ${cond.function === 'SUM' ? 'selected' : ''}>SUM</option>
                            <option value="AVG" ${cond.function === 'AVG' ? 'selected' : ''}>AVG</option>
                            <option value="MIN" ${cond.function === 'MIN' ? 'selected' : ''}>MIN</option>
                            <option value="MAX" ${cond.function === 'MAX' ? 'selected' : ''}>MAX</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Column</label>
                        <select onchange="AggregationsBuilder.updateHavingCondition(${cond.id}, 'column', this.value)">
                            <option value="*" ${cond.column === '*' ? 'selected' : ''}>* (all)</option>
                            ${this.availableColumns.map(col => `
                                <option value="${col}" ${cond.column === col ? 'selected' : ''}>${col}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Operator</label>
                        <select onchange="AggregationsBuilder.updateHavingCondition(${cond.id}, 'operator', this.value)">
                            <option value=">" ${cond.operator === '>' ? 'selected' : ''}>&gt;</option>
                            <option value=">=" ${cond.operator === '>=' ? 'selected' : ''}>&gt;=</option>
                            <option value="<" ${cond.operator === '<' ? 'selected' : ''}>&lt;</option>
                            <option value="<=" ${cond.operator === '<=' ? 'selected' : ''}>&lt;=</option>
                            <option value="=" ${cond.operator === '=' ? 'selected' : ''}>=</option>
                            <option value="!=" ${cond.operator === '!=' ? 'selected' : ''}>!=</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Value</label>
                        <input type="text" value="${cond.value}" 
                               onchange="AggregationsBuilder.updateHavingCondition(${cond.id}, 'value', this.value)"
                               placeholder="e.g., 10">
                    </div>
                    <button class="remove-btn" onclick="AggregationsBuilder.removeHavingCondition(${cond.id})">✕</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    // Generate SQL
    generateSQL() {
        if (!this.currentTable) return '';
        
        let sql = 'SELECT ';
        
        const selectParts = [];
        
        // Add selected columns
        this.selectedColumns.forEach(col => {
            selectParts.push(`[${col}]`);
        });
        
        // Add aggregate functions
        this.aggregateFunctions.forEach(func => {
            let funcSQL = '';
            if (func.function === 'COUNT_DISTINCT') {
                funcSQL = `COUNT(DISTINCT [${func.column}])`;
            } else if (func.column === '*') {
                funcSQL = `${func.function}(*)`;
            } else {
                funcSQL = `${func.function}([${func.column}])`;
            }
            
            if (func.alias) {
                funcSQL += ` AS [${func.alias}]`;
            }
            
            selectParts.push(funcSQL);
        });
        
        if (selectParts.length === 0) {
            selectParts.push('*');
        }
        
        sql += selectParts.join(', ');
        sql += `\nFROM [${this.currentSchema}].[${this.currentTable}]`;
        
        // Add GROUP BY
        if (this.groupByColumns.length > 0) {
            sql += '\nGROUP BY ' + this.groupByColumns.map(col => `[${col}]`).join(', ');
        }
        
        // Add HAVING
        if (this.havingConditions.length > 0 && this.groupByColumns.length > 0) {
            const havingParts = this.havingConditions.map(cond => {
                let funcSQL = '';
                if (cond.column === '*') {
                    funcSQL = `${cond.function}(*)`;
                } else {
                    funcSQL = `${cond.function}([${cond.column}])`;
                }
                return `${funcSQL} ${cond.operator} ${cond.value}`;
            });
            sql += '\nHAVING ' + havingParts.join(' AND ');
        }
        
        return sql;
    },

    // Update SQL preview
    updateSQL() {
        const sql = this.generateSQL();
        document.getElementById('aggSQLPreview').value = sql;
        document.getElementById('executeAggBtn').disabled = !sql;
    },

    // Execute aggregation query
    async executeAggregation() {
        const sql = this.generateSQL();
        
        if (!sql || !this.currentDatabase) {
            showMessage('Please complete the aggregation configuration', 'error');
            return;
        }
        
        showMessage('Executing aggregation query...', 'info');
        
        try {
            const response = await fetch('/api/custom-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ database: this.currentDatabase, query: sql })
            });
            const data = await response.json();
            if (response.ok) {
                QueryHistory.saveQuery(sql, this.currentDatabase, 'aggregation');
                displayResults(data.records, false, data.duration, true);
            } else {
                showMessage(data.error || 'Query failed', 'error');
            }
        } catch (error) {
            showMessage('Connection error: ' + error.message, 'error');
        }
    },

    // Clear aggregation builder
    clear() {
        this.selectedColumns = [];
        this.aggregateFunctions = [];
        this.groupByColumns = [];
        this.havingConditions = [];
        this.currentTable = '';
        
        document.getElementById('aggTable').value = '';
        document.getElementById('aggControls').classList.add('hidden');
        
        showMessage('Aggregation builder cleared', 'info');
    }
};
