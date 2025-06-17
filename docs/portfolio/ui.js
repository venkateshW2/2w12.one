// ui.js - Updated with Canvas Integration

class UIManager {
    constructor() {
        this.currentFilter = 'all';
        this.filteredProjects = [];
        this.elements = {};
        this.mobileMenuOpen = false;
        this.initialized = false;
        
       
        this.categoryDescriptions = {
            'all': {
                title: 'Projects',
                text: 'Projects spanning sound design, music production, film mixing, multichannel audio, and interactive design.'
            },
            
            'sound-designer': {
                title: 'Sound Design',
                text: 'Projects listed under sound design are some those where I have worked for TV commercials, short films, documentaries, and digital advertisements. These projects are those were I had fun.'
            },

            'music-producer': {
                title: 'Music',
                text: 'Projects listed under music are those where I have had the opportunity to be music producer, mix/recording engineer, and media composer to create the required sonic experiences for film scores and music albums.'
            },
            'film-mix': {
                title: 'Film Projects',
                text: 'Projects listed under film mixing are those where I have collaborated with directors and sound designers to create immersive audio experiences for various films and documentaries.'
            },
            'labs': {
                title: 'Labs',
                text: 'Projects listed under labs are those where I have explored ideas and concepts in audio and technology.'
            }
        };
         this.initializeElements();
        this.setupEventListeners();
   }

    // Cache DOM elements
    initializeElements() {
        this.elements = {
            projectsContainer: document.getElementById('projects-container'),
            dataStream: document.getElementById('data-stream'),
            loading: document.getElementById('loading'),
            mainContainer: document.getElementById('main-container')
        };

        console.log('🎯 UI elements cached');
    }

    // Set up all event listeners using proper event delegation
    setupEventListeners() {
        // Use event delegation on document body for all clicks
        document.body.addEventListener('click', (e) => {
            console.log('👆 Click detected on:', e.target.tagName, e.target.className);

            // Category button clicks
            if (e.target.classList.contains('category-btn')) {
                e.preventDefault();
                this.handleCategoryClick(e);
                return;
            }

            // Mobile menu toggle
            if (e.target.closest('#mobile-menu-toggle')) {
                e.preventDefault();
                this.toggleMobileMenu();
                return;
            }

            // Mobile overlay clicks
            if (e.target.id === 'mobile-overlay') {
                this.closeMobileMenu();
                return;
            }

            // Credentials link
            if (e.target.id === 'credentials-link') {
                e.preventDefault();
                this.openCredentialsModal(e);
                return;
            }

            // Modal close button
            if (e.target.id === 'modal-close') {
                this.closeCredentialsModal();
                return;
            }

            // Modal background click
            if (e.target.id === 'credentials-modal') {
                this.closeCredentialsModal();
                return;
            }

            // Sidebar section headers
            if (e.target.closest('.sidebar-section-header')) {
                const section = e.target.closest('.sidebar-section');
                if (section && section.classList.contains('collapsed')) {
                    section.classList.remove('collapsed');
                } else if (section) {
                    section.classList.add('collapsed');
                }
                console.log('📂 Sidebar section toggled');
                return;
            }

            // Project card clicks (but not on links)
            if (e.target.closest('.project-card') && !e.target.closest('a')) {
                this.handleProjectCardClick(e);
                return;
            }
        });

        this.setupSmoothScrolling();
        console.log('🎯 Event listeners set up with delegation');
    }
    // Handle category button clicks
handleCategoryClick(e) {
    e.preventDefault();
    console.log('\n🏷️ === CATEGORY CLICK HANDLER ===');
    
    // Get filter type first - moved up
    const filterType = e.target.getAttribute('data-filter');
    console.log('📝 Button clicked:', e.target.textContent.trim());
    console.log('🔍 Data filter:', filterType);

    // Update active state for all category buttons
    const categoryButtons = document.querySelectorAll('.category-btn');
    console.log('🎯 Found category buttons:', categoryButtons.length);
    
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    // Handle filtering
    const filterCategories = filterType === 'all' ? ['all'] : filterType.split(' ');
    this.currentFilter = filterType;
    console.log('🔍 Filtering by categories:', filterCategories);
    
    this.filterProjects(filterCategories);
    
    // Handle category description
    const descriptionEl = document.getElementById('category-description');
    if (descriptionEl) {
        const titleEl = descriptionEl.querySelector('.category-title');
        const textEl = descriptionEl.querySelector('.category-text');
        
        const category = filterType.split(' ')[0];
        const description = this.categoryDescriptions[category] || this.categoryDescriptions['all'];
        
        // Remove active class first
        descriptionEl.classList.remove('active');
        
        // Set content and data-text for glitch effect
        titleEl.textContent = description.title;
        titleEl.setAttribute('data-text', description.title);
        textEl.textContent = description.text;
        
        // Force reflow
        void descriptionEl.offsetWidth;
        
        // Add active class to trigger animations
        setTimeout(() => {
            descriptionEl.classList.add('active');
        }, 50);
    }

    this.closeMobileMenu();
    console.log('✅ Category filter completed\n');
}

