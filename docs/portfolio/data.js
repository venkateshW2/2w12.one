// data.js - Google Sheets Integration

// Project categories mapping (keep this as is)
const CATEGORY_MAPPING = {
    'GALLERY': 'sound-postproduction',
    'FILM': 'film-music',
    'SERIES': 'sound-designer',
    'TVC': 'sound-designer',
    'SHORT FILM': 'film-mix',
    'DOCUMENTARY': 'film-mix',
    'DIGITAL ADVT': 'sound-designer',
    'MUSIC PRODUCER': 'music-producer',
    'SCORE': 'music-producer',
    'MUSIC': 'music-producer',
    'LABS': 'labs'
};

// Data management class with Google Sheets integration
class ProjectDataManager {
    constructor() {
        this.projects = [];
        this.categories = [];
        this.currentFilter = 'all';
        this.sheetsUrl = null;
        this.loading = false;
    }

    // Set Google Sheets CSV URL
    setGoogleSheetsUrl(url) {
        this.sheetsUrl = url;
    }

    // Load data from Google Sheets
    async loadDataFromSheets() {
        if (!this.sheetsUrl) {
            console.error('Google Sheets URL not set. Using fallback data.');
            this.loadFallbackData();
            return;
        }

        try {
            this.loading = true;
            console.log('Loading data from Google Sheets...');

            // Fetch CSV data from Google Sheets
            const response = await fetch(this.sheetsUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const csvText = await response.text();
            console.log('CSV data received, parsing...');

            // Parse CSV using PapaParse (you'll need to include this library)
            const parsedData = this.parseCSV(csvText);
            
            // Process the data
            this.processProjects(parsedData);
            
            console.log(`Successfully loaded ${this.projects.length} projects from Google Sheets`);
            this.loading = false;

        } catch (error) {
            console.error('Error loading from Google Sheets:', error);
            console.log('Falling back to local data...');
            this.loadFallbackData();
            this.loading = false;
        }
    }

    // Simple CSV parser (or use PapaParse library for better parsing)
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = this.parseCSVLine(lines[i]);
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
                });
                data.push(obj);
            }
        }

        return data;
    }

    // Parse CSV line handling commas in quotes
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    // Process projects from parsed CSV data
    processProjects(rawData) {
        this.projects = rawData.map(project => {
            // Handle both single category (string) and multiple categories (array)
            const categoryString = project.category || '';
            const categories = categoryString.includes(',') 
                ? categoryString.split(',').map(c => c.trim())
                : [categoryString];
            
            // Map all categories and create a primary mapped category
            const mappedCategories = categories.map(cat => CATEGORY_MAPPING[cat] || 'labs');
            const primaryMappedCategory = mappedCategories[0];
            
            return {
                title: project.title || '',
                category: project.category || '',
                categories: categories,
                mappedCategories: mappedCategories,
                mappedCategory: primaryMappedCategory,
                role: project.role || '',
                year: parseInt(project.year) || new Date().getFullYear(),
                featured: project.featured === 'TRUE' || project.featured === 'true',
                details: project.details || '',
                collaboration: project.collaboration || '',
                location: project.location || '',
                technical: project.technical || '',
                context: project.context || '',
                link: project.link || '',
                video: project.video || '',
                image_url: project.image_url || '',
                slug: this.createSlug(project.title || '')
            };
        }).filter(project => project.title); // Remove empty entries

        this.categories = [...new Set(this.projects.flatMap(p => p.mappedCategories))];
        console.log('Processed projects:', this.projects.length);
        console.log('Categories:', this.categories);
    }

    // Fallback data in case Google Sheets fails
    loadFallbackData() {
        const fallbackData = [
            {
                title: "Mind Quantize",
                category: "LABS",
                role: "Concept / Development",
                year: 2019,
                featured: true,
                details: "Interactive installation interpreting brainwaves into sonic structures.",
                collaboration: "Serendipity Art Festival",
                location: "Goa",
                technical: "EEG sensors, Max/MSP, real-time audio processing",
                context: "Neurofeedback Art Installation",
                image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=120&fit=crop&crop=center"
            }
            // Add more fallback projects as needed
        ];

        this.processProjects(fallbackData);
    }

    // Create URL-friendly slug from title
    createSlug(title) {
        return title.toLowerCase()
                   .replace(/[^\w\s-]/g, '')
                   .replace(/\s+/g, '-');
    }

    // Existing methods (keep these as they are)
    getAllProjects() {
        return this.projects;
    }

    getFeaturedProjects() {
        return this.projects.filter(project => project.featured);
    }

    filterByCategory(category) {
        if (category === 'all') {
            return this.projects;
        }
        return this.projects.filter(project => 
            project.mappedCategories.includes(category)
        );
    }

    getProjectBySlug(slug) {
        return this.projects.find(project => project.slug === slug);
    }

    searchProjects(query) {
        const searchTerm = query.toLowerCase();
        return this.projects.filter(project => 
            project.title.toLowerCase().includes(searchTerm) ||
            project.details.toLowerCase().includes(searchTerm) ||
            project.role.toLowerCase().includes(searchTerm)
        );
    }

    getProjectsByYearRange(startYear, endYear) {
        return this.projects.filter(project => 
            project.year >= startYear && project.year <= endYear
        );
    }

    getStats() {
        const years = this.projects.map(p => p.year).filter(y => y && y !== 'N/A');
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const yearsActive = maxYear - minYear + 1;

        return {
            totalProjects: this.projects.length,
            featuredProjects: this.getFeaturedProjects().length,
            categories: this.categories.length,
            yearsActive: isFinite(yearsActive) ? yearsActive : 0,
            yearRange: `${minYear}-${maxYear}`
        };
    }

    // Check if data is currently loading
    isLoading() {
        return this.loading;
    }
}

// Global data manager instance
window.dataManager = new ProjectDataManager();