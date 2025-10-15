// main.js - FIXED VERSION - Don't break existing functionality

class App {
    constructor() {
        this.canvas = null;
        this.initialized = false;
    }

    // Initialize the entire application
    async init() {
        console.log('Starting application initialization...');

        try {
            // Wait for DOM to be fully loaded
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // KEEP YOUR WORKING GOOGLE SHEETS URL - DON'T CHANGE IT
            const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQOCH8WgkFC85dwlZZw_wkAW_IRUhzIa8859fJjgJ1YJi48fAEe3WMCHvqAE2fNkG_-hITUVvpL4f7J/pub?output=csv';
            
            // Configure data manager with Google Sheets URL
            window.dataManager.setGoogleSheetsUrl(GOOGLE_SHEETS_CSV_URL);

            // Load data from Google Sheets
            console.log('Loading project data from Google Sheets...');
            await window.dataManager.loadDataFromSheets();

            // Initialize UI manager
            console.log('Setting up UI...');
            window.uiManager.initialize();

            // Hide loading screen immediately after UI init
            console.log('Hiding loading screen immediately...');
            this.hideLoadingScreen();
            
            // Initialize canvas after a brief moment to ensure data is loaded
            setTimeout(() => {
                this.initCanvas();
            }, 200);

            this.initialized = true;
            console.log('Application initialized successfully with Google Sheets data');

        } catch (error) {
            console.error('Error initializing application:', error);
            this.handleInitError(error);
        }
    }

    // Initialize the background canvas - KEEP EXISTING CLASS NAME
    initCanvas() {
        try {
            // Use the existing DataCanvas class name to avoid breaking
            this.canvas = new DataCanvas('data-canvas');
            console.log('Canvas initialized with project data');
        } catch (error) {
            console.warn('Canvas initialization failed:', error);
            // Continue without canvas - not critical for functionality
        }
    }

    // Hide the loading screen
    hideLoadingScreen() {
        console.log('Attempting to hide loading screen...');
        
        // Immediately hide loading screen without delay
        this.forceHideLoading();
        
        // Also try UI manager method if available
        if (window.uiManager) {
            window.uiManager.hideLoading();
        }
    }

    // Force hide loading screen (more aggressive)
    forceHideLoading() {
        console.log('Force hiding loading screen...');
        
        const loading = document.getElementById('loading');
        const mainContainer = document.getElementById('main-container');
        
        if (loading) {
            // Completely remove from DOM instead of just hiding
            loading.remove();
            console.log('Loading screen completely removed from DOM');
        }
        
        if (mainContainer) {
            mainContainer.classList.remove('hidden');
            mainContainer.style.display = 'block';
            mainContainer.style.visibility = 'visible';
            mainContainer.style.pointerEvents = 'auto';
            console.log('Main container force shown');
        }
        
        // Remove any other loading elements that might exist
        const allLoadingElements = document.querySelectorAll('.loading, [id*="loading"], [class*="loading"]');
        allLoadingElements.forEach(el => {
            if (el.id !== 'main-container') {
                el.remove();
            }
        });
        
        console.log('All loading interference completely eliminated');
    }

    // Handle initialization errors
    handleInitError(error) {
        console.error('Application failed to initialize:', error);
        
        // Show error message to user
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div style="text-align: center; color: #999;">
                    <p>Error loading portfolio</p>
                    <p style="font-size: 10px; margin-top: 10px;">Loading offline data...</p>
                </div>
            `;
            
            // Try to load fallback data
            setTimeout(() => {
                window.dataManager.loadFallbackData();
                window.uiManager.initialize();
                this.hideLoadingScreen();
            }, 2000);
        }
    }

    // Refresh data from Google Sheets
    async refreshData() {
        console.log('Refreshing data from Google Sheets...');
        try {
            await window.dataManager.loadDataFromSheets();
            window.uiManager.initialize(); // Re-render with new data
            
            // Update canvas with new data if available
            if (this.canvas && this.canvas.updateWithFilteredProjects) {
                window.uiManager.initialize();
            }
            
            console.log('Data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    // Cleanup when page is unloaded
    destroy() {
        if (this.canvas) {
            this.canvas.destroy();
        }
        console.log('Application cleaned up');
    }
}

// Global application instance
window.app = new App();

// Start the application when the script loads
window.app.init();

// Backup initialization on window load
window.addEventListener('load', () => {
    console.log('Window fully loaded - running backup initialization');
    
    // Force hide any remaining loading screens
    window.app.forceHideLoading();
    
    // Ensure UI is initialized
    if (window.uiManager && !window.uiManager.initialized) {
        console.log('Running backup UI initialization');
        window.uiManager.initialize();
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.app.destroy();
});

// Handle any uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
});

// Debug helpers and click testing
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Add global click listener for debugging
    document.addEventListener('click', (e) => {
        console.log('Global click detected on:', e.target.tagName, e.target.className, e.target.id);
    });

    window.debug = {
        dataManager: () => window.dataManager,
        uiManager: () => window.uiManager,
        app: () => window.app,
        projects: () => window.dataManager?.getAllProjects(),
        filterProjects: (category) => window.uiManager?.filterProjects(category),
        stats: () => window.dataManager?.getStats(),
        refreshData: () => window.app.refreshData(),
        testClick: (selector) => {
            const element = document.querySelector(selector);
            if (element) {
                element.click();
                console.log('Clicked element:', element);
            } else {
                console.log('Element not found:', selector);
            }
        },
        forceHideLoading: () => {
            window.app.forceHideLoading();
        },
        testSheetsUrl: () => {
            const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQOCH8WgkFC85dwlZZw_wkAW_IRUhzIa8859fJjgJ1YJi48fAEe3WMCHvqAE2fNkG_-hITUVvpL4f7J/pub?output=csv';
            fetch(url).then(r => r.text()).then(data => console.log('Sheets data:', data.substring(0, 200) + '...'));
        }
    };
    
    console.log('Debug helpers available: window.debug');
    console.log('Test Google Sheets with: debug.testSheetsUrl()');
    console.log('Refresh data with: debug.refreshData()');
}