# 💾 Backup & Restore Features - Complete Guide

## 🎉 What's New in Version 3.0

Your SQL Server Manager now includes **professional-grade database backup and restore capabilities!**

### ✅ New Features Added:

1. **💾 Database Backup**
   - Full, Differential, and Transaction Log backups
   - Compression support (recommended)
   - Custom backup descriptions
   - Progress tracking

2. **📥 Database Restore**
   - Restore from any backup file
   - Option to restore to different database
   - Replace existing database option
   - Safety confirmations

3. **🔍 Backup Verification**
   - Verify backup file integrity
   - View backup metadata
   - Get file structure information

4. **📜 Backup History**
   - View all backup operations
   - See backup type, size, and date
   - One-click restore from history
   - Sorted by most recent

---

## 🚀 Quick Start Guide

### **1. Access Backup & Restore**
1. Connect to your SQL Server
2. Click the **"💾 Backup & Restore"** tab at the top
3. You'll see four main sections

### **2. Create a Backup**

**Basic Backup (Recommended):**
```
1. Select Database: Choose which database to backup
2. Backup Type: Keep "Full Backup" selected
3. Backup Path: Enter path like: C:\Backup\MyDB_2025-10-28.bak
4. Description: (Optional) Add notes like "Monthly backup"
5. Compression: Keep checked (saves space)
6. Click "💾 Start Backup"
```

**Result:** Your database will be backed up to the specified location!

### **3. Restore from Backup**

**Basic Restore:**
```
1. Backup File Path: Enter the .bak file path
2. Target Database: Leave default or choose different database
3. Replace Existing: Check ONLY if you want to overwrite existing database
4. Click "📥 Start Restore"
5. Confirm the operation
```

⚠️ **WARNING:** If you check "Replace Existing", ALL data in the target database will be REPLACED!

---

## 📋 Detailed Features

### 💾 **Backup Types Explained**

#### **FULL Backup** (Recommended for most cases)
- **What it does:** Backs up the entire database
- **When to use:** 
  - Daily/weekly scheduled backups
  - Before major changes
  - Before upgrades
- **Pros:** Complete, self-contained backup
- **Cons:** Larger file size

#### **DIFFERENTIAL Backup** (Advanced)
- **What it does:** Backs up only changes since last FULL backup
- **When to use:** 
  - Between full backups
  - Save storage space
  - Faster backup process
- **Note:** Requires a FULL backup first!

#### **TRANSACTION LOG Backup** (Advanced)
- **What it does:** Backs up transaction log
- **When to use:** 
  - Point-in-time recovery
  - Minimal data loss scenarios
- **Note:** Only for databases in FULL recovery model

---

### 📥 **Restore Options**

#### **Same Database Restore**
- Restores backup to original database name
- Use "Replace Existing" to overwrite current data

#### **Different Database Restore**
- Choose different target database from dropdown
- Creates a copy of the backed-up database

#### **Safety Features**
- Confirmation dialogs for destructive operations
- Clear warnings before replacing data
- Automatic validation before restore

---

### 🔍 **Verification Tools**

#### **Verify Backup**
- Checks if backup file is valid
- Shows backup metadata:
  - Original database name
  - Backup date and time
  - Backup type
  - SQL Server version
  - Description

#### **Get File Info**
- Shows internal file structure
- Lists logical file names
- Shows data and log files
- Useful for troubleshooting

---

### 📜 **Backup History**

The Backup History section shows:
- **Database Name:** Which database was backed up
- **Type:** FULL, DIFFERENTIAL, or LOG
- **File Name:** Full path to backup file
- **Date:** When backup was completed
- **Size:** Backup file size
- **Description:** Custom notes (if provided)
- **Actions:** Quick "Restore" button

**Features:**
- Shows last 50 backups
- Click "🔄 Refresh" to update
- Click "📥 Restore" to quickly restore any backup
- Automatically scrolls to restore section

---

## 💡 Best Practices

### **Backup Strategy (Recommended)**

**For Small Databases (< 10 GB):**
```
✅ Daily FULL backups
✅ Keep 7 days of backups
✅ Enable compression
✅ Store on different drive than database
```

**For Large Databases (> 10 GB):**
```
✅ Weekly FULL backups (Sunday)
✅ Daily DIFFERENTIAL backups (Mon-Sat)
✅ Enable compression
✅ Keep 4 weeks of FULL backups
✅ Keep 1 week of DIFFERENTIAL backups
```

**For Critical Databases:**
```
✅ Daily FULL backups
✅ Hourly TRANSACTION LOG backups
✅ Test restores monthly
✅ Store backups offsite/cloud
```

### **Backup File Naming**

Use descriptive names with dates:
```
Good Examples:
✅ C:\Backup\MyDatabase_Full_2025-10-28.bak
✅ C:\Backup\CustomerDB_20251028_1530.bak
✅ C:\Backup\Production_Full_October.bak

Bad Examples:
❌ C:\Backup\backup.bak
❌ C:\Database.bak
❌ C:\temp.bak
```

### **Backup Location**

**DO:**
- ✅ Store on different physical drive than database
- ✅ Use descriptive folder names (C:\SQLBackups\)
- ✅ Ensure SQL Server has write permissions
- ✅ Monitor available disk space

**DON'T:**
- ❌ Store on same drive as database files
- ❌ Store on C:\ drive (system drive)
- ❌ Use network paths without testing
- ❌ Forget to check backup file sizes

