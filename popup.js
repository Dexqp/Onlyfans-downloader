/**
 * OnlyFans Downloader - Popup Script
 * Handles popup UI and settings management
 */

class PopupManager {
  constructor() {
    this.settings = {
      quality: 'full',
      autoCreateFolder: true
    };
  }

  /**
   * Initialize the popup
   */
  async initialize() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.updateUI();
      console.log('Popup initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        quality: 'full',
        autoCreateFolder: true
      });
      this.settings = result;
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    // Quality selection
    const qualityInputs = document.querySelectorAll('input[name="segmented"]');
    qualityInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        this.handleQualityChange(e.target.value);
      });
    });

    // Folder organization checkbox
    const folderCheckbox = document.getElementById('folder');
    if (folderCheckbox) {
      folderCheckbox.addEventListener('change', (e) => {
        this.handleFolderChange(e.target.checked);
      });
    }
  }

  /**
   * Update UI to reflect current settings
   */
  updateUI() {
    // Update quality selection
    const qualityInput = document.getElementById(this.settings.quality);
    if (qualityInput) {
      qualityInput.checked = true;
      this.updateQualityUI(qualityInput);
    }

    // Update folder checkbox
    const folderCheckbox = document.getElementById('folder');
    if (folderCheckbox) {
      folderCheckbox.checked = this.settings.autoCreateFolder;
    }
  }

  /**
   * Handle quality setting change
   */
  async handleQualityChange(quality) {
    try {
      this.settings.quality = quality;
      await this.saveSettings();
      this.updateQualityUI(document.getElementById(quality));
      this.showStatus('Quality preference saved. Page refresh needed to take effect.');
    } catch (error) {
      console.error('Error saving quality setting:', error);
      this.showStatus('Failed to save quality setting.', 'error');
    }
  }

  /**
   * Handle folder organization setting change
   */
  async handleFolderChange(enabled) {
    try {
      this.settings.autoCreateFolder = enabled;
      await this.saveSettings();
      this.showStatus('Folder organization preference saved.');
    } catch (error) {
      console.error('Error saving folder setting:', error);
      this.showStatus('Failed to save folder setting.', 'error');
    }
  }

  /**
   * Update quality selection UI
   */
  updateQualityUI(selectedInput) {
    // Remove checked class from all labels
    const allLabels = document.querySelectorAll('.segmented label');
    allLabels.forEach(label => {
      label.classList.remove('checked');
    });

    // Add checked class to selected label
    if (selectedInput && selectedInput.parentElement) {
      selectedInput.parentElement.classList.add('checked');
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      await chrome.storage.sync.set(this.settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Show status message to user
   */
  showStatus(message, type = 'success') {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status ${type}`;
      
      // Clear message after 3 seconds
      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
      }, 3000);
    }
  }

  /**
   * Show folder status message
   */
  showFolderStatus(message, type = 'success') {
    const statusElement = document.getElementById('status-folder');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status ${type}`;
      
      // Clear message after 3 seconds
      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
      }, 3000);
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupManager();
  popupManager.initialize();
});