    // Filter and display projects
 filterProjects(categories) {
    console.log('\n📋 === FILTERING PROJECTS ===');
    console.log('🔍 Filter categories:', categories);

    if (!window.dataManager) {
        console.error('❌ DataManager not initialized');
        return;
    }

    const projectElements = document.querySelectorAll('.project-card');
    
    projectElements.forEach(project => {
        const projectCategory = project.dataset.category.toLowerCase();
        
        if (categories.includes('all')) {
            project.style.display = 'block';
        } else {
            // Check if any of the filter categories match the project category
            const shouldShow = categories.some(category => 
                projectCategory.includes(category.toLowerCase())
            );
            project.style.display = shouldShow ? 'block' : 'none';
        }
    });

    console.log('📦 Filtering complete');
    }

    // Render projects to the DOM
    renderProjects(projects) {
        if (!this.elements.projectsContainer) {
            console.error('❌ Projects container not found');
            return;
        }

        console.log('🎨 Rendering projects to DOM...');

        // Clear container
        this.elements.projectsContainer.innerHTML = '';

        if (projects.length === 0) {
            this.elements.projectsContainer.innerHTML = `
                <div class="no-projects">
                    <p>No projects found in this category.</p>
                    <p style="font-size: 12px; color: #999; margin-top: 8px;">
                        Try selecting a different category or check the browser console for debugging info.
                    </p>
                </div>
            `;
            console.log('⚠️ No projects to render');
            return;
        }

        // Create project cards and filter out broken ones
        let cardIndex = 0;
        projects.forEach((project) => {
            try {
                const card = this.createProjectCard(project, cardIndex);
                if (card) {
                    this.elements.projectsContainer.appendChild(card);
                    cardIndex++;
                }
            } catch (error) {
                console.warn(`⚠️ Failed to create card for "${project.title}":`, error.message);
            }
        });

        console.log(`✅ Rendered ${cardIndex} valid project cards out of ${projects.length} total projects`);
    }

