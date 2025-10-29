# SQL Server Manager - Complete Feature Guide

## 🎉 Version 2.0 - All Features Complete!

This comprehensive SQL Server management application provides a beautiful, modern interface for managing your SQL Server databases with full CRUD operations, advanced querying, and data export capabilities.

---

## 📑 Table of Contents

1. [Getting Started](#getting-started)
2. [Connection Options](#connection-options)
3. [Core Features](#core-features)
4. [Mode-by-Mode Guide](#mode-by-mode-guide)
5. [Advanced Features](#advanced-features)
6. [Export Options](#export-options)
7. [Tips & Tricks](#tips--tricks)

---

## 🚀 Getting Started

### Installation

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Server:**
   - **Option A (Node.js):**
     ```bash
     npm start
     ```
   - **Option B (Windows Batch):**
     ```bash
     Run-SQL-Manager.bat
     ```
   - **Option C (Custom Port):**
     ```bash
     node server.js 8080
     ```

3. **Access the Application:**
   - Open your browser to: `http://localhost:3000`
   - The batch file will auto-open your browser

---

## 🔐 Connection Options

The application supports **three authentication methods**:

### 1. SQL Server Authentication
- **Use when:** You have a SQL Server username and password
- **Fields:**
  - Server Address (e.g., `localhost`, `192.168.1.100`, `server.domain.com`)
  - Username (e.g., `sa`)
  - Password
  - Database (optional - leave empty to see all databases)

### 2. Windows Authentication (Current User)
- **Use when:** You're logged into Windows and want to use your current credentials
- **Fields:**
  - Server Address only
  - No username/password needed
  - Uses your Windows session automatically

### 3. Windows Authentication (Custom User)
- **Use when:** You want to authenticate with a specific Windows account
- **Fields:**
  - Server Address
  - Domain (optional - leave empty for local accounts)
  - Windows Username
  - Windows Password

### Connection Options
- ✅ **Trust Certificate** (recommended for local/dev environments)
- 🔒 **Encrypt Connection** (for secure production connections)

---

## 🎯 Core Features

### ✅ Complete CRUD Operations
- **CREATE** - Insert new records with a visual form
- **READ** - Search and view data with advanced filters
- **UPDATE** - Edit records inline with modal dialogs
- **DELETE** - Remove records with confirmation dialogs

### 🔍 Five Operating Modes
1. **Simple Search** - User-friendly form-based searching
2. **Custom SQL** - Execute any SQL SELECT query
3. **Table Joins** - Visual join builder with preview
4. **Aggregations** - GROUP BY with aggregate functions
5. **Schema Viewer** - Explore table structures and relationships

### 📊 Data Export
- **CSV** - Comma-separated values for Excel/spreadsheets
- **JSON** - Structured data for APIs and applications
- **Excel (XLSX)** - Native Excel format with formatting

### 📜 Query History
- Save recent queries automatically
- Favorite important queries
- Re-run previous queries with one click
- Search through query history

---

## 🎨 Mode-by-Mode Guide

### 1️⃣ Simple Search Mode

**Best for:** Everyday querying and data management

#### Features:
- Select database and table from dropdowns
- Add multiple search criteria (AND conditions)
- Advanced options:
  - **Result Limit:** 100 / 500 / 1,000 / 5,000 / No limit
  - **ORDER BY:** Sort by any column
  - **DISTINCT:** Get unique rows only
- Edit and delete records directly from results
- Insert new records with ➕ Add Record button

#### How to Use:
1. Select your database
2. Select your table
3. Add search criteria (field + value pairs)
4. Click 🔍 **Search**
5. Results appear in a table with Edit/Delete buttons
6. Click ➕ **Add Record** to insert new data

#### Tips:
- Leave search fields empty to see all records
- Use ORDER BY to sort results
- Primary keys are highlighted in blue during edits
- Tables without primary keys use all columns for identification

---

### 2️⃣ Custom SQL Mode

**Best for:** Power users who need full SQL control

#### Features:
- Write any SELECT query
- Syntax highlighting in textarea
- Execution time displayed
- Full error messages
- Results displayed in table format

#### How to Use:
1. Select target database
2. Write your SQL query (SELECT only)
3. Click ▶️ **Execute Query**

#### Example Queries:
```sql
-- Basic query
SELECT * FROM dbo.Users WHERE Age > 25

-- Join query
SELECT u.Name, o.OrderDate, o.Total
FROM dbo.Users u
INNER JOIN dbo.Orders o ON u.UserID = o.UserID
WHERE o.Total > 100

-- Aggregation
SELECT Category, COUNT(*) as Count, AVG(Price) as AvgPrice
FROM dbo.Products
GROUP BY Category
HAVING COUNT(*) > 5
ORDER BY AvgPrice DESC
```

#### Limitations:
- SELECT queries only (no INSERT/UPDATE/DELETE)
- Results are read-only (no inline editing)
- Still allows export to CSV/JSON/Excel

---

### 3️⃣ Table Joins Mode

**Best for:** Combining data from multiple related tables

#### Features:
- Visual join builder
- Support for INNER, LEFT, RIGHT, and FULL OUTER joins
- Table aliases (t1, t2, t3...)
- Column-by-column join conditions
- SQL preview before execution
- Add multiple joins in sequence

#### How to Use:
1. Select database
2. Choose primary (starting) table
3. Click **+ Add Join** for each additional table
4. For each join:
   - Select join type (INNER, LEFT, RIGHT, FULL OUTER)
   - Choose table to join
   - Select left table and column
   - Select right column to match
5. Review generated SQL
6. Click ▶️ **Execute Join**

#### Example Use Case:
Join Users → Orders → OrderDetails:
- **Primary Table:** Users (as t1)
- **Join 1:** INNER JOIN Orders (as t2) ON t1.UserID = t2.UserID
- **Join 2:** INNER JOIN OrderDetails (as t3) ON t2.OrderID = t3.OrderID

---

### 4️⃣ Aggregations Mode

**Best for:** Statistical analysis and grouping data

#### Features:
- Visual GROUP BY builder
- Aggregate functions: COUNT, SUM, AVG, MIN, MAX
- Multiple aggregate functions at once
- HAVING clause support for filtering groups
- SQL preview before execution

#### How to Use:
1. Select database and table
2. **Select Columns** - Choose fields to display
3. **Add Aggregate Functions** - Click + Add Function:
   - Choose function (COUNT, SUM, AVG, MIN, MAX)
   - Select column to aggregate
   - Give it an alias (e.g., "TotalSales")
4. **GROUP BY Columns** - Select columns to group by
5. **HAVING Conditions (Optional)** - Filter grouped results:
   - Choose aggregate function
   - Set comparison (>, <, =, etc.)
   - Enter value
6. Review SQL and click ▶️ **Execute Query**

#### Example Use Case:
**Question:** "How many orders does each customer have, and what's their total spend?"

**Setup:**
- **Table:** Orders
- **Select Columns:** CustomerID
- **Aggregates:** 
  - COUNT(*) as OrderCount
  - SUM(Total) as TotalSpent
- **GROUP BY:** CustomerID
- **HAVING:** TotalSpent > 1000

**Generated SQL:**
```sql
SELECT CustomerID, COUNT(*) as OrderCount, SUM(Total) as TotalSpent
FROM dbo.Orders
GROUP BY CustomerID
HAVING SUM(Total) > 1000
```

---

### 5️⃣ Schema Viewer Mode

**Best for:** Understanding database structure and relationships

#### Features:
- View complete table schema
- Column details: names, types, nullable, defaults
- Primary key identification
- Foreign key relationships
- Index information

#### What You'll See:
1. **Table Information:**
   - Database name
   - Schema name
   - Table name
   - Full path

2. **Columns:**
   - Column name
   - Data type (varchar, int, datetime, etc.)
   - Max length
   - Is Nullable?
   - Default value

3. **Primary Keys:**
   - Key name
   - Columns involved
   - Constraint details

4. **Foreign Keys:**
   - Constraint name
   - Source column
   - Referenced table
   - Referenced column
   - Update/Delete rules (CASCADE, NO ACTION, etc.)

5. **Indexes:**
   - Index name
   - Type (Clustered, Non-clustered)
   - Columns included
   - Is unique?
   - Is primary key?

#### How to Use:
1. Select database
2. Select table
3. View complete schema details automatically

---

## 🚀 Advanced Features

### 📝 INSERT (Add Record)

**Available in:** Simple Search Mode

#### How to Insert:
1. Select database and table
2. Click ➕ **Add Record** button
3. Fill in the form:
   - Enter values for each field
   - Leave empty for NULL values
   - Primary keys are marked in blue
4. Click **Insert**
5. Results refresh automatically

#### Tips:
- Enter numbers without quotes (e.g., `42`, not `"42"`)
- Use `true`/`false` for boolean fields
- Leave fields empty to insert NULL
- Dates can be entered as `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`

---

### ✏️ UPDATE (Edit Record)

**Available in:** Simple Search Mode (after searching)

#### How to Update:
1. Perform a search to display records
2. Click **Edit** button on any row
3. Modify values in the modal:
   - Primary keys are disabled (cannot be changed)
   - Change any non-PK field
   - Set to empty for NULL
4. Click **Update**
5. Results refresh automatically

#### Special Cases:
- **Tables WITHOUT Primary Keys:** 
  - ⚠️ Warning message shown
  - Uses ALL column values to identify the record
  - Be careful - may update multiple matching rows!

---

### 🗑️ DELETE (Remove Record)

**Available in:** Simple Search Mode (after searching)

#### How to Delete:
1. Perform a search to display records
2. Click **Delete** button on any row
3. Review the warning message
4. Click **Delete** in the confirmation modal
5. Results refresh automatically

#### Special Cases:
- **Tables WITHOUT Primary Keys:**
  - ⚠️ Extra warning shown
  - Uses ALL column values to identify the record
  - May delete multiple matching rows!

---

### 📜 Query History

**Access:** Click "📜 History" button (top-right corner)

#### Features:
- **Recent Queries** (last 20):
  - Timestamp (e.g., "2h ago", "yesterday")
  - Database name
  - Query preview (first 80 characters)
  - Actions: ▶️ Re-run | ⭐ Favorite | 🗑️ Delete

- **Favorites:**
  - Starred queries saved permanently
  - Quick access to important queries
  - Organized separately from history

#### How to Use:
1. Click **📜 History** button
2. Browse recent or favorite queries
3. Click ▶️ to re-run a query
4. Click ⭐ to add/remove from favorites
5. Click 🗑️ to delete from history
6. Click **Clear** to remove all items

---

## 📊 Export Options

**Available:** After any query execution with results

### Export Formats:

#### 1. 📄 CSV Export
- **Use for:** Excel, Google Sheets, data analysis tools
- **Format:** Comma-separated values
- **Features:**
  - Headers included
  - Proper escaping of quotes and commas
  - NULL values as empty fields
- **Filename:** `export_[timestamp].csv`

#### 2. 📋 JSON Export
- **Use for:** APIs, JavaScript applications, data integration
- **Format:** Pretty-printed JSON array
- **Features:**
  - Properly formatted with indentation
  - NULL values preserved
  - Ready for JSON.parse()
- **Filename:** `export_[timestamp].json`

#### 3. 📊 Excel Export
- **Use for:** Microsoft Excel, professional reports
- **Format:** Native .xlsx format
- **Features:**
  - Native Excel workbook
  - Single worksheet named "Data"
  - Proper data typing
  - Opens directly in Excel
- **Filename:** `export_[timestamp].xlsx`

### How to Export:
1. Execute any query that returns results
2. Results appear in table format
3. Click the export button of your choice:
   - 📄 **Export CSV**
   - 📋 **Export JSON**
   - 📊 **Export Excel**
4. File downloads automatically
5. Success message appears

---

## 💡 Tips & Tricks

### Performance Tips:
1. **Use Result Limits** - Start with 1,000 rows for large tables
2. **Add ORDER BY** - Get most recent or relevant data first
3. **Use DISTINCT** - Remove duplicates early to reduce result size
4. **Filter Early** - Add search criteria to narrow results

### Safety Tips:
1. **Primary Keys Matter** - Tables without PKs are risky for edit/delete
2. **Review Before Delete** - Always read the confirmation message
3. **Test First** - Try your query in Custom SQL mode first
4. **Backup First** - Always backup before bulk operations

### Productivity Tips:
1. **Use Query History** - Save time by reusing queries
2. **Favorite Important Queries** - Quick access to common tasks
3. **Use Joins Builder** - Easier than writing complex JOIN syntax
4. **Use Aggregations Builder** - Faster than memorizing GROUP BY syntax
5. **Schema Viewer First** - Check table structure before querying

### Search Tips:
1. **Leave Criteria Empty** - See all records
2. **Multiple Criteria** - All must match (AND logic)
3. **Use ORDER BY** - Sort results meaningfully
4. **Result Limits** - Preview before getting huge datasets

---

## 🎨 User Interface Features

### Visual Design:
- 🌌 **Space Theme** - Beautiful animated starfield background
- 🎨 **Dark Mode** - Easy on the eyes for long sessions
- 📱 **Responsive** - Works on desktop and tablet
- ⚡ **Fast** - Instant feedback and smooth animations

### User Experience:
- 🎯 **Intuitive** - Clear labels and helpful messages
- ⚠️ **Safe** - Confirmation dialogs for destructive actions
- 📊 **Informative** - Shows record counts and execution times
- 🔔 **Feedback** - Success/error messages for all actions

---

## 🔧 Technical Details

### Supported SQL Server Versions:
- SQL Server 2012+
- Azure SQL Database
- SQL Server Express

### Browser Compatibility:
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

### System Requirements:
- Node.js 14+ (16+ recommended)
- Windows (for Windows Authentication)
- 50MB disk space
- 512MB RAM minimum

---

## 📈 Feature Comparison

| Feature | Simple Search | Custom SQL | Joins | Aggregations | Schema |
|---------|--------------|------------|-------|--------------|---------|
| **CRUD Operations** | ✅ Full | ❌ Read-only | ❌ Read-only | ❌ Read-only | ❌ View-only |
| **Multiple Tables** | ❌ Single | ✅ Any | ✅ Multiple | ❌ Single | ❌ Single |
| **Aggregations** | ❌ No | ✅ Manual | ✅ Manual | ✅ Visual | ❌ N/A |
| **SQL Control** | ❌ Generated | ✅ Full | 🟨 Hybrid | 🟨 Hybrid | ❌ N/A |
| **Export Data** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Edit Results** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ N/A |
| **Beginner Friendly** | ✅✅✅ | ❌ | 🟨 | 🟨 | ✅✅ |
| **Power User** | ❌ | ✅✅✅ | ✅ | ✅ | ✅ |

---

## 🎓 Learning Path

### For Beginners:
1. Start with **Simple Search** - Learn the basics
2. Try **Schema Viewer** - Understand your database
3. Experiment with **Simple Search filters** - ORDER BY, DISTINCT
4. Practice **INSERT/UPDATE/DELETE** - Master CRUD operations
5. Move to **Custom SQL** - Write basic SELECT queries

### For Intermediate Users:
1. Master **Table Joins** - Combine related data
2. Learn **Aggregations** - Statistical analysis
3. Use **Query History** - Build a library of useful queries
4. Export data in different formats
5. Write complex queries in **Custom SQL**

### For Advanced Users:
1. Use **Custom SQL** for everything complex
2. Build **reusable query templates** with History/Favorites
3. Combine **Joins + Aggregations** for complex analysis
4. Use **Schema Viewer** for database documentation
5. Script bulk operations

---

## 🛠️ Troubleshooting

### Connection Issues:
- **"Connection failed"** - Check server name, credentials, network
- **"Trust certificate error"** - Enable "Trust Certificate" option
- **"Windows Auth failed"** - Check domain/username spelling
- **"Port in use"** - Start with custom port: `node server.js 8080`

### Query Issues:
- **"No data returned"** - Loosen search criteria
- **"Query timeout"** - Add LIMIT or more specific WHERE clause
- **"Permission denied"** - Check SQL Server user permissions
- **"Invalid column"** - Verify column names in Schema Viewer

### Performance Issues:
- **Slow queries** - Add WHERE clauses, use indexes
- **Large exports** - Use result limits before exporting
- **Browser freezing** - Export large datasets instead of viewing

---

## 🎉 Summary

You now have a **complete, production-ready SQL Server management tool** with:

✅ **5 powerful modes** for different use cases  
✅ **Full CRUD operations** (Create, Read, Update, Delete)  
✅ **Advanced querying** (Joins, Aggregations, Custom SQL)  
✅ **Data export** (CSV, JSON, Excel)  
✅ **Query history** with favorites  
✅ **Schema exploration** with relationships  
✅ **Beautiful, modern UI** with space theme  
✅ **3 authentication methods** for flexibility  
✅ **Windows batch file** for easy startup  

**Happy querying! 🚀**
