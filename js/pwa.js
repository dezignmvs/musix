/**
 * PWA Controller
 * Service Worker Registration, Install Prompts, and Online/Offline Detection
 */

class PwaManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.installButtons = [];
    this._init();
  }

  _init() {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
            
            // Check for updates
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this._showUpdateToast();
                }
              });
            });
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // 2. Capture BeforeInstallPrompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable = true;
      this._updateInstallButtonsState(true);
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App successfully installed');
      this.deferredPrompt = null;
      this.isInstallable = false;
      this._updateInstallButtonsState(false);
      this._showToast('Musics Web App installed successfully!', 'success');
    });

    // 3. Online/Offline feedback
    window.addEventListener('online', () => {
      this._showToast('You are back online. Music streaming restored.', 'success');
      document.querySelectorAll('.provider-dot').forEach(el => el.classList.remove('offline'));
    });

    window.addEventListener('offline', () => {
      this._showToast('You are offline. Streaming is limited to cached/local audio.', 'warning');
      document.querySelectorAll('.provider-dot').forEach(el => el.classList.add('offline'));
    });
  }

  registerInstallButton(btn) {
    if (!btn) return;
    this.installButtons.push(btn);
    btn.addEventListener('click', () => this.promptInstall());
    btn.style.display = this.isInstallable ? 'inline-flex' : 'none';
  }

  _updateInstallButtonsState(visible) {
    this.installButtons.forEach(btn => {
      btn.style.display = visible ? 'inline-flex' : 'none';
    });
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      this._showToast('To install, open browser menu and tap "Add to Home screen" or "Install App".', 'info');
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    this.deferredPrompt = null;
    this.isInstallable = false;
    this._updateInstallButtonsState(false);
  }

  _showToast(msg, type = 'info') {
    window.showAppToast && window.showAppToast(msg, type);
  }

  _showUpdateToast() {
    window.showAppToast && window.showAppToast('New version available! Reload to update.', 'info');
  }
}

export const pwa = new PwaManager();