---

## ⚙️ Technical Details

### **Backup Command (Behind the Scenes)**

When you create a FULL backup with compression, the app runs:
```sql
BACKUP DATABASE [YourDatabase] 
TO DISK = 'C:\Backup\YourDatabase.bak'
WITH INIT, COMPRESSION, STATS = 10, FORMAT
```

### **Restore Command (Behind the Scenes)**

When you restore with replace:
```sql
RESTORE DATABASE [YourDatabase] 
FROM DISK = 'C:\Backup\YourDatabase.bak'
WITH STATS = 10, REPLACE
```

### **Performance Notes**

- **Compression:** Reduces backup size by 50-70% typically
- **Timeout:** Backup operations have 10-minute timeout
- **Restore Timeout:** Restore operations have 30-minute timeout
- **Progress:** STATS = 10 shows progress every 10%

---

## 🔧 Troubleshooting

### **Common Issues & Solutions**

#### **Error: "Cannot open backup device"**
**Problem:** SQL Server can't access the backup path
**Solutions:**
- Check if folder exists
- Ensure SQL Server service has write permissions
- Verify path is correct (use full path like C:\Backup\file.bak)
- Check if drive has enough space

#### **Error: "Database is in use"**
**Problem:** Can't restore because database is active
**Solutions:**
- Make sure no one is using the database
- Use "Replace Existing" option (if appropriate)
- Or disconnect other users first

#### **Error: "Backup file is corrupt"**
**Problem:** Backup file is damaged or incomplete
**Solutions:**
- Use "Verify Backup" to check integrity
- Try restoring from earlier backup
- Check disk for errors

#### **Timeout Error**
**Problem:** Operation taking too long
**Solutions:**
- This is normal for large databases (9M records)
- Wait for operation to complete
- For huge databases, consider differential backups

---

## 📊 Using with Your 9 Million Record Table

### **Backup Performance**

For your large table:
- **Full Backup Time:** 2-10 minutes (depending on size)
- **Compressed Size:** ~30-50% of database size
- **Recommendation:** Use compression always

### **Restore Performance**

- **Restore Time:** 5-15 minutes for large databases
- **Tip:** Restore during off-hours if possible

### **Best Practice for Large Tables**

```
Monday:    FULL backup (10 min)
Tuesday:   DIFFERENTIAL backup (2 min)
Wednesday: DIFFERENTIAL backup (2 min)
Thursday:  DIFFERENTIAL backup (2 min)
Friday:    DIFFERENTIAL backup (2 min)
Saturday:  DIFFERENTIAL backup (2 min)
Sunday:    FULL backup (10 min)
```

This strategy:
- ✅ Reduces daily backup time
- ✅ Maintains recovery capability
- ✅ Saves storage space
- ✅ Minimizes performance impact

---

## 🎯 Real-World Examples

### **Example 1: Before Major Update**

**Scenario:** You need to update 1 million records

**Steps:**
1. Click "Backup & Restore" tab
2. Select your database
3. Choose "Full Backup"
4. Path: `C:\Backup\BeforeUpdate_2025-10-28.bak`
5. Description: "Backup before bulk update operation"
6. Click "Start Backup"
7. Wait for confirmation
8. Proceed with your update
9. If update fails, restore from this backup!

### **Example 2: Daily Backup Schedule**

**Morning Routine (9:00 AM):**
```
1. Open SQL Server Manager
2. Go to Backup & Restore
3. Select Production database
4. Type: FULL
5. Path: C:\Backup\Daily\Production_2025-10-28.bak
6. Description: "Daily morning backup"
7. Start Backup
8. Verify completion
```

### **Example 3: Disaster Recovery Test**

**Monthly Test:**
```
1. Create fresh FULL backup
2. Verify backup successfully completes
3. Go to Restore section
4. Select a TEST database (not production!)
5. Enter backup file path
6. Select different target database
7. Perform restore
8. Verify data is intact
9. Document test results
```

---

## 📞 Support Information

### **Files Updated**

- ✅ `server.js` - Added 5 new backup/restore endpoints
- ✅ `index.html` - Added backup tab and UI
- ✅ `backup.js` - New module for backup functionality
- ✅ `app.js` - Updated mode switching
- ✅ `styles.css` - Added backup styling

### **New Endpoints Available**

- `POST /api/backup` - Create backup
- `GET /api/backup/history` - Get backup list
- `POST /api/restore` - Restore database
- `POST /api/backup/verify` - Verify backup
- `POST /api/backup/info` - Get backup details

---

## 🎓 Learning More

### **SQL Server Backup Types**
- [Microsoft Docs: Backup Overview](https://docs.microsoft.com/sql/relational-databases/backup-restore/backup-overview-sql-server)

### **Recovery Models**
- [Understanding Recovery Models](https://docs.microsoft.com/sql/relational-databases/backup-restore/recovery-models-sql-server)

### **Best Practices**
- Test restores regularly
- Keep multiple backup copies
- Store backups off-site
- Document backup procedures
- Monitor backup success/failure

---

## 🎉 You're Ready!

You now have professional database backup and restore capabilities! 

**Next Steps:**
1. Test the backup feature with a small database first
2. Set up a regular backup schedule
3. Test a restore operation
4. Document your backup strategy

**Questions?** Review this guide or check the troubleshooting section!

---

*Version 3.0 - Backup & Restore Features*
*Updated: October 28, 2025*
