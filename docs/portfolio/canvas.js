class ParticleDataFlow {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.attractors = [];
        this.mouse = { x: 0, y: 0, active: false };
        this.time = 0;
        this.maxParticles = 100;
        this.spawnRate = 0.3;
        
        this.init();
    }

    init() {
        this.createCanvas();
        this.createParticles();
        this.updateAttractors();
        this.bindEvents();
        this.animate();
        
        console.log('✅ Particle Data Flow initialized');
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1';
        this.canvas.style.background = 'transparent';
        
        document.body.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.updateAttractors();
        });
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        
        // Adjust particle count for mobile
        this.maxParticles = window.innerWidth < 768 ? 50 : 100;
    }

    createParticles() {
        this.particles = [];
        
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle() {
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            ax: 0,
            ay: 0,
            size: 0.5 + Math.random() * 1.5, // Very small points
            mass: 1,
            maxSpeed: 4,
            opacity: 0.4 + Math.random() * 0.4,
            life: 1.0,
            decay: 0.001 + Math.random() * 0.002,
            color: '#000000'
        };
    }

    getParticleColor(type) {
        const colors = {
            'data': '#000000',
            'signal': '#333333', 
            'pulse': '#555555',
            'flow': '#222222'
        };
        return colors[type] || '#000000';
    }

    updateAttractors() {
        this.attractors = [];
        
        // Add project cards as attractors
        const cardElements = document.querySelectorAll('.project-card') || 
                           document.querySelectorAll('.card') ||
                           document.querySelectorAll('[data-category]');
        
        cardElements.forEach(card => {
            const rect = card.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const isHovered = card.matches(':hover');
                this.attractors.push({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    strength: isHovered ? 200 : 40, // Much stronger when hovered
                    radius: isHovered ? 300 : 150,
                    element: card,
                    category: card.dataset.category || 'default',
                    active: isHovered
                });
            }
        });
        
        // Add mouse as dynamic attractor
        this.attractors.push({
            x: this.mouse.x,
            y: this.mouse.y,
            strength: this.mouse.active ? 60 : 15,
            radius: 100,
            type: 'mouse',
            active: true
        });
    }

    applyForces(particle) {
        // Reset acceleration
        particle.ax = 0;
        particle.ay = 0;
        
        // Apply attractor forces
        this.attractors.forEach(attractor => {
            const dx = attractor.x - particle.x;
            const dy = attractor.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < attractor.radius && distance > 5) {
                // Calculate force strength - stronger attraction
                let force = (attractor.strength * particle.mass) / (distance * distance);
                force = Math.min(force, 2.0); // Higher force limit
                
                // Normalize direction
                const forceX = (dx / distance) * force;
                const forceY = (dy / distance) * force;
                
                particle.ax += forceX / particle.mass;
                particle.ay += forceY / particle.mass;
            }
        });
        
        // Reduce noise for clearer attraction
        particle.ax += (Math.random() - 0.5) * 0.02;
        particle.ay += (Math.random() - 0.5) * 0.02;
    }

    updateParticle(particle) {
        // Apply forces
        this.applyForces(particle);
        
        // Update velocity
        particle.vx += particle.ax;
        particle.vy += particle.ay;
        
        // Limit speed
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > particle.maxSpeed) {
            particle.vx = (particle.vx / speed) * particle.maxSpeed;
            particle.vy = (particle.vy / speed) * particle.maxSpeed;
        }
        
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = window.innerWidth;
        if (particle.x > window.innerWidth) particle.x = 0;
        if (particle.y < 0) particle.y = window.innerHeight;
        if (particle.y > window.innerHeight) particle.y = 0;
        
        // Update life
        particle.life -= particle.decay;
        if (particle.life <= 0) {
            return this.createParticle(); // Respawn
        }
        
        return particle;
    }

    drawParticle(particle) {
        const alpha = particle.opacity * particle.life;
        
        // Draw as small rectangle/point
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = particle.color;
        
        // Simple small rectangle
        this.ctx.fillRect(
            particle.x - particle.size/2, 
            particle.y - particle.size/2, 
            particle.size, 
            particle.size
        );
    }

    drawConnections() {
        // Draw subtle connections between nearby particles
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 0.2;
        
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 60) {
                    const alpha = (1 - distance / 60) * 0.05;
                    this.ctx.globalAlpha = alpha;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }
    }

    spawnParticles() {
        // Spawn new particles occasionally
        if (Math.random() < this.spawnRate && this.particles.length < this.maxParticles) {
            // Spawn from edges
            const edge = Math.floor(Math.random() * 4);
            let x, y;
            
            switch (edge) {
                case 0: // Top
                    x = Math.random() * window.innerWidth;
                    y = 0;
                    break;
                case 1: // Right
                    x = window.innerWidth;
                    y = Math.random() * window.innerHeight;
                    break;
                case 2: // Bottom
                    x = Math.random() * window.innerWidth;
                    y = window.innerHeight;
                    break;
                case 3: // Left
                    x = 0;
                    y = Math.random() * window.innerHeight;
                    break;
            }
            
            const particle = this.createParticle();
            particle.x = x;
            particle.y = y;
            this.particles.push(particle);
        }
    }

    bindEvents() {
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('mouseenter', () => {
            this.mouse.active = true;
        });
        
        document.addEventListener('mouseleave', () => {
            this.mouse.active = false;
        });
        
        // Update attractors when cards change
        setInterval(() => {
            this.updateAttractors();
        }, 2000);
    }

    animate() {
        this.time += 1;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        
        // Update attractors (includes checking card hover states)
        this.updateAttractors();
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i] = this.updateParticle(this.particles[i]);
        }
        
        // Draw connections between nearby particles
        this.drawConnections();
        
        // Draw particles
        this.particles.forEach(particle => {
            this.drawParticle(particle);
        });
        
        // Spawn new particles occasionally
        this.spawnParticles();
        
        // Reset global alpha
        this.ctx.globalAlpha = 1.0;
        
        // Continue animation
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.particleDataFlow = new ParticleDataFlow();
    }, 500);
});

// Debug functions
window.canvasDebug = {
    getParticleCount: () => window.particleDataFlow?.particles.length || 0,
    getAttractorCount: () => window.particleDataFlow?.attractors.length || 0,
    addParticles: (count = 10) => {
        if (window.particleDataFlow) {
            for (let i = 0; i < count; i++) {
                window.particleDataFlow.particles.push(window.particleDataFlow.createParticle());
            }
        }
    },
    clearParticles: () => {
        if (window.particleDataFlow) {
            window.particleDataFlow.particles = [];
        }
    },
    restart: () => {
        if (window.particleDataFlow?.canvas) {
            document.body.removeChild(window.particleDataFlow.canvas);
        }
        window.particleDataFlow = new ParticleDataFlow();
    },
    setMaxParticles: (count) => {
        if (window.particleDataFlow) {
            window.particleDataFlow.maxParticles = count;
        }
    }
};