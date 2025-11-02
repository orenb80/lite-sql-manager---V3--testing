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
    },

    // ============================================
    // SERVER FILE BROWSER (Browse SQL Server Machine)
    // ============================================

    currentBrowsePath: 'C:\\',
    currentInputTarget: null,

    // Open server file browser modal
    async openServerBrowser(inputId) {
        this.currentInputTarget = inputId;
        
        // Create modal if it doesn't exist
        if (!document.getElementById('serverFileBrowserModal')) {
            this.createServerBrowserModal();
        }
        
        // Show modal
        document.getElementById('serverFileBrowserModal').style.display = 'flex';
        
        // Load backup locations
        await this.loadBackupLocations();
    },

    // Create the server file browser modal
    createServerBrowserModal() {
        const modalHTML = `
            <div id="serverFileBrowserModal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 700px; max-height: 80vh;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3>📁 Browse SQL Server Files</h3>
                        <button class="modal-close-btn" onclick="BackupModule.closeServerBrowser()">✕</button>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="color: #9aa0a6; font-size: 12px; display: block; margin-bottom: 5px;">Quick Locations:</label>
                        <div id="quickLocations" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="color: #9aa0a6; font-size: 12px; display: block; margin-bottom: 5px;">Current Path:</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="browserCurrentPath" readonly style="flex: 1; background: rgba(26, 29, 41, 0.6);">
                            <button onclick="BackupModule.browseParentFolder()" style="padding: 8px 16px;">⬆️ Up</button>
                        </div>
                    </div>
                    
                    <div id="fileBrowserContent" style="max-height: 400px; overflow-y: auto; background: rgba(26, 29, 41, 0.6); border: 1px solid #2f3339; border-radius: 6px; padding: 10px;">
                        <p style="text-align: center; color: #9aa0a6;">Loading...</p>
                    </div>
                    
                    <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="cancel-btn" onclick="BackupModule.closeServerBrowser()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    // Close server browser modal
    closeServerBrowser() {
        const modal = document.getElementById('serverFileBrowserModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // Load backup locations (quick access)
    async loadBackupLocations() {
        try {
            const response = await fetch('/api/backup-locations');
            const locations = await response.json();
            
            const quickLocDiv = document.getElementById('quickLocations');
            quickLocDiv.innerHTML = '';
            
            locations.forEach(loc => {
                const btn = document.createElement('button');
                btn.className = 'quick-location-btn';
                btn.textContent = loc.isDefault ? '⭐ ' + loc.name : loc.name;
                btn.onclick = () => this.browsePath(loc.path);
                quickLocDiv.appendChild(btn);
            });
            
            // Load default path
            if (locations.length > 0 && locations[0].isDefault) {
                await this.browsePath(locations[0].path);
            } else {
                await this.browsePath('C:\\');
            }
            
        } catch (error) {
            console.error('Failed to load backup locations:', error);
            await this.browsePath('C:\\');
        }
    },

    // Browse to specific path
    async browsePath(path) {
        this.currentBrowsePath = path;
        document.getElementById('browserCurrentPath').value = path;
        
        try {
            const response = await fetch('/api/browse-server-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to browse path');
            }
            
            this.displayBrowserItems(result.items);
            
        } catch (error) {
            document.getElementById('fileBrowserContent').innerHTML = 
                `<p style="color: #ea4335; text-align: center;">❌ Error: ${error.message}</p>`;
        }
    },

    // Display browser items
    displayBrowserItems(items) {
        const contentDiv = document.getElementById('fileBrowserContent');
        
        if (items.length === 0) {
            contentDiv.innerHTML = '<p style="text-align: center; color: #9aa0a6;">Empty folder</p>';
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 5px;">';
        
        items.forEach(item => {
            const icon = item.type === 'folder' ? '📁' : (item.isBackupFile ? '💾' : '📄');
            const itemClass = item.type === 'folder' ? 'browser-folder' : 'browser-file';
            const clickAction = item.type === 'folder' 
                ? `BackupModule.browseInto('${this.escapeHtml(item.name)}')`
                : `BackupModule.selectFile('${this.escapeHtml(item.name)}')`;
            
            html += `
                <div class="${itemClass}" onclick="${clickAction}">
                    <span>${icon} ${this.escapeHtml(item.name)}</span>
                </div>
            `;
        });
        
        html += '</div>';
        contentDiv.innerHTML = html;
    },

    // Browse into a folder
    async browseInto(folderName) {
        const newPath = this.currentBrowsePath.endsWith('\\') 
            ? this.currentBrowsePath + folderName
            : this.currentBrowsePath + '\\' + folderName;
        
        await this.browsePath(newPath);
    },

    // Browse to parent folder
    async browseParentFolder() {
        const parts = this.currentBrowsePath.split('\\');
        if (parts.length <= 2) {
            // Already at root (e.g., C:\)
            return;
        }
        
        parts.pop(); // Remove last part
        const parentPath = parts.join('\\');
        await this.browsePath(parentPath);
    },

    // Select a file
    selectFile(fileName) {
        const fullPath = this.currentBrowsePath.endsWith('\\')
            ? this.currentBrowsePath + fileName
            : this.currentBrowsePath + '\\' + fileName;
        
        // Set the path in the target input
        document.getElementById(this.currentInputTarget).value = fullPath;
        
        // Close modal
        this.closeServerBrowser();
        
        // Show success message
        this.showSuccess(`✅ Selected: ${fullPath}`);
    }
};

// Initialize when backup mode is shown
function initBackupMode() {
    BackupModule.init();
}