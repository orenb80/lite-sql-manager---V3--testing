// Query History Manager
const QueryHistory = {
    MAX_HISTORY: 20,
    STORAGE_KEY: 'sql_manager_query_history',
    FAVORITES_KEY: 'sql_manager_favorites',

    // Save query to history
    saveQuery(query, database, mode = 'custom', metadata = {}) {
        const history = this.getHistory();
        const timestamp = new Date().toISOString();
        
        const queryEntry = {
            id: Date.now(),
            query: query.trim(),
            database: database,
            mode: mode, // 'custom' or 'simple'
            timestamp: timestamp,
            metadata: metadata, // Can store table, schema, criteria, etc.
            isFavorite: false
        };
        
        // Don't save duplicate consecutive queries
        if (history.length > 0 && history[0].query === queryEntry.query) {
            return;
        }
        
        // Add to beginning of array
        history.unshift(queryEntry);
        
        // Keep only MAX_HISTORY items
        if (history.length > this.MAX_HISTORY) {
            history.pop();
        }
        
        this.setHistory(history);
        this.updateHistoryUI();
    },

    // Get all history
    getHistory() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading history:', error);
            return [];
        }
    },

    // Save history to localStorage
    setHistory(history) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    },

    // Get favorites
    getFavorites() {
        try {
            const data = localStorage.getItem(this.FAVORITES_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading favorites:', error);
            return [];
        }
    },

    // Save favorites
    setFavorites(favorites) {
        try {
            localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    },

    // Toggle favorite
    toggleFavorite(queryId) {
        const history = this.getHistory();
        const favorites = this.getFavorites();
        
        // Find query in history
        const query = history.find(q => q.id === queryId);
        if (!query) return;
        
        // Check if already in favorites
        const favIndex = favorites.findIndex(f => f.id === queryId);
        
        if (favIndex >= 0) {
            // Remove from favorites
            favorites.splice(favIndex, 1);
        } else {
            // Add to favorites
            favorites.push({...query, isFavorite: true});
        }
        
        this.setFavorites(favorites);
        this.updateHistoryUI();
    },

    // Delete query from history
    deleteQuery(queryId) {
        const history = this.getHistory();
        const filtered = history.filter(q => q.id !== queryId);
        this.setHistory(filtered);
        this.updateHistoryUI();
    },

    // Clear all history
    clearHistory() {
        if (confirm('Are you sure you want to clear all query history? Favorites will be preserved.')) {
            this.setHistory([]);
            this.updateHistoryUI();
            showMessage('History cleared', 'info');
        }
    },

    // Clear favorites
    clearFavorites() {
        if (confirm('Are you sure you want to clear all favorite queries?')) {
            this.setFavorites([]);
            this.updateHistoryUI();
            showMessage('Favorites cleared', 'info');
        }
    },

    // Re-run a query
    rerunQuery(queryId) {
        const history = this.getHistory();
        const favorites = this.getFavorites();
        
        // Check both history and favorites
        let query = history.find(q => q.id === queryId);
        if (!query) {
            query = favorites.find(f => f.id === queryId);
        }
        
        if (!query) {
            showMessage('Query not found', 'error');
            return;
        }
        
        // Switch to appropriate mode
        if (query.mode === 'custom') {
            // Switch to custom SQL mode
            document.querySelectorAll('.mode-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.textContent.includes('Custom SQL')) {
                    tab.classList.add('active');
                }
            });
            document.getElementById('simpleMode').classList.add('hidden');
            document.getElementById('customMode').classList.remove('hidden');
            currentMode = 'custom';
            
            // Load databases if not loaded
            loadDatabasesForCustom();
            
            // Set database and query
            setTimeout(() => {
                document.getElementById('customDatabase').value = query.database;
                document.getElementById('customQuery').value = query.query;
            }, 100);
            
            showMessage('Query loaded. Click Execute to run.', 'info');
        } else if (query.mode === 'simple' && query.metadata) {
            // Switch to simple search mode
            document.querySelectorAll('.mode-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.textContent.includes('Simple Search')) {
                    tab.classList.add('active');
                }
            });
            document.getElementById('simpleMode').classList.remove('hidden');
            document.getElementById('customMode').classList.add('hidden');
            currentMode = 'simple';
            
            showMessage('Simple search parameters loaded', 'info');
        }
        
        // Close history panel
        this.toggleHistoryPanel();
    },

    // Format date for display
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    },

    // Toggle history panel
    toggleHistoryPanel() {
        const panel = document.getElementById('historyPanel');
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            this.updateHistoryUI();
        } else {
            panel.classList.add('hidden');
        }
    },

    // Update history UI
    updateHistoryUI() {
        const history = this.getHistory();
        const favorites = this.getFavorites();
        
        const historyList = document.getElementById('historyList');
        const favoritesList = document.getElementById('favoritesList');
        
        if (!historyList || !favoritesList) return;
        
        // Render favorites
        if (favorites.length === 0) {
            favoritesList.innerHTML = '<div style="color: #5f6368; font-style: italic; padding: 10px;">No favorites yet</div>';
        } else {
            favoritesList.innerHTML = favorites.map(query => this.renderQueryItem(query, true)).join('');
        }
        
        // Render history
        if (history.length === 0) {
            historyList.innerHTML = '<div style="color: #5f6368; font-style: italic; padding: 10px;">No recent queries</div>';
        } else {
            historyList.innerHTML = history.map(query => this.renderQueryItem(query, false)).join('');
        }
    },

    // Render single query item
    renderQueryItem(query, isFavorite) {
        const truncatedQuery = query.query.length > 80 ? query.query.substring(0, 80) + '...' : query.query;
        const favoriteIcon = isFavorite ? '⭐' : '☆';
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-time">${this.formatDate(query.timestamp)}</span>
                    <span class="history-database">📊 ${query.database}</span>
                </div>
                <div class="history-query">${truncatedQuery}</div>
                <div class="history-actions">
                    <button class="history-btn" onclick="QueryHistory.rerunQuery(${query.id})" title="Re-run query">▶️</button>
                    <button class="history-btn" onclick="QueryHistory.toggleFavorite(${query.id})" title="Toggle favorite">${favoriteIcon}</button>
                    <button class="history-btn" onclick="QueryHistory.deleteQuery(${query.id})" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    }
};

// Initialize history panel on page load
window.addEventListener('load', () => {
    // Add history button to main page if it doesn't exist
    const mainPage = document.getElementById('mainPage');
    if (mainPage && !document.getElementById('historyPanel')) {
        const historyHTML = `
            <button class="history-toggle-btn" onclick="QueryHistory.toggleHistoryPanel()" title="Query History">
                📜 History
            </button>
            
            <div id="historyPanel" class="history-panel hidden">
                <div class="history-panel-header">
                    <h3>📜 Query History</h3>
                    <button class="history-close-btn" onclick="QueryHistory.toggleHistoryPanel()">✕</button>
                </div>
                
                <div class="history-section">
                    <div class="history-section-header">
                        <h4>⭐ Favorites</h4>
                        <button class="history-clear-btn" onclick="QueryHistory.clearFavorites()">Clear</button>
                    </div>
                    <div id="favoritesList"></div>
                </div>
                
                <div class="history-section">
                    <div class="history-section-header">
                        <h4>🕐 Recent Queries</h4>
                        <button class="history-clear-btn" onclick="QueryHistory.clearHistory()">Clear</button>
                    </div>
                    <div id="historyList"></div>
                </div>
            </div>
        `;
        
        mainPage.insertAdjacentHTML('afterbegin', historyHTML);
    }
});