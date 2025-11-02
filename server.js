const express = require('express');
const sql = require('mssql');
const session = require('express-session');
const path = require('path');

const app = express();
app.use(express.json());

// Detect if running as packaged executable
const isPkg = typeof process.pkg !== 'undefined';
const publicPath = isPkg 
    ? path.join(path.dirname(process.execPath), 'public')
    : path.join(__dirname, 'public');

console.log('[INFO] Running mode:', isPkg ? 'Executable' : 'Development');
console.log('[INFO] Public path:', publicPath);

app.use(express.static(publicPath));

// Session configuration
app.use(session({
    secret: 'sql-manager-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 3600000
    }
}));

// Store connection pools per session
const connectionPools = new Map();

// Middleware to check if connected
const requireConnection = (req, res, next) => {
    if (req.session.connectionId && connectionPools.has(req.session.connectionId)) {
        next();
    } else {
        res.status(401).json({ error: 'Not connected to database' });
    }
};

// Connect to SQL Server
app.post('/api/connect', async (req, res) => {
    const { server, username, password, database, encrypt, trustCertificate, useWindowsAuth, windowsDomain, windowsUsername, windowsPassword } = req.body;
    
    console.log('[INFO] Connection attempt:', { server, database, useWindowsAuth });
    
    if (!server) {
        return res.status(400).json({ error: 'Server is required' });
    }
    
    if (!useWindowsAuth && (!username || !password)) {
        return res.status(400).json({ error: 'Username and password are required for SQL Server authentication' });
    }
    
    if (useWindowsAuth && windowsUsername && !windowsPassword) {
        return res.status(400).json({ error: 'Windows password is required when specifying a Windows user' });
    }
    
    const config = {
        server: server,
        database: database || 'master',
        options: {
            encrypt: encrypt === true || encrypt === 'true',
            trustServerCertificate: trustCertificate === true || trustCertificate === 'true',
            enableArithAbort: true,
            connectTimeout: 15000
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
    
    let displayUsername = '';
    
    // Add authentication based on type
    if (useWindowsAuth) {
        if (windowsUsername && windowsPassword) {
            // Custom Windows user
            config.authentication = {
                type: 'ntlm',
                options: {
                    domain: windowsDomain || '',
                    userName: windowsUsername,
                    password: windowsPassword
                }
            };
            displayUsername = windowsDomain ? `${windowsDomain}\\${windowsUsername}` : windowsUsername;
            console.log('[INFO] Using Windows Auth with custom user:', displayUsername);
        } else {
            // Current Windows user
            config.options.trustedConnection = true;
            config.authentication = {
                type: 'ntlm',
                options: {
                    domain: '',
                    userName: '',
                    password: ''
                }
            };
            displayUsername = 'Windows Auth (Current User)';
            console.log('[INFO] Using Windows Auth with current user');
        }
    } else {
        // SQL Server authentication
        config.user = username;
        config.password = password;
        displayUsername = username;
        console.log('[INFO] Using SQL Server Auth with user:', username);
    }
    
    try {
        console.log('[INFO] Attempting to establish connection...');
        const pool = await sql.connect(config);
        console.log('[SUCCESS] Connection established successfully');
        
        const connectionId = Date.now().toString();
        connectionPools.set(connectionId, { pool, config });
        req.session.connectionId = connectionId;
        req.session.server = server;
        req.session.username = displayUsername;
        
        console.log(`[INFO] Connection stored with ID: ${connectionId}`);
        
        res.json({ 
            success: true, 
            server: server,
            username: displayUsername,
            database: database || 'master'
        });
    } catch (err) {
        console.error('[ERROR] Connection failed:', err.message);
        res.status(500).json({ error: err.message || 'Connection failed' });
    }
});

// Disconnect from SQL Server
app.post('/api/disconnect', async (req, res) => {
    console.log('[INFO] Disconnect request received');
    
    if (req.session.connectionId && connectionPools.has(req.session.connectionId)) {
        try {
            const { pool } = connectionPools.get(req.session.connectionId);
            await pool.close();
            connectionPools.delete(req.session.connectionId);
            console.log(`[INFO] Connection ${req.session.connectionId} closed`);
        } catch (err) {
            console.error('[ERROR] Disconnect error:', err);
        }
    }
    
    req.session.destroy((err) => {
        if (err) {
            console.error('[ERROR] Session destroy error:', err);
            return res.status(500).json({ error: 'Disconnect failed' });
        }
        console.log('[SUCCESS] Session destroyed');
        res.json({ success: true });
    });
});

// Check connection status
app.get('/api/connection-status', (req, res) => {
    if (req.session.connectionId && connectionPools.has(req.session.connectionId)) {
        res.json({ 
            connected: true, 
            server: req.session.server,
            username: req.session.username
        });
    } else {
        res.json({ connected: false });
    }
});

// Get all databases
app.get('/api/databases', requireConnection, async (req, res) => {
    console.log('[INFO] Fetching databases list');
    
    try {
        const { pool } = connectionPools.get(req.session.connectionId);
        
        const result = await pool.request()
            .query(`
                SELECT name 
                FROM sys.databases 
                WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
                AND state_desc = 'ONLINE'
                ORDER BY name
            `);
        
        console.log(`[INFO] Found ${result.recordset.length} databases`);
        res.json(result.recordset.map(db => db.name));
    } catch (err) {
        console.error('[ERROR] Get databases error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all tables in a database
app.get('/api/tables/:database', requireConnection, async (req, res) => {
    const { database } = req.params;
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        const result = await dbPool.request()
            .query(`
                SELECT TABLE_SCHEMA, TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            `);
        
        await dbPool.close();
        
        res.json(result.recordset.map(t => ({
            schema: t.TABLE_SCHEMA,
            name: t.TABLE_NAME,
            fullName: `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`
        })));
    } catch (err) {
        console.error('[ERROR] Get tables error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get table columns with data types AND PRIMARY KEYS
app.get('/api/columns/:database/:schema/:table', requireConnection, async (req, res) => {
    const { database, schema, table } = req.params;
    
    console.log(`[INFO] Getting columns for ${database}.${schema}.${table}`);
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        // Get columns
        const columnsResult = await dbPool.request()
            .input('schema', sql.VarChar, schema)
            .input('table', sql.VarChar, table)
            .query(`
                SELECT 
                    COLUMN_NAME, 
                    DATA_TYPE, 
                    CHARACTER_MAXIMUM_LENGTH,
                    IS_NULLABLE,
                    NUMERIC_PRECISION,
                    NUMERIC_SCALE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
                ORDER BY ORDINAL_POSITION
            `);
        
        // Get primary keys
        const pkResult = await dbPool.request()
            .input('schema', sql.VarChar, schema)
            .input('table', sql.VarChar, table)
            .query(`
                SELECT c.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE c
                    ON tc.CONSTRAINT_NAME = c.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = c.TABLE_SCHEMA
                WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                    AND tc.TABLE_SCHEMA = @schema
                    AND tc.TABLE_NAME = @table
            `);
        
        await dbPool.close();
        
        const primaryKeys = pkResult.recordset.map(pk => pk.COLUMN_NAME);
        
        console.log(`[INFO] Found ${columnsResult.recordset.length} columns, ${primaryKeys.length} primary keys`);
        
        res.json({
            columns: columnsResult.recordset,
            primaryKeys: primaryKeys
        });
    } catch (err) {
        console.error('[ERROR] Get columns error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get foreign keys for a table
app.get('/api/foreign-keys/:database/:schema/:table', requireConnection, async (req, res) => {
    const { database, schema, table } = req.params;
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        const result = await dbPool.request()
            .input('schema', sql.VarChar, schema)
            .input('table', sql.VarChar, table)
            .query(`
                SELECT 
                    fk.name AS name,
                    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column,
                    OBJECT_SCHEMA_NAME(fk.referenced_object_id) + '.' + OBJECT_NAME(fk.referenced_object_id) AS referencedTable,
                    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referencedColumn
                FROM sys.foreign_keys fk
                INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = @schema
                  AND OBJECT_NAME(fk.parent_object_id) = @table
                ORDER BY fk.name
            `);
        
        await dbPool.close();
        res.json({ foreignKeys: result.recordset });
    } catch (err) {
        console.error('[ERROR] Get foreign keys error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get indexes for a table
app.get('/api/indexes/:database/:schema/:table', requireConnection, async (req, res) => {
    const { database, schema, table } = req.params;
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        const result = await dbPool.request()
            .input('schema', sql.VarChar, schema)
            .input('table', sql.VarChar, table)
            .query(`
                SELECT 
                    i.name,
                    i.type_desc AS type,
                    i.is_unique,
                    STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
                FROM sys.indexes i
                INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                WHERE OBJECT_SCHEMA_NAME(i.object_id) = @schema
                  AND OBJECT_NAME(i.object_id) = @table
                  AND i.name IS NOT NULL
                GROUP BY i.name, i.type_desc, i.is_unique
                ORDER BY i.name
            `);
        
        await dbPool.close();
        res.json({ indexes: result.recordset });
    } catch (err) {
        console.error('[ERROR] Get indexes error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Search records with flexible criteria and proper type handling
app.post('/api/search', requireConnection, async (req, res) => {
    const { database, schema, table, criteria, limit, orderBy, orderDirection, distinct, searchMode } = req.body;
    
    console.log(`[INFO] Search request - DB: ${database}, Table: ${schema}.${table}`);
    console.log(`[INFO] Limit: ${limit || 'default 1000'}, OrderBy: ${orderBy || 'none'}, SearchMode: ${searchMode || 'contains'}`);
    
    if (!database || !schema || !table) {
        console.log('[ERROR] Missing required parameters');
        return res.status(400).json({ error: 'Database, schema, and table required' });
    }
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        // Increase timeout for large tables
        const dbConfig = { 
            ...config, 
            database,
            requestTimeout: 60000, // 60 seconds
            connectionTimeout: 15000
        };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        console.log('[INFO] Fetching column metadata...');
        const columnInfo = await dbPool.request()
            .input('schema', sql.VarChar, schema)
            .input('table', sql.VarChar, table)
            .query(`
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    CHARACTER_MAXIMUM_LENGTH,
                    NUMERIC_PRECISION
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
            `);
        
        const columnTypes = {};
        columnInfo.recordset.forEach(col => {
            columnTypes[col.COLUMN_NAME] = col.DATA_TYPE;
        });
        
        const request = dbPool.request();
        
        // Force reasonable limits for large tables
        const effectiveLimit = limit || 1000;
        const maxLimit = Math.min(effectiveLimit, 50000); // Cap at 50K rows for safety
        
        const selectClause = distinct ? 'SELECT DISTINCT' : 'SELECT';
        const topClause = `TOP ${maxLimit}`;
        
        // Use NOLOCK hint for better read performance
        let query = `${selectClause} ${topClause} * FROM [${schema}].[${table}] WITH (NOLOCK)`;
        
        let conditions = []; // Declare outside to avoid undefined error
        
        if (criteria && Object.keys(criteria).length > 0) {
            let paramIndex = 0;
            
            for (const [field, value] of Object.entries(criteria)) {
                if (value !== null && value !== undefined && value !== '') {
                    const paramName = `param${paramIndex}`;
                    const dataType = columnTypes[field];
                    
                    // Numeric types - use exact match
                    if (dataType && (dataType.includes('int') || dataType.includes('numeric') || 
                        dataType.includes('decimal') || dataType.includes('float') || 
                        dataType.includes('money'))) {
                        if (!isNaN(value)) {
                            conditions.push(`[${field}] = @${paramName}`);
                            if (dataType.includes('int')) {
                                request.input(paramName, sql.Int, parseInt(value));
                            } else {
                                request.input(paramName, sql.Float, parseFloat(value));
                            }
                        }
                    } 
                    // Date types
                    else if (dataType && (dataType.includes('date') || dataType.includes('time'))) {
                        const dateValue = new Date(value);
                        if (!isNaN(dateValue.getTime())) {
                            conditions.push(`CAST([${field}] AS DATE) = CAST(@${paramName} AS DATE)`);
                            request.input(paramName, sql.DateTime, dateValue);
                        }
                    } 
                    // Boolean types
                    else if (dataType && dataType.includes('bit')) {
                        const boolValue = value === 'true' || value === '1' || value === 1;
                        conditions.push(`[${field}] = @${paramName}`);
                        request.input(paramName, sql.Bit, boolValue);
                    } 
                    // String types - use search mode
                    else {
                        const mode = searchMode || 'contains';
                        
                        if (mode === 'exact') {
                            // Exact match - FASTEST (can use indexes)
                            conditions.push(`[${field}] = @${paramName}`);
                            request.input(paramName, sql.NVarChar, value);
                        } else if (mode === 'startsWith') {
                            // Starts with - FAST (can use indexes with proper setup)
                            conditions.push(`[${field}] LIKE @${paramName}`);
                            request.input(paramName, sql.NVarChar, `${value}%`);
                        } else {
                            // Contains - SLOWER (full scan)
                            conditions.push(`[${field}] LIKE @${paramName}`);
                            request.input(paramName, sql.NVarChar, `%${value}%`);
                        }
                    }
                    
                    paramIndex++;
                }
            }
            
            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }
        }
        
        // Add ORDER BY clause
        if (orderBy) {
            const direction = orderDirection === 'DESC' ? 'DESC' : 'ASC';
            query += ` ORDER BY [${orderBy}] ${direction}`;
        }
        
        // Add query hints for better performance on large tables
        // Only use RECOMPILE when we have WHERE conditions (helps with parameter sniffing)
        if (conditions && conditions.length > 0) {
            query += ' OPTION (MAXDOP 4, RECOMPILE)';
        } else {
            // No WHERE clause - just use MAXDOP
            query += ' OPTION (MAXDOP 4)';
        }
        
        console.log('[INFO] Executing optimized query...');
        console.log('[SQL]', query);
        const hasCriteria = criteria && Object.keys(criteria).some(k => criteria[k] !== null && criteria[k] !== undefined && criteria[k] !== '');
        
        const startTime = Date.now();
        const result = await request.query(query);
        const duration = Date.now() - startTime;
        
        console.log(`[SUCCESS] Query executed in ${duration}ms, returned ${result.recordset.length} rows`);
        
        await dbPool.close();
        
        res.json({ 
            count: result.recordset.length,
            records: result.recordset,
            duration: duration,
            limited: result.recordset.length >= maxLimit,
            appliedLimit: maxLimit,
            searchMode: searchMode || 'contains',
            noCriteria: !hasCriteria
        });
    } catch (err) {
        console.error('[ERROR] Search error:', err.message);
        
        // Provide helpful error messages for timeouts
        if (err.message.includes('timeout') || err.message.includes('Timeout')) {
            res.status(500).json({ 
                error: 'Query timeout on large table',
                suggestion: 'Try using "Exact Match" or "Starts With" search mode, add more specific criteria, or reduce the result limit',
                details: err.message
            });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// Execute custom SQL query
app.post('/api/custom-query', requireConnection, async (req, res) => {
    const { database, query } = req.body;
    
    console.log(`[INFO] Custom query request - DB: ${database}`);
    
    if (!database || !query) {
        return res.status(400).json({ error: 'Database and query required' });
    }
    
    // Security: Only allow SELECT statements
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
        return res.status(400).json({ error: 'Only SELECT queries are allowed for safety' });
    }
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        console.log('[INFO] Executing custom query...');
        const startTime = Date.now();
        const result = await dbPool.request().query(query);
        const duration = Date.now() - startTime;
        
        console.log(`[INFO] Query executed in ${duration}ms, returned ${result.recordset.length} rows`);
        
        await dbPool.close();
        
        res.json({ 
            count: result.recordset.length,
            records: result.recordset,
            duration: duration
        });
    } catch (err) {
        console.error('[ERROR] Custom query error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Insert new record
app.post('/api/record/:database/:schema/:table', requireConnection, async (req, res) => {
    const { database, schema, table } = req.params;
    const { values } = req.body;
    
    console.log(`[INFO] Insert request - DB: ${database}, Table: ${schema}.${table}`);
    console.log('[INFO] Values:', values);
    
    if (!values || Object.keys(values).length === 0) {
        return res.status(400).json({ error: 'Values required for insert' });
    }
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        const request = dbPool.request();
        const columns = [];
        const paramNames = [];
        let paramIndex = 0;
        
        // Build INSERT statement
        for (const [field, value] of Object.entries(values)) {
            columns.push(`[${field}]`);
            const paramName = `param${paramIndex}`;
            paramNames.push(`@${paramName}`);
            
            if (value === null || value === undefined || value === '') {
                request.input(paramName, sql.NVarChar, null);
            } else if (typeof value === 'number') {
                if (Number.isInteger(value)) {
                    request.input(paramName, sql.Int, value);
                } else {
                    request.input(paramName, sql.Float, value);
                }
            } else if (typeof value === 'boolean') {
                request.input(paramName, sql.Bit, value);
            } else if (value instanceof Date || !isNaN(Date.parse(value))) {
                request.input(paramName, sql.DateTime, new Date(value));
            } else {
                request.input(paramName, sql.NVarChar, String(value));
            }
            
            paramIndex++;
        }
        
        const query = `INSERT INTO [${schema}].[${table}] (${columns.join(', ')}) VALUES (${paramNames.join(', ')})`;
        console.log('[INFO] Executing insert query...');
        
        const result = await request.query(query);
        await dbPool.close();
        
        console.log(`[SUCCESS] Inserted ${result.rowsAffected[0]} row(s)`);
        res.json({ success: true, rowsAffected: result.rowsAffected[0] });
    } catch (err) {
        console.error('[ERROR] Insert record error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Update record - works with OR without primary keys
app.put('/api/record/:database/:schema/:table', requireConnection, async (req, res) => {
    const { database, schema, table } = req.params;
    const { uniqueKeys, updates } = req.body;
    
    console.log(`[INFO] Update request - DB: ${database}, Table: ${schema}.${table}`);
    console.log('[INFO] Unique keys:', uniqueKeys);
    
    if (!uniqueKeys || Object.keys(uniqueKeys).length === 0 || !updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Unique keys and updates required' });
    }
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        const request = dbPool.request();
        const setClauses = [];
        const whereClauses = [];
        let paramIndex = 0;
        
        // Build SET clause
        for (const [field, value] of Object.entries(updates)) {
            const paramName = `set${paramIndex}`;
            setClauses.push(`[${field}] = @${paramName}`);
            
            if (value === null || value === undefined) {
                request.input(paramName, sql.NVarChar, null);
            } else if (typeof value === 'number') {
                if (Number.isInteger(value)) {
                    request.input(paramName, sql.Int, value);
                } else {
                    request.input(paramName, sql.Float, value);
                }
            } else if (typeof value === 'boolean') {
                request.input(paramName, sql.Bit, value);
            } else if (value instanceof Date || !isNaN(Date.parse(value))) {
                request.input(paramName, sql.DateTime, new Date(value));
            } else {
                request.input(paramName, sql.NVarChar, String(value));
            }
            
            paramIndex++;
        }
        
        // Build WHERE clause - handle NULL values properly
        let whereIndex = 0;
        for (const [field, value] of Object.entries(uniqueKeys)) {
            const paramName = `where${whereIndex}`;
            
            if (value === null || value === undefined) {
                whereClauses.push(`[${field}] IS NULL`);
            } else {
                whereClauses.push(`[${field}] = @${paramName}`);
                
                if (typeof value === 'number') {
                    if (Number.isInteger(value)) {
                        request.input(paramName, sql.Int, value);
                    } else {
                        request.input(paramName, sql.Float, value);
                    }
                } else {
                    request.input(paramName, sql.NVarChar, String(value));
                }
            }
            
            whereIndex++;
        }
        
        const query = `UPDATE [${schema}].[${table}] SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
        console.log('[INFO] Executing update query...');
        
        const result = await request.query(query);
        await dbPool.close();
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Record not found or no changes made' });
        }
        
        console.log(`[SUCCESS] Updated ${result.rowsAffected[0]} row(s)`);
        res.json({ success: true, rowsAffected: result.rowsAffected[0] });
    } catch (err) {
        console.error('[ERROR] Update record error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Delete record - works with OR without primary keys
app.delete('/api/record/:database/:schema/:table', requireConnection, async (req, res) => {
    const { database, schema, table } = req.params;
    const { uniqueKeys } = req.body;
    
    console.log(`[INFO] Delete request - DB: ${database}, Table: ${schema}.${table}`);
    console.log('[INFO] Unique keys:', uniqueKeys);
    
    if (!uniqueKeys || Object.keys(uniqueKeys).length === 0) {
        return res.status(400).json({ error: 'Unique keys required' });
    }
    
    try {
        const { config } = connectionPools.get(req.session.connectionId);
        const dbConfig = { ...config, database };
        const dbPool = await new sql.ConnectionPool(dbConfig).connect();
        
        const request = dbPool.request();
        const whereClauses = [];
        let whereIndex = 0;
        
        // Build WHERE clause - handle NULL values properly
        for (const [field, value] of Object.entries(uniqueKeys)) {
            const paramName = `where${whereIndex}`;
            
            if (value === null || value === undefined) {
                whereClauses.push(`[${field}] IS NULL`);
            } else {
                whereClauses.push(`[${field}] = @${paramName}`);
                
                if (typeof value === 'number') {
                    if (Number.isInteger(value)) {
                        request.input(paramName, sql.Int, value);
                    } else {
                        request.input(paramName, sql.Float, value);
                    }
                } else {
                    request.input(paramName, sql.NVarChar, String(value));
                }
            }
            
            whereIndex++;
        }
        
        const query = `DELETE FROM [${schema}].[${table}] WHERE ${whereClauses.join(' AND ')}`;
        console.log('[INFO] Executing delete query...');
        
        const result = await request.query(query);
        await dbPool.close();
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        console.log(`[SUCCESS] Deleted ${result.rowsAffected[0]} row(s)`);
        res.json({ success: true, rowsAffected: result.rowsAffected[0] });
    } catch (err) {
        console.error('[ERROR] Delete record error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// BACKUP & RESTORE ENDPOINTS
// ============================================

// Perform database backup
app.post('/api/backup', requireConnection, async (req, res) => {
    const { database, backupType, backupPath, description, compression } = req.body;
    
    console.log('[INFO] Backup request:', { database, backupType, backupPath });
    
    if (!database || !backupPath) {
        return res.status(400).json({ error: 'Database and backup path are required' });
    }

    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        const startTime = Date.now();
        
        // Build backup command
        let backupCommand = `BACKUP DATABASE [${database}] TO DISK = @backupPath`;
        
        // Add backup type
        if (backupType === 'DIFFERENTIAL') {
            backupCommand += ' WITH DIFFERENTIAL';
        } else if (backupType === 'LOG') {
            backupCommand = `BACKUP LOG [${database}] TO DISK = @backupPath`;
        } else {
            backupCommand += ' WITH INIT';
        }
        
        // Add compression if requested
        if (compression) {
            backupCommand += ', COMPRESSION';
        }
        
        // Add description if provided
        if (description) {
            backupCommand += ', DESCRIPTION = @description';
        }
        
        // Add other options
        backupCommand += ', STATS = 10, FORMAT';
        
        console.log('[INFO] Executing backup command:', backupCommand);
        
        const request = pool.request();
        request.input('backupPath', sql.VarChar, backupPath);
        if (description) {
            request.input('description', sql.VarChar, description);
        }
        
        // Set longer timeout for backup operations (10 minutes)
        request.timeout = 600000;
        
        await request.query(backupCommand);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Get backup file size
        let fileSize = 0;
        try {
            const sizeQuery = `
                SELECT backup_size 
                FROM msdb.dbo.backupset 
                WHERE database_name = @database 
                AND backup_finish_date IS NOT NULL
                ORDER BY backup_finish_date DESC
            `;
            const sizeResult = await pool.request()
                .input('database', sql.VarChar, database)
                .query(sizeQuery);
            
            if (sizeResult.recordset.length > 0) {
                fileSize = sizeResult.recordset[0].backup_size;
            }
        } catch (sizeErr) {
            console.warn('[WARN] Could not get backup size:', sizeErr.message);
        }
        
        console.log(`[SUCCESS] Backup completed in ${duration}s`);
        res.json({ 
            success: true, 
            backupFile: backupPath,
            duration: duration,
            size: fileSize,
            database: database
        });
    } catch (err) {
        console.error('[ERROR] Backup failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get backup history
app.get('/api/backup/history', requireConnection, async (req, res) => {
    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        const query = `
            SELECT TOP 50
                database_name,
                backup_start_date,
                backup_finish_date,
                backup_size,
                physical_device_name,
                CASE type
                    WHEN 'D' THEN 'FULL'
                    WHEN 'I' THEN 'DIFFERENTIAL'
                    WHEN 'L' THEN 'LOG'
                    ELSE 'OTHER'
                END as type,
                description
            FROM msdb.dbo.backupset bs
            INNER JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
            ORDER BY backup_finish_date DESC
        `;
        
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('[ERROR] Failed to get backup history:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Restore database from backup
app.post('/api/restore', requireConnection, async (req, res) => {
    const { backupFile, targetDatabase, replaceExisting } = req.body;
    
    console.log('[INFO] Restore request:', { backupFile, targetDatabase, replaceExisting });
    
    if (!backupFile) {
        return res.status(400).json({ error: 'Backup file path is required' });
    }

    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        const startTime = Date.now();
        
        // Get database name from backup if not specified
        let dbName = targetDatabase;
        if (!dbName) {
            const headerQuery = `RESTORE HEADERONLY FROM DISK = @backupFile`;
            const headerResult = await pool.request()
                .input('backupFile', sql.VarChar, backupFile)
                .query(headerQuery);
            
            if (headerResult.recordset.length === 0) {
                throw new Error('Could not read backup file header');
            }
            
            dbName = headerResult.recordset[0].DatabaseName;
        }
        
        // Build restore command
        let restoreCommand = `RESTORE DATABASE [${dbName}] FROM DISK = @backupFile WITH STATS = 10`;
        
        if (replaceExisting) {
            restoreCommand += ', REPLACE';
        }
        
        // Get logical file names to relocate if necessary
        const fileListQuery = `RESTORE FILELISTONLY FROM DISK = @backupFile`;
        const fileListResult = await pool.request()
            .input('backupFile', sql.VarChar, backupFile)
            .query(fileListQuery);
        
        // Note: In production, you might want to add MOVE options here
        // to relocate files to appropriate paths
        
        console.log('[INFO] Executing restore command');
        
        const request = pool.request();
        request.input('backupFile', sql.VarChar, backupFile);
        
        // Set longer timeout for restore operations (30 minutes)
        request.timeout = 1800000;
        
        await request.query(restoreCommand);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`[SUCCESS] Restore completed in ${duration}s`);
        res.json({ 
            success: true, 
            database: dbName,
            duration: duration
        });
    } catch (err) {
        console.error('[ERROR] Restore failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Verify backup file
app.post('/api/backup/verify', requireConnection, async (req, res) => {
    const { backupFile } = req.body;
    
    if (!backupFile) {
        return res.status(400).json({ error: 'Backup file path is required' });
    }

    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        console.log('[INFO] Verifying backup:', backupFile);
        
        // Verify backup
        const verifyQuery = `RESTORE VERIFYONLY FROM DISK = @backupFile`;
        await pool.request()
            .input('backupFile', sql.VarChar, backupFile)
            .query(verifyQuery);
        
        // Get backup header info
        const headerQuery = `RESTORE HEADERONLY FROM DISK = @backupFile`;
        const headerResult = await pool.request()
            .input('backupFile', sql.VarChar, backupFile)
            .query(headerQuery);
        
        if (headerResult.recordset.length === 0) {
            throw new Error('Could not read backup file');
        }
        
        const header = headerResult.recordset[0];
        
        console.log('[SUCCESS] Backup verified successfully');
        res.json({
            valid: true,
            databaseName: header.DatabaseName,
            backupDate: header.BackupFinishDate,
            backupType: header.BackupType === 1 ? 'FULL' : header.BackupType === 5 ? 'DIFFERENTIAL' : 'LOG',
            serverName: header.ServerName,
            sqlVersion: header.SoftwareVersionMajor + '.' + header.SoftwareVersionMinor,
            description: header.BackupDescription
        });
    } catch (err) {
        console.error('[ERROR] Verification failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get backup file info
app.post('/api/backup/info', requireConnection, async (req, res) => {
    const { backupFile } = req.body;
    
    if (!backupFile) {
        return res.status(400).json({ error: 'Backup file path is required' });
    }

    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        // Get file list from backup
        const fileListQuery = `RESTORE FILELISTONLY FROM DISK = @backupFile`;
        const fileListResult = await pool.request()
            .input('backupFile', sql.VarChar, backupFile)
            .query(fileListQuery);
        
        res.json({
            fileInfo: fileListResult.recordset
        });
    } catch (err) {
        console.error('[ERROR] Failed to get backup info:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// SERVER FILE SYSTEM BROWSING (For SQL Server Machine)
// ============================================

// Browse directories on SQL Server machine
app.post('/api/browse-server-path', requireConnection, async (req, res) => {
    const { path: browsePath } = req.body;
    
    console.log('[INFO] Browse server path request:', browsePath);
    
    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        // Use xp_dirtree to list directories and files
        // Note: This requires appropriate permissions on SQL Server
        const query = `
            DECLARE @path NVARCHAR(500) = @browsePath;
            
            -- Get directories
            CREATE TABLE #dirs (
                subdirectory NVARCHAR(512),
                depth INT,
                isFile BIT
            );
            
            INSERT INTO #dirs
            EXEC xp_dirtree @path, 1, 1;
            
            SELECT 
                subdirectory as name,
                CASE WHEN isFile = 0 THEN 'folder' ELSE 'file' END as type,
                CASE WHEN isFile = 1 AND subdirectory LIKE '%.bak' THEN 1 ELSE 0 END as isBackupFile
            FROM #dirs
            ORDER BY isFile, subdirectory;
            
            DROP TABLE #dirs;
        `;
        
        const result = await pool.request()
            .input('browsePath', sql.NVarChar, browsePath)
            .query(query);
        
        console.log(`[SUCCESS] Listed ${result.recordset.length} items`);
        res.json({
            path: browsePath,
            items: result.recordset
        });
        
    } catch (err) {
        console.error('[ERROR] Browse path failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get available drives on SQL Server machine
app.get('/api/server-drives', requireConnection, async (req, res) => {
    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        // Get available drives using xp_fixeddrives
        const query = `
            EXEC xp_fixeddrives;
        `;
        
        const result = await pool.request().query(query);
        
        // Format as drive letters
        const drives = result.recordset.map(row => ({
            drive: row.drive + ':\\',
            name: `${row.drive}: Drive`,
            freeMB: row.MB_free || 0
        }));
        
        console.log(`[SUCCESS] Found ${drives.length} drives`);
        res.json(drives);
        
    } catch (err) {
        console.error('[ERROR] Get drives failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get common backup locations on SQL Server machine
app.get('/api/backup-locations', requireConnection, async (req, res) => {
    const { pool } = connectionPools.get(req.session.connectionId);
    
    try {
        // Get SQL Server's default backup directory
        const query = `
            DECLARE @BackupDirectory NVARCHAR(512);
            
            EXEC master.dbo.xp_instance_regread 
                N'HKEY_LOCAL_MACHINE',
                N'Software\\Microsoft\\MSSQLServer\\MSSQLServer',
                N'BackupDirectory',
                @BackupDirectory OUTPUT;
            
            SELECT @BackupDirectory as defaultBackupPath;
        `;
        
        const result = await pool.request().query(query);
        
        const locations = [];
        
        // Add default backup directory
        if (result.recordset[0] && result.recordset[0].defaultBackupPath) {
            locations.push({
                path: result.recordset[0].defaultBackupPath,
                name: 'SQL Server Default Backup Folder',
                isDefault: true
            });
        }
        
        // Add common backup locations
        locations.push(
            { path: 'C:\\Backup', name: 'C:\\Backup', isDefault: false },
            { path: 'D:\\Backup', name: 'D:\\Backup', isDefault: false },
            { path: 'C:\\SQLBackups', name: 'C:\\SQLBackups', isDefault: false }
        );
        
        console.log('[SUCCESS] Retrieved backup locations');
        res.json(locations);
        
    } catch (err) {
        console.error('[ERROR] Get backup locations failed:', err.message);
        // Return some defaults even if query fails
        res.json([
            { path: 'C:\\Backup', name: 'C:\\Backup', isDefault: false },
            { path: 'D:\\Backup', name: 'D:\\Backup', isDefault: false }
        ]);
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', activeConnections: connectionPools.size });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Start server
const PORT = process.env.PORT || process.argv[2] || 3000;

const server = app.listen(PORT, () => {
    console.log('=================================');
    console.log(`✓ SQL Manager running on http://localhost:${PORT}`);
    console.log('=================================');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('=================================');
        console.error(`✗ ERROR: Port ${PORT} is already in use!`);
        console.error('=================================');
        console.error(`Try: node server.js ${PORT + 1}`);
        process.exit(1);
    } else {
        console.error('✗ Server error:', err.message);
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    for (const [id, { pool }] of connectionPools) {
        try {
            await pool.close();
        } catch (err) {
            console.error('Error closing connection:', err);
        }
    }
    server.close(() => {
        process.exit(0);
    });
});