// Table Joins Builder
const JoinsBuilder = {
    primaryTable: null,
    joins: [],
    selectedColumns: [],
    availableTables: [],
    tableColumns: {},

    // Initialize joins builder
    async init() {
        this.joins = [];
        this.selectedColumns = [];
        this.primaryTable = null;
        this.updateJoinsUI();
    },

    // Load tables for joins
    async loadTablesForJoins() {
        const database = document.getElementById('joinDatabase').value;
        
        if (!database) {
            return;
        }

        try {
            const response = await fetch(`/api/tables/${database}`);
            const tables = await response.json();
            this.availableTables = tables;
            
            // Populate primary table dropdown
            const primarySelect = document.getElementById('joinPrimaryTable');
            primarySelect.innerHTML = '<option value="">-- Select Primary Table --</option>';
            
            tables.forEach(table => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ schema: table.schema, name: table.name });
                option.textContent = table.fullName;
                primarySelect.appendChild(option);
            });
            
            showMessage('Tables loaded', 'success');
        } catch (error) {
            showMessage('Failed to load tables: ' + error.message, 'error');
        }
    },

    // Set primary table
    async setPrimaryTable() {
        const primarySelect = document.getElementById('joinPrimaryTable');
        const tableValue = primarySelect.value;
        
        if (!tableValue) {
            this.primaryTable = null;
            this.updateJoinsUI();
            return;
        }
        
        const tableInfo = JSON.parse(tableValue);
        this.primaryTable = {
            schema: tableInfo.schema,
            name: tableInfo.name,
            fullName: `${tableInfo.schema}.${tableInfo.name}`,
            alias: 't1'
        };
        
        // Load columns for primary table
        await this.loadColumnsForTable(this.primaryTable);
        
        // Show join controls
        document.getElementById('joinControls').classList.remove('hidden');
        
        this.updateJoinsUI();
    },

    // Load columns for a specific table
    async loadColumnsForTable(table) {
        const database = document.getElementById('joinDatabase').value;
        
        try {
            const response = await fetch(`/api/columns/${database}/${table.schema}/${table.name}`);
            const data = await response.json();
            this.tableColumns[table.fullName] = data.columns.map(col => col.COLUMN_NAME);
        } catch (error) {
            console.error('Failed to load columns:', error);
        }
    },

    // Add new join
    addJoin() {
        const joinCount = this.joins.length + 2;
        const newJoin = {
            id: Date.now(),
            table: null,
            joinType: 'INNER',
            leftTable: this.joins.length === 0 ? this.primaryTable.alias : this.joins[this.joins.length - 1].table.alias,
            leftColumn: '',
            rightColumn: '',
            alias: `t${joinCount}`
        };
        
        this.joins.push(newJoin);
        this.updateJoinsUI();
    },

    // Remove join
    removeJoin(joinId) {
        this.joins = this.joins.filter(j => j.id !== joinId);
        this.updateJoinsUI();
    },

    // Update join property
    async updateJoin(joinId, property, value) {
        const join = this.joins.find(j => j.id === joinId);
        if (!join) return;
        
        if (property === 'table') {
            const tableInfo = JSON.parse(value);
            join.table = {
                schema: tableInfo.schema,
                name: tableInfo.name,
                fullName: `${tableInfo.schema}.${tableInfo.name}`,
                alias: join.alias
            };
            
            // Load columns for this table
            await this.loadColumnsForTable(join.table);
        } else {
            join[property] = value;
        }
        
        this.updateJoinsUI();
    },

    // Generate SQL query
    generateSQL() {
        if (!this.primaryTable) {
            return '';
        }
        
        let sql = `SELECT `;
        
        // If no specific columns selected, select all with aliases
        if (this.selectedColumns.length === 0) {
            const allTables = [this.primaryTable, ...this.joins.filter(j => j.table).map(j => j.table)];
            sql += allTables.map(t => `${t.alias}.*`).join(', ');
        } else {
            sql += this.selectedColumns.join(', ');
        }
        
        sql += `\nFROM [${this.primaryTable.schema}].[${this.primaryTable.name}] AS ${this.primaryTable.alias}`;
        
        // Add joins
        this.joins.forEach(join => {
            if (join.table && join.leftColumn && join.rightColumn) {
                sql += `\n${join.joinType} JOIN [${join.table.schema}].[${join.table.name}] AS ${join.table.alias}`;
                sql += `\n  ON ${join.leftTable}.${join.leftColumn} = ${join.table.alias}.${join.rightColumn}`;
            }
        });
        
        return sql;
    },

    // Update UI
    updateJoinsUI() {
        const container = document.getElementById('joinsContainer');
        const sqlPreview = document.getElementById('joinSQLPreview');
        const executeBtn = document.getElementById('executeJoinBtn');
        
        if (!this.primaryTable) {
            container.innerHTML = '<div class="info">Select a primary table to start building joins</div>';
            sqlPreview.value = '';
            executeBtn.disabled = true;
            return;
        }
        
        // Render joins
        let html = `
            <div class="join-primary-table">
                <strong>Primary Table:</strong> ${this.primaryTable.fullName} (${this.primaryTable.alias})
            </div>
        `;
        
        this.joins.forEach((join, index) => {
            html += this.renderJoinRow(join, index);
        });
        
        html += `
            <button class="add-criteria-btn" onclick="JoinsBuilder.addJoin()" style="margin-top: 15px;">
                + Add Join
            </button>
        `;
        
        container.innerHTML = html;
        
        // Update SQL preview
        const sql = this.generateSQL();
        sqlPreview.value = sql;
        executeBtn.disabled = !sql || this.joins.some(j => !j.table || !j.leftColumn || !j.rightColumn);
    },

    // Render single join row
    renderJoinRow(join, index) {
        const tablesOptions = this.availableTables.map(t => {
            const value = JSON.stringify({ schema: t.schema, name: t.name });
            const selected = join.table && join.table.fullName === t.fullName ? 'selected' : '';
            return `<option value='${value}' ${selected}>${t.fullName}</option>`;
        }).join('');
        
        // Get available tables for left side
        const leftTables = [this.primaryTable, ...this.joins.slice(0, index).filter(j => j.table).map(j => j.table)];
        
        // Get columns for dropdowns
        const leftTableKey = join.leftTable === this.primaryTable.alias ? this.primaryTable.fullName : 
            this.joins.find(j => j.table && j.table.alias === join.leftTable)?.table?.fullName;
        
        const leftColumns = leftTableKey && this.tableColumns[leftTableKey] ? this.tableColumns[leftTableKey] : [];
        const rightColumns = join.table && this.tableColumns[join.table.fullName] ? this.tableColumns[join.table.fullName] : [];
        
        return `
            <div class="join-row" id="join-${join.id}">
                <div class="join-row-header">
                    <span class="join-icon">⬇️</span>
                    <span class="join-type-badge">${join.joinType} JOIN</span>
                </div>
                
                <div class="join-row-content">
                    <div class="form-group">
                        <label>Join Type</label>
                        <select onchange="JoinsBuilder.updateJoin(${join.id}, 'joinType', this.value)">
                            <option value="INNER" ${join.joinType === 'INNER' ? 'selected' : ''}>INNER JOIN</option>
                            <option value="LEFT" ${join.joinType === 'LEFT' ? 'selected' : ''}>LEFT JOIN</option>
                            <option value="RIGHT" ${join.joinType === 'RIGHT' ? 'selected' : ''}>RIGHT JOIN</option>
                            <option value="FULL OUTER" ${join.joinType === 'FULL OUTER' ? 'selected' : ''}>FULL OUTER JOIN</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Table to Join</label>
                        <select onchange="JoinsBuilder.updateJoin(${join.id}, 'table', this.value)">
                            <option value="">-- Select Table --</option>
                            ${tablesOptions}
                        </select>
                    </div>
                    
                    <div class="join-condition">
                        <div class="form-group">
                            <label>Left Table</label>
                            <select onchange="JoinsBuilder.updateJoin(${join.id}, 'leftTable', this.value)">
                                ${leftTables.map(t => `<option value="${t.alias}" ${join.leftTable === t.alias ? 'selected' : ''}>${t.fullName} (${t.alias})</option>`).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Left Column</label>
                            <select onchange="JoinsBuilder.updateJoin(${join.id}, 'leftColumn', this.value)">
                                <option value="">-- Select Column --</option>
                                ${leftColumns.map(col => `<option value="${col}" ${join.leftColumn === col ? 'selected' : ''}>${col}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div class="join-equals">=</div>
                        
                        <div class="form-group">
                            <label>Right Column</label>
                            <select onchange="JoinsBuilder.updateJoin(${join.id}, 'rightColumn', this.value)" ${!join.table ? 'disabled' : ''}>
                                <option value="">-- Select Column --</option>
                                ${rightColumns.map(col => `<option value="${col}" ${join.rightColumn === col ? 'selected' : ''}>${col}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <button class="remove-btn" onclick="JoinsBuilder.removeJoin(${join.id})" style="margin-top: 10px;">
                        Remove Join
                    </button>
                </div>
            </div>
        `;
    },

    // Execute join query
    async executeJoin() {
        const database = document.getElementById('joinDatabase').value;
        const sql = this.generateSQL();
        
        if (!database || !sql) {
            showMessage('Please complete the join configuration', 'error');
            return;
        }
        
        showMessage('Executing join query...', 'info');
        
        try {
            const response = await fetch('/api/custom-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ database, query: sql })
            });
            const data = await response.json();
            if (response.ok) {
                // Save to history
                QueryHistory.saveQuery(sql, database, 'join');
                
                displayResults(data.records, false, data.duration, true);
            } else {
                showMessage(data.error || 'Query failed', 'error');
            }
        } catch (error) {
            showMessage('Connection error: ' + error.message, 'error');
        }
    },

    // Clear join builder
    clear() {
        this.joins = [];
        this.primaryTable = null;
        this.selectedColumns = [];
        document.getElementById('joinPrimaryTable').value = '';
        document.getElementById('joinControls').classList.add('hidden');
        this.updateJoinsUI();
        showMessage('Join builder cleared', 'info');
    }
};