    // Create individual project card with enhanced styling
    createProjectCard(project, index) {
        const card = document.createElement('div');
        
        // Choose your card style here:
        const CARD_STYLE = 'default'; // Options: 'default', 'text-only', 'minimal-icon', 'typography-focus'
        
        card.className = `project-card ${project.featured ? 'featured' : ''} ${CARD_STYLE}`;
        card.setAttribute('data-category', project.mappedCategory);
        card.style.animationDelay = `${index * 0.05}s`;

        // Generate category icon
        const categoryIcon = this.getCategoryIcon(project.mappedCategory);
        
        // Clean up data and validate
        const cleanTitle = project.title || 'Untitled Project';
        const cleanRole = project.role || 'Sound Artist';
        const cleanDetails = project.details || 'Project details coming soon...';
        const cleanYear = project.year || new Date().getFullYear();

        // Skip broken/malformed cards
        if (cleanTitle.length > 100 || 
            cleanTitle.includes('onload=') || 
            cleanTitle.includes('javascript:') ||
            cleanTitle.includes('<script>')) {
            console.warn(`⚠️ Skipping potentially malformed project: "${cleanTitle}"`);
            return null;
        }

        // Handle multiple categories display
        const categories = Array.isArray(project.categories) ? project.categories : [project.category];
        const categoryDisplay = categories.filter(cat => cat && cat.trim()).join(' • ');

        // Determine if image is valid
        const hasValidImage = project.image_url && 
                             project.image_url !== '' && 
                             project.image_url !== 'undefined' &&
                             !project.image_url.includes('placeholder') &&
                             (project.image_url.startsWith('http') || project.image_url.startsWith('data:'));

        // Create card HTML based on style
        let cardHTML = '';

        switch(CARD_STYLE) {
            case 'text-only':
                cardHTML = `
                    <div class="project-content">
                        <div class="project-year">${cleanYear}</div>
                        <h3 class="project-title">${cleanTitle}</h3>
                        <div class="project-role">${cleanRole}</div>
                        <div class="project-description">${cleanDetails}</div>
                        <div class="project-details">
                            ${project.collaboration ? `<div class="project-collaboration"><strong>Collaboration:</strong> ${project.collaboration}</div>` : ''}
                            ${project.technical ? `<div class="project-collaboration"><strong>Technical:</strong> ${project.technical}</div>` : ''}
                            ${project.location ? `<div class="project-collaboration"><strong>Location:</strong> ${project.location}</div>` : ''}
                            <div class="project-links">
                                ${project.link && project.link !== '' ? `<a href="${project.link}" target="_blank" class="project-link">View Project</a>` : ''}
                                ${project.video && project.video !== '' ? `<a href="${project.video}" target="_blank" class="project-link">Watch Video</a>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="expand-indicator">+</div>
                `;
                break;

            case 'minimal-icon':
                cardHTML = `
                    <div class="project-image">
                        <div class="project-image-placeholder">${categoryIcon}</div>
                        <div class="project-category-badge">${project.mappedCategory.replace('-', ' ')}</div>
                    </div>
                    <div class="project-content">
                        <div class="project-meta">
                            <span class="project-category">${categoryDisplay}</span>
                            <span class="project-year">${cleanYear}</span>
                        </div>
                        <h3 class="project-title">${cleanTitle}</h3>
                        <div class="project-role">${cleanRole}</div>
                        <div class="project-description">${cleanDetails}</div>
                        <div class="project-details">
                            ${project.collaboration ? `<div class="project-collaboration"><strong>Collaboration:</strong> ${project.collaboration}</div>` : ''}
                            ${project.technical ? `<div class="project-collaboration"><strong>Technical:</strong> ${project.technical}</div>` : ''}
                            ${project.location ? `<div class="project-collaboration"><strong>Location:</strong> ${project.location}</div>` : ''}
                            <div class="project-links">
                                ${project.link && project.link !== '' ? `<a href="${project.link}" target="_blank" class="project-link">View Project</a>` : ''}
                                ${project.video && project.video !== '' ? `<a href="${project.video}" target="_blank" class="project-link">Watch Video</a>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="expand-indicator">+</div>
                `;
                break;

            default: // 'default' with enhanced image handling
                cardHTML = `
                    <div class="project-image">
                        ${hasValidImage ? 
                            `<img src="${project.image_url}" alt="${cleanTitle}" loading="lazy">` :
                            `<div class="project-image-placeholder">${categoryIcon}</div>`
                        }
                        <div class="project-category-badge">${project.mappedCategory.replace('-', ' ')}</div>
                    </div>
                    <div class="project-content">
                        <div class="project-meta">
                            <span class="project-category">${categoryDisplay}</span>
                            <span class="project-year">${cleanYear}</span>
                        </div>
                        <h3 class="project-title">${cleanTitle}</h3>
                        <div class="project-role">${cleanRole}</div>
                        <div class="project-description">${cleanDetails}</div>
                        <div class="project-details">
                            ${project.collaboration ? `<div class="project-collaboration"><strong>Collaboration:</strong> ${project.collaboration}</div>` : ''}
                            ${project.technical ? `<div class="project-collaboration"><strong>Technical:</strong> ${project.technical}</div>` : ''}
                            ${project.location ? `<div class="project-collaboration"><strong>Location:</strong> ${project.location}</div>` : ''}
                            <div class="project-links">
                                ${project.link && project.link !== '' ? `<a href="${project.link}" target="_blank" class="project-link">View Project</a>` : ''}
                                ${project.video && project.video !== '' ? `<a href="${project.video}" target="_blank" class="project-link">Watch Video</a>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="expand-indicator">+</div>
                `;
        }

        card.innerHTML = cardHTML;

        // Add enhanced image loading logic
        if (CARD_STYLE === 'default') {
            const img = card.querySelector('img');
            if (img) {
                img.addEventListener('load', function() {
                    this.classList.add('loaded');
                    console.log(`🖼️ Image loaded for: ${cleanTitle}`);
                });
                
                img.addEventListener('error', function() {
                    console.warn(`⚠️ Image failed to load for: ${cleanTitle}`);
                    this.parentElement.innerHTML = `
                        <div class="project-image-placeholder">${categoryIcon}</div>
                        <div class="project-category-badge">${project.mappedCategory.replace('-', ' ')}</div>
                    `;
                });
            }
        }

        return card;
    }

    // Handle project card clicks for expansion
    handleProjectCardClick(e) {
        if (e.target.tagName === 'A') {
            console.log('🔗 Link clicked, not expanding card');
            return;
        }

        const card = e.target.closest('.project-card');
        if (card) {
            console.log('📋 === PROJECT CARD CLICK ===');
            console.log('🔍 Card found, toggling expanded state');
            card.classList.toggle('expanded');
            const isExpanded = card.classList.contains('expanded');
            console.log('📖 Card is now expanded:', isExpanded);
            
            // Update expand indicator
            const indicator = card.querySelector('.expand-indicator');
            if (indicator) {
                indicator.textContent = isExpanded ? '−' : '+';
            }
        } else {
            console.log('⚠️ No project card found in click target');
        }
    }

    // Get category icon
    getCategoryIcon(category) {
        const icons = {
            'sound-designer': '🎵',
            'music-producer': '🎹', 
            'film-mix': '🎬',
            'interactive-design': '🎮',
            'labs': '🧪'
        };
        return icons[category] || '🎵';
    }

    // Mobile menu functions
    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        
        if (sidebar && overlay) {
            this.mobileMenuOpen = !this.mobileMenuOpen;
            sidebar.classList.toggle('show-mobile');
            overlay.classList.toggle('show');
            console.log('📱 Mobile menu toggled:', this.mobileMenuOpen);
        }
    }

    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        
        if (sidebar && overlay) {
            this.mobileMenuOpen = false;
            sidebar.classList.remove('show-mobile');
            overlay.classList.remove('show');
            console.log('📱 Mobile menu closed');
        }
    }

    // Credentials modal functions
    openCredentialsModal(e) {
        e.preventDefault();
        const modal = document.getElementById('credentials-modal');
        if (modal) {
            modal.classList.add('show');
            console.log('🎓 Credentials modal opened');
        }
    }

    closeCredentialsModal() {
        const modal = document.getElementById('credentials-modal');
        if (modal) {
            modal.classList.remove('show');
            console.log('🎓 Credentials modal closed');
        }
    }

    // Setup smooth scrolling for anchor links
    setupSmoothScrolling() {
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && 
                e.target.getAttribute('href') && 
                e.target.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(e.target.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    }

    // Enhanced data stream animation for hero section
    startDataStream() {
        const streams = [
            'FREQ: 440Hz | AMP: 0.75 | PHASE: 0.33π',
            'CHANNELS: 8 | SAMPLE_RATE: 48000 | BIT_DEPTH: 24',
            'BUFFER_SIZE: 512 | LATENCY: 10.7ms | JITTER: <1ms',
            'EEG_ACTIVE | SPATIAL_AUDIO_7.1 | REAL_TIME_DSP',
            'MAX/MSP_RUNTIME | ABLETON_SYNC | MIDI_CLOCK_IN',
            'PROJECT_COUNT: ' + (window.dataManager?.getAllProjects()?.length || '...')
        ];
        
        let currentIndex = 0;
        
        const updateStream = () => {
            if (this.elements.dataStream) {
                this.elements.dataStream.textContent = streams[currentIndex];
                currentIndex = (currentIndex + 1) % streams.length;
            }
        };

        updateStream();
        const streamInterval = setInterval(updateStream, 2500);
        
        // Store interval for cleanup
        this.dataStreamInterval = streamInterval;
    }

    // Show/hide loading screen
    showLoading() {
        if (this.elements.loading) {
            this.elements.loading.classList.remove('hidden');
        }
        if (this.elements.mainContainer) {
            this.elements.mainContainer.classList.add('hidden');
        }
    }

    hideLoading() {
        console.log('👁️ hideLoading called from UI manager');
        const loading = document.getElementById('loading');
        const mainContainer = document.getElementById('main-container');
        
        if (loading) {
            loading.remove();
            console.log('✅ Loading element completely removed from DOM');
        }
        
        if (mainContainer) {
            mainContainer.classList.remove('hidden');
            mainContainer.style.display = 'block';
            console.log('✅ Main container shown');
        }
        
        // Clean up any remaining loading elements
        const allLoadingElements = document.querySelectorAll('#loading, .loading');
        allLoadingElements.forEach(el => el.remove());
        
        console.log('✅ All loading interference removed');
    }

    // Initialize UI with data
    initialize() {
        console.log('🎨 Initializing UI...');
        
        // Load and display all projects initially
        const allProjects = window.dataManager.getAllProjects();
        this.filteredProjects = allProjects;
        this.renderProjects(allProjects);

        // Start enhanced data stream animation
        this.startDataStream();

        // Mark as initialized
        this.initialized = true;
        console.log('✅ UI initialized successfully with', allProjects.length, 'projects');
    }

    // Cleanup method
    destroy() {
        if (this.dataStreamInterval) {
            clearInterval(this.dataStreamInterval);
        }
        console.log('🧹 UI Manager cleaned up');
    }
}

// Global UI manager instance
window.uiManager = new UIManager();
console.log('🎯 UIManager created and attached to window');