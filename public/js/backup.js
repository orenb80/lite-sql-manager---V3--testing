// Backup & Restore Module
const BackupModule = {
    // Initialize backup module
    init() {
        this.loadDatabases();
        this.loadBackupHistory();
    },

    // Load databases for backup
    async loadDatabases() {
        try {
            const response = await fetch('/api/databases');
            const databases = await response.json();
            
            const select = document.getElementById('backupDatabaseSelect');
            const restoreDbSelect = document.getElementById('restoreDatabaseSelect');
            
            select.innerHTML = '<option value="">-- Select Database --</option>';
            restoreDbSelect.innerHTML = '<option value="">-- Same as backup --</option>';
            
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db;
                option.textContent = db;
                select.appendChild(option);
                
                const restoreOption = document.createElement('option');
                restoreOption.value = db;
                restoreOption.textContent = db;
                restoreDbSelect.appendChild(restoreOption);
            });
        } catch (error) {
            this.showError('Failed to load databases: ' + error.message);
        }
    },

    // Perform database backup
    async performBackup() {
        const database = document.getElementById('backupDatabaseSelect').value;
        const backupType = document.getElementById('backupType').value;
        const backupPath = document.getElementById('backupPath').value.trim();
        const backupDescription = document.getElementById('backupDescription').value.trim();
        const compressionCheckbox = document.getElementById('backupCompression');
        const compression = compressionCheckbox ? compressionCheckbox.checked : false;

        if (!database) {
            this.showError('Please select a database');
            return;
        }

        if (!backupPath) {
            this.showError('Please specify a backup path');
            return;
        }

        const backupBtn = document.querySelector('#backupMode button[onclick*="performBackup"]');
        backupBtn.disabled = true;
        backupBtn.textContent = '⏳ Backing up...';

        try {
            const response = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    database,
                    backupType,
                    backupPath,
                    description: backupDescription,
                    compression
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Backup failed');
            }

            this.showSuccess(`✅ Backup completed successfully!\n\nFile: ${result.backupFile}\nSize: ${this.formatBytes(result.size)}\nDuration: ${result.duration}s`);
            this.loadBackupHistory();

        } catch (error) {
            this.showError('Backup failed: ' + error.message);
        } finally {
            backupBtn.disabled = false;
            backupBtn.textContent = '💾 Start Backup';
        }
    },

    // Load backup history
    async loadBackupHistory() {
        try {
            const response = await fetch('/api/backup/history');
            const backups = await response.json();

            const historyDiv = document.getElementById('backupHistory');
            
            if (backups.length === 0) {
                historyDiv.innerHTML = '<p class="no-data">No backup history available</p>';
                return;
            }

            let html = '<table class="results-table"><thead><tr>';
            html += '<th>Database</th><th>Type</th><th>File Name</th><th>Date</th><th>Size</th><th>Description</th><th>Actions</th>';
            html += '</tr></thead><tbody>';

            backups.forEach(backup => {
                html += '<tr>';
                html += `<td>${this.escapeHtml(backup.database_name)}</td>`;
                html += `<td><span class="backup-type-badge ${backup.type}">${backup.type}</span></td>`;
                html += `<td><code>${this.escapeHtml(backup.physical_device_name)}</code></td>`;
                html += `<td>${new Date(backup.backup_finish_date).toLocaleString()}</td>`;
                html += `<td>${this.formatBytes(backup.backup_size)}</td>`;
                html += `<td>${this.escapeHtml(backup.description || '-')}</td>`;
                html += `<td><button class="small-btn" onclick="BackupModule.prepareRestore('${this.escapeHtml(backup.physical_device_name)}', '${this.escapeHtml(backup.database_name)}')">📥 Restore</button></td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';
            historyDiv.innerHTML = html;

        } catch (error) {
            document.getElementById('backupHistory').innerHTML = 
                `<p class="error">Failed to load backup history: ${error.message}</p>`;
        }
    },

    // Prepare restore operation
    prepareRestore(backupFile, originalDatabase) {
        document.getElementById('restoreBackupPath').value = backupFile;
        document.getElementById('restoreDatabaseSelect').value = originalDatabase;
        
        // Scroll to restore section
        document.getElementById('restoreSection').scrollIntoView({ behavior: 'smooth' });
        
        // Highlight the restore section briefly
        const restoreSection = document.getElementById('restoreSection');
        restoreSection.style.background = '#fff3cd';
        setTimeout(() => {
            restoreSection.style.background = '';
        }, 2000);
    },

    // Perform database restore
    async performRestore() {
        const backupFile = document.getElementById('restoreBackupPath').value.trim();
        const targetDatabase = document.getElementById('restoreDatabaseSelect').value;
        const replaceExisting = document.getElementById('restoreReplace').checked;

        if (!backupFile) {
            this.showError('Please specify the backup file path');
            return;
        }

        // Confirmation dialog
        const confirmMsg = replaceExisting 
            ? `⚠️ WARNING: This will REPLACE the existing database "${targetDatabase || 'from backup'}".\n\nAll current data will be LOST!\n\nAre you sure you want to continue?`
            : `Are you sure you want to restore from:\n\n${backupFile}\n\nto database: ${targetDatabase || 'from backup'}?`;

        if (!confirm(confirmMsg)) {
            return;
        }

        const restoreBtn = document.querySelector('#restoreSection button[onclick*="performRestore"]');
        restoreBtn.disabled = true;
        restoreBtn.textContent = '⏳ Restoring...';

        try {
            const response = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    backupFile,
                    targetDatabase: targetDatabase || null,
                    replaceExisting
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Restore failed');
            }

            this.showSuccess(`✅ Database restored successfully!\n\nDatabase: ${result.database}\nDuration: ${result.duration}s`);
            this.loadDatabases();

        } catch (error) {
            this.showError('Restore failed: ' + error.message);
        } finally {
            restoreBtn.disabled = false;
            restoreBtn.textContent = '📥 Start Restore';
        }
    },

    // Verify backup file
    async verifyBackup() {
        const backupFile = document.getElementById('verifyBackupPath').value.trim();

        if (!backupFile) {
            this.showError('Please specify a backup file to verify');
            return;
        }

        const verifyBtn = document.querySelector('#verifySection button[onclick*="verifyBackup"]');
        verifyBtn.disabled = true;
        verifyBtn.textContent = '⏳ Verifying...';

        try {
            const response = await fetch('/api/backup/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backupFile })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Verification failed');
            }

            let infoHtml = '<div class="backup-info">';
            infoHtml += `<h3>✅ Backup File is Valid</h3>`;
            infoHtml += `<p><strong>Database:</strong> ${result.databaseName}</p>`;
            infoHtml += `<p><strong>Backup Date:</strong> ${new Date(result.backupDate).toLocaleString()}</p>`;
            infoHtml += `<p><strong>Backup Type:</strong> ${result.backupType}</p>`;
            infoHtml += `<p><strong>Server:</strong> ${result.serverName}</p>`;
            infoHtml += `<p><strong>SQL Version:</strong> ${result.sqlVersion}</p>`;
            if (result.description) {
                infoHtml += `<p><strong>Description:</strong> ${result.description}</p>`;
            }
            infoHtml += '</div>';

            document.getElementById('verifyResults').innerHTML = infoHtml;

        } catch (error) {
            document.getElementById('verifyResults').innerHTML = 
                `<div class="error">❌ Verification failed: ${error.message}</div>`;
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = '🔍 Verify Backup';
        }
    },

    // Get backup file info without verification
    async getBackupInfo() {
        const backupFile = document.getElementById('verifyBackupPath').value.trim();

        if (!backupFile) {
            this.showError('Please specify a backup file');
            return;
        }

        try {
            const response = await fetch('/api/backup/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backupFile })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to get backup info');
            }

            let infoHtml = '<div class="backup-info">';
            infoHtml += `<h3>📋 Backup File Information</h3>`;
            
            if (result.fileInfo && result.fileInfo.length > 0) {
                result.fileInfo.forEach(file => {
                    infoHtml += `<div class="file-info">`;
                    infoHtml += `<p><strong>Logical Name:</strong> ${file.LogicalName}</p>`;
                    infoHtml += `<p><strong>Type:</strong> ${file.Type === 'D' ? 'Data' : file.Type === 'L' ? 'Log' : 'Other'}</p>`;
                    infoHtml += `<p><strong>Physical Name:</strong> <code>${file.PhysicalName}</code></p>`;
                    infoHtml += `</div><hr>`;
                });
            }

            infoHtml += '</div>';
            document.getElementById('verifyResults').innerHTML = infoHtml;

        } catch (error) {
            document.getElementById('verifyResults').innerHTML = 
                `<div class="error">Failed to get backup info: ${error.message}</div>`;
        }
    },

    // Utility functions
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showError(message) {
        alert('❌ ' + message);
    },

    showSuccess(message) {
        alert(message);
    },

    // Handle file selection for backup path
    handleBackupFileSelect(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const fileName = file.name;
            
            // For backup, we're selecting a location/name, so just use the filename
            // User will likely need to edit the full path
            const pathInput = document.getElementById('backupPath');
            
            // Try to construct a reasonable path
            // Note: Browsers don't give us full path for security reasons
            if (file.path) {
                // If running in Electron or similar, might have full path
                pathInput.value = file.path;
            } else {
                // Otherwise, suggest a common backup location with the selected filename
                pathInput.value = `C:\\Backup\\${fileName}`;
            }
        }
    },

    // Handle file selection for restore path
    handleRestoreFileSelect(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            
            const pathInput = document.getElementById('restoreBackupPath');
            
            if (file.path) {
                // Full path available (Electron/packaged app)
                pathInput.value = file.path;
            } else {
                // Browser context - use name and suggest path
                pathInput.value = `C:\\Backup\\${file.name}`;
                
                // Show helpful message
                const helpText = pathInput.nextElementSibling.nextElementSibling;
                if (helpText && helpText.classList.contains('help-text')) {
                    const originalText = helpText.textContent;
                    helpText.textContent = `⚠️ Note: You may need to edit the path. Browser selected: ${file.name}`;
                    helpText.style.color = '#fbbc04';
                    setTimeout(() => {
                        helpText.textContent = originalText;
                        helpText.style.color = '';
                    }, 5000);
                }
            }
        }
    },

    // Handle file selection for verify path
    handleVerifyFileSelect(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            
            const pathInput = document.getElementById('verifyBackupPath');
            
            if (file.path) {
                // Full path available (Electron/packaged app)
                pathInput.value = file.path;
            } else {
                // Browser context - use name and suggest path
                pathInput.value = `C:\\Backup\\${file.name}`;
            }
        }
    }
};

// Initialize when backup mode is shown
function initBackupMode() {
    BackupModule.init();
}