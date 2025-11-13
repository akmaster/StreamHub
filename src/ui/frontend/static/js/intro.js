/**
 * Ultra Modern Intro Screen JavaScript - Carousel Style
 * Handles slide navigation, progress tracking, and transitions
 */

class IntroScreen {
    constructor() {
        this.currentSlide = 0;
        this.totalSlides = 0;
        this.slides = [];
        this.skipped = false;
        this.isTransitioning = false;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.minSwipeDistance = 50;
        
        this.init();
    }

    init() {
        // Get all slides
        this.slides = Array.from(document.querySelectorAll('.intro-slide'));
        this.totalSlides = this.slides.length;
        
        // Initialize all slides as hidden (except first)
        this.slides.forEach((slide, index) => {
            if (index === 0) {
                slide.classList.add('active');
                slide.classList.remove('prev', 'next');
            } else {
                slide.classList.remove('active');
                slide.classList.add('next');
            }
        });
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup progress dots
        this.setupProgressDots();
        
        // Show first slide (already active, but ensure it's displayed)
        this.currentSlide = 0;
        this.updateProgressDots();
        
        // Setup keyboard navigation
        this.setupKeyboardNavigation();
        
        // Setup touch/swipe navigation
        this.setupTouchNavigation();
    }

    setupEventListeners() {
        // Next button
        const nextButton = document.getElementById('nav-next');
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                this.nextSlide();
            });
        }

        // Previous button
        const prevButton = document.getElementById('nav-prev');
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                this.prevSlide();
            });
        }

        // Skip button
        const skipButton = document.getElementById('nav-skip');
        if (skipButton) {
            skipButton.addEventListener('click', () => {
                this.skipIntro();
            });
        }

        // Get started button
        const getStartedButton = document.getElementById('get-started-button');
        if (getStartedButton) {
            getStartedButton.addEventListener('click', () => {
                this.completeIntro();
            });
        }
    }

    setupProgressDots() {
        const progressDots = document.getElementById('progress-dots');
        if (!progressDots) return;

        // Create progress dots
        for (let i = 0; i < this.totalSlides; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            dot.setAttribute('data-slide', i);
            dot.addEventListener('click', () => {
                if (!this.isTransitioning) {
                    this.goToSlide(i);
                }
            });
            progressDots.appendChild(dot);
        }

        // Update progress dots
        this.updateProgressDots();
    }

    updateProgressDots() {
        const dots = document.querySelectorAll('.progress-dot');
        dots.forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            if (index < this.currentSlide) {
                dot.classList.add('completed');
            } else if (index === this.currentSlide) {
                dot.classList.add('active');
            }
        });

        // Update navigation buttons
        this.updateNavigationButtons();
    }

    updateNavigationButtons() {
        const nextButton = document.getElementById('nav-next');
        const prevButton = document.getElementById('nav-prev');
        const skipButton = document.getElementById('nav-skip');

        // Show/hide previous button
        if (prevButton) {
            if (this.currentSlide === 0) {
                prevButton.style.display = 'none';
            } else {
                prevButton.style.display = 'flex';
            }
        }

        // Update next button text
        if (nextButton) {
            if (this.currentSlide === this.totalSlides - 1) {
                nextButton.style.display = 'none';
            } else {
                nextButton.style.display = 'flex';
            }
        }

        // Hide skip button on last slide
        if (skipButton) {
            if (this.currentSlide === this.totalSlides - 1) {
                skipButton.style.display = 'none';
            } else {
                skipButton.style.display = 'inline-flex';
            }
        }
    }

    showSlide(index) {
        if (this.isTransitioning || index < 0 || index >= this.totalSlides) {
            return;
        }

        // If same slide, do nothing
        if (index === this.currentSlide) {
            return;
        }

        this.isTransitioning = true;

        // Remove all state classes from all slides
        this.slides.forEach((slide) => {
            slide.classList.remove('active', 'prev', 'next');
            // Remove inline display styles if any
            slide.style.display = '';
        });

        // Add appropriate classes based on position relative to target slide
        this.slides.forEach((slide, i) => {
            if (i < index) {
                // Slides before target - mark as previous (hidden on left)
                slide.classList.add('prev');
            } else if (i > index) {
                // Slides after target - mark as next (hidden on right)
                slide.classList.add('next');
            }
            // Target slide (i === index) will get 'active' class next
        });

        // Force a reflow to ensure previous/next classes are applied
        void this.slides[0].offsetHeight;

        // Activate the target slide in next animation frame for smooth transition
        requestAnimationFrame(() => {
            this.slides[index].classList.remove('next', 'prev');
            this.slides[index].classList.add('active');
            
            // Update current slide index
            this.currentSlide = index;
            
            // Update progress dots and navigation buttons
            this.updateProgressDots();
        });

        // Reset transition flag after animation completes
        setTimeout(() => {
            this.isTransitioning = false;
        }, 650); // Match CSS transition duration (600ms) + small buffer
    }

    nextSlide() {
        if (this.currentSlide < this.totalSlides - 1) {
            this.showSlide(this.currentSlide + 1);
        } else {
            // Last slide - complete intro
            this.completeIntro();
        }
    }

    prevSlide() {
        if (this.currentSlide > 0) {
            this.showSlide(this.currentSlide - 1);
        }
    }

    goToSlide(index) {
        if (index >= 0 && index < this.totalSlides) {
            this.showSlide(index);
        }
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (this.isTransitioning) return;

            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                    e.preventDefault();
                    this.nextSlide();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.prevSlide();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.skipIntro();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.goToSlide(0);
                    break;
                case 'End':
                    e.preventDefault();
                    this.goToSlide(this.totalSlides - 1);
                    break;
            }
        });
    }

    setupTouchNavigation() {
        const container = document.getElementById('intro-container');
        if (!container) return;

        container.addEventListener('touchstart', (e) => {
            this.touchStartX = e.touches[0].clientX;
        });

        container.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].clientX;
            this.handleSwipe();
        });
    }

    handleSwipe() {
        const swipeDistance = this.touchStartX - this.touchEndX;

        if (Math.abs(swipeDistance) > this.minSwipeDistance) {
            if (swipeDistance > 0) {
                // Swipe left - next slide
                this.nextSlide();
            } else {
                // Swipe right - previous slide
                this.prevSlide();
            }
        }
    }

    skipIntro() {
        if (this.skipped) return;
        
        this.skipped = true;
        
        // Fade out animation
        const container = document.getElementById('intro-container');
        if (container) {
            container.style.animation = 'fadeOut 0.5s ease-out forwards';
        }

        // Navigate to main app after fade out
        setTimeout(() => {
            this.navigateToMainApp();
        }, 500);
    }

    completeIntro() {
        if (this.skipped) return;
        
        this.skipped = true;
        
        // Fade out animation
        const container = document.getElementById('intro-container');
        if (container) {
            container.style.animation = 'fadeOut 0.5s ease-out forwards';
        }

        // Navigate to main app after fade out
        setTimeout(() => {
            this.navigateToMainApp();
        }, 500);
    }

    navigateToMainApp() {
        // Check if running in Electron
        if (typeof window !== 'undefined' && window.electronAPI) {
            // Electron: Use IPC to notify main process
            if (window.electronAPI.introComplete) {
                window.electronAPI.introComplete().then(() => {
                    // IPC call successful, main process will handle window transition
                }).catch((error) => {
                    console.error('Error notifying intro completion:', error);
                    // Fallback: Redirect to main app
                    window.location.href = '/';
                });
            } else {
                // Fallback: Redirect to main app
                window.location.href = '/';
            }
        } else {
            // Browser: Redirect to main app
            window.location.href = '/';
        }
    }
}

// Initialize intro screen when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new IntroScreen();
    });
} else {
    new IntroScreen();
}

// Export for Electron IPC
if (typeof window !== 'undefined') {
    window.introScreen = IntroScreen;
}
