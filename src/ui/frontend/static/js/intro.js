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
        initWindowControls();
    });
} else {
    new IntroScreen();
    initWindowControls();
}

// Window Controls (Electron only)
function initWindowControls() {
    // Check for Electron API - try multiple methods
    const isElectron = window.electronAPI || 
                      (window.process && window.process.versions && window.process.versions.electron) ||
                      (navigator.userAgent && navigator.userAgent.includes('Electron'));
    
    console.log('[Window Controls] Electron detection:', {
        hasElectronAPI: !!window.electronAPI,
        hasProcess: !!(window.process && window.process.versions && window.process.versions.electron),
        userAgent: navigator.userAgent.includes('Electron'),
        isElectron: isElectron
    });
    
    if (isElectron || window.electronAPI) {
        // Add electron-app class to body for CSS
        document.body.classList.add('electron-app');
        
        // Ensure window controls are visible with inline styles (highest priority)
        const windowControls = document.getElementById('window-controls');
        if (windowControls) {
            windowControls.style.setProperty('display', 'flex', 'important');
            windowControls.style.setProperty('visibility', 'visible', 'important');
            windowControls.style.setProperty('opacity', '1', 'important');
            windowControls.style.setProperty('z-index', '1001', 'important');
            windowControls.style.setProperty('pointer-events', 'auto', 'important');
        }
        
        // Verify electronAPI methods exist
        if (!window.electronAPI) {
            console.error('[Window Controls] window.electronAPI is not available!');
            return;
        }
        
        console.log('[Window Controls] Available methods:', {
            windowMinimize: typeof window.electronAPI.windowMinimize,
            windowMaximize: typeof window.electronAPI.windowMaximize,
            windowRestore: typeof window.electronAPI.windowRestore,
            windowClose: typeof window.electronAPI.windowClose,
            windowIsMaximized: typeof window.electronAPI.windowIsMaximized,
            windowSetFullscreen: typeof window.electronAPI.windowSetFullscreen,
            windowIsFullscreen: typeof window.electronAPI.windowIsFullscreen
        });
        
        // Minimize button
        const minimizeBtn = document.getElementById('window-minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Window Controls] Minimize button clicked');
                try {
                    if (!window.electronAPI || !window.electronAPI.windowMinimize) {
                        console.error('[Window Controls] windowMinimize method not available');
                        return;
                    }
                    const result = await window.electronAPI.windowMinimize();
                    console.log('[Window Controls] Minimize result:', result);
                } catch (error) {
                    console.error('[Window Controls] Failed to minimize window:', error);
                }
            });
            console.log('[Window Controls] Minimize button listener attached');
        } else {
            console.error('[Window Controls] Minimize button not found!');
        }
        
        // Maximize/Restore button
        const maximizeBtn = document.getElementById('window-maximize');
        const restoreBtn = document.getElementById('window-restore');
        
        const updateMaximizeButton = async () => {
            try {
                if (!window.electronAPI || !window.electronAPI.windowIsMaximized) {
                    console.warn('[Window Controls] windowIsMaximized method not available');
                    return;
                }
                const result = await window.electronAPI.windowIsMaximized();
                const maximized = result?.maximized || result === true;
                console.log('[Window Controls] Window maximized state:', maximized);
                if (maximized) {
                    maximizeBtn?.style.setProperty('display', 'none', 'important');
                    restoreBtn?.style.setProperty('display', 'flex', 'important');
                } else {
                    maximizeBtn?.style.setProperty('display', 'flex', 'important');
                    restoreBtn?.style.setProperty('display', 'none', 'important');
                }
            } catch (error) {
                console.error('[Window Controls] Failed to check window state:', error);
            }
        };
        
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Window Controls] Maximize button clicked');
                try {
                    if (!window.electronAPI || !window.electronAPI.windowMaximize) {
                        console.error('[Window Controls] windowMaximize method not available');
                        return;
                    }
                    const result = await window.electronAPI.windowMaximize();
                    console.log('[Window Controls] Maximize result:', result);
                    await updateMaximizeButton();
                } catch (error) {
                    console.error('[Window Controls] Failed to maximize window:', error);
                }
            });
            console.log('[Window Controls] Maximize button listener attached');
        } else {
            console.error('[Window Controls] Maximize button not found!');
        }
        
        if (restoreBtn) {
            restoreBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Window Controls] Restore button clicked');
                try {
                    if (!window.electronAPI || !window.electronAPI.windowRestore) {
                        console.error('[Window Controls] windowRestore method not available');
                        return;
                    }
                    const result = await window.electronAPI.windowRestore();
                    console.log('[Window Controls] Restore result:', result);
                    await updateMaximizeButton();
                } catch (error) {
                    console.error('[Window Controls] Failed to restore window:', error);
                }
            });
            console.log('[Window Controls] Restore button listener attached');
        } else {
            console.error('[Window Controls] Restore button not found!');
        }
        
        // Check initial state
        updateMaximizeButton();
        
        // Update on window resize
        window.addEventListener('resize', () => {
            setTimeout(updateMaximizeButton, 100);
        });
        
        // Fullscreen button
        const fullscreenBtn = document.getElementById('window-fullscreen');
        if (fullscreenBtn) {
            const updateFullscreenButton = async () => {
                try {
                    if (!window.electronAPI || !window.electronAPI.windowIsFullscreen) {
                        console.warn('[Window Controls] windowIsFullscreen method not available');
                        return;
                    }
                    const result = await window.electronAPI.windowIsFullscreen();
                    const fullscreen = result?.fullscreen || result === true;
                    console.log('[Window Controls] Window fullscreen state:', fullscreen);
                    if (fullscreen) {
                        fullscreenBtn.classList.add('active');
                        const fullscreenIcon = fullscreenBtn.querySelector('.fullscreen-icon');
                        const fullscreenExitIcon = fullscreenBtn.querySelector('.fullscreen-exit-icon');
                        if (fullscreenIcon) fullscreenIcon.style.setProperty('display', 'none', 'important');
                        if (fullscreenExitIcon) fullscreenExitIcon.style.setProperty('display', 'block', 'important');
                    } else {
                        fullscreenBtn.classList.remove('active');
                        const fullscreenIcon = fullscreenBtn.querySelector('.fullscreen-icon');
                        const fullscreenExitIcon = fullscreenBtn.querySelector('.fullscreen-exit-icon');
                        if (fullscreenIcon) fullscreenIcon.style.setProperty('display', 'block', 'important');
                        if (fullscreenExitIcon) fullscreenExitIcon.style.setProperty('display', 'none', 'important');
                    }
                } catch (error) {
                    console.error('[Window Controls] Failed to check fullscreen state:', error);
                }
            };
            
            fullscreenBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Window Controls] Fullscreen button clicked');
                try {
                    if (!window.electronAPI || !window.electronAPI.windowIsFullscreen) {
                        console.error('[Window Controls] windowIsFullscreen method not available');
                        return;
                    }
                    const result = await window.electronAPI.windowIsFullscreen();
                    const fullscreen = result?.fullscreen || result === true;
                    console.log('[Window Controls] Current fullscreen state:', fullscreen, 'toggling to:', !fullscreen);
                    const toggleResult = await window.electronAPI.windowSetFullscreen(!fullscreen);
                    console.log('[Window Controls] Toggle fullscreen result:', toggleResult);
                    await updateFullscreenButton();
                } catch (error) {
                    console.error('[Window Controls] Failed to toggle fullscreen:', error);
                }
            });
            console.log('[Window Controls] Fullscreen button listener attached');
            
            // Check initial state
            updateFullscreenButton();
        } else {
            console.error('[Window Controls] Fullscreen button not found!');
        }
        
        // Close button
        const closeBtn = document.getElementById('window-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Window Controls] Close button clicked');
                try {
                    if (!window.electronAPI || !window.electronAPI.windowClose) {
                        console.error('[Window Controls] windowClose method not available');
                        return;
                    }
                    const result = await window.electronAPI.windowClose();
                    console.log('[Window Controls] Close result:', result);
                } catch (error) {
                    console.error('[Window Controls] Failed to close window:', error);
                }
            });
            console.log('[Window Controls] Close button listener attached');
        } else {
            console.error('[Window Controls] Close button not found!');
        }
        
        console.log('[Window Controls] Initialization complete');
    } else {
        // Not Electron - hide window controls
        const windowControls = document.getElementById('window-controls');
        if (windowControls) {
            windowControls.style.display = 'none';
        }
    }
}

// Export for Electron IPC
if (typeof window !== 'undefined') {
    window.introScreen = IntroScreen;
}
