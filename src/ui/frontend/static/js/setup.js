/**
 * Modern Setup Screen JavaScript
 * Handles setup progress and automatic redirect
 */

class SetupScreen {
  constructor() {
    this.currentStep = 0;
    this.totalSteps = 4;
    this.progress = 0;
    this.setupComplete = false;
    this.checkInterval = null;
    
    this.init();
  }

  init() {
    this.updateProgress(0);
    this.startSetupCheck();
  }

  startSetupCheck() {
    // Check server status every 500ms
    this.checkInterval = setInterval(() => {
      this.checkServerStatus();
    }, 500);
  }

  async checkServerStatus() {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          this.completeSetup();
        }
      }
    } catch (error) {
      // Server not ready yet, continue checking
      this.updateProgressFromSteps();
    }
  }

  updateProgressFromSteps() {
    // Simulate progress based on time (fallback)
    if (this.progress < 90) {
      this.progress += 0.5;
      this.updateProgress(this.progress);
    }
  }

  updateProgress(percentage) {
    this.progress = Math.min(100, Math.max(0, percentage));
    
    const progressFill = document.getElementById('setup-progress-fill');
    const progressText = document.getElementById('setup-progress-text');
    
    if (progressFill) {
      progressFill.style.width = `${this.progress}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${Math.round(this.progress)}%`;
    }

    // Update steps based on progress
    this.updateSteps();
  }

  updateSteps() {
    const stepPercentage = 100 / this.totalSteps;
    
    for (let i = 1; i <= this.totalSteps; i++) {
      const step = document.querySelector(`[data-step="${i}"]`);
      const statusEl = document.getElementById(`step-${i}-status`);
      
      if (!step) continue;

      const stepProgress = (i - 1) * stepPercentage;
      const currentProgress = this.progress;

      if (currentProgress >= stepProgress + stepPercentage) {
        // Step completed
        step.classList.remove('active');
        step.classList.add('completed');
        if (statusEl) {
          statusEl.textContent = 'Tamamlandı';
        }
      } else if (currentProgress >= stepProgress) {
        // Step active
        step.classList.add('active');
        step.classList.remove('completed');
        if (statusEl) {
          if (i === 1) statusEl.textContent = 'Oluşturuluyor...';
          else if (i === 2) statusEl.textContent = 'Hazırlanıyor...';
          else if (i === 3) statusEl.textContent = 'Kontrol ediliyor...';
          else if (i === 4) statusEl.textContent = 'Başlatılıyor...';
        }
      } else {
        // Step pending
        step.classList.remove('active', 'completed');
        if (statusEl) {
          statusEl.textContent = 'Bekleniyor...';
        }
      }
    }
  }

  completeSetup() {
    if (this.setupComplete) return;
    this.setupComplete = true;

    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Update to 100%
    this.updateProgress(100);
    
    // Update title and description
    const title = document.getElementById('setup-title');
    const description = document.getElementById('setup-description');
    const loading = document.getElementById('setup-loading');
    
    if (title) {
      title.textContent = 'Kurulum Tamamlandı!';
    }
    
    if (description) {
      description.textContent = 'Uygulama başlatılıyor...';
    }
    
    if (loading) {
      loading.style.display = 'none';
    }

    // Mark all steps as completed
    for (let i = 1; i <= this.totalSteps; i++) {
      const step = document.querySelector(`[data-step="${i}"]`);
      const statusEl = document.getElementById(`step-${i}-status`);
      
      if (step) {
        step.classList.remove('active');
        step.classList.add('completed');
      }
      
      if (statusEl) {
        statusEl.textContent = 'Tamamlandı';
      }
    }

    // Wait a moment then redirect
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }
}

// Initialize setup screen when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SetupScreen();
  });
} else {
  new SetupScreen();
}

