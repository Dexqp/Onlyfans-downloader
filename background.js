/**
 * OnlyFans Downloader - Background Script
 * Handles API interception and download management
 */

class OnlyFansBackgroundService {
  constructor() {
    this.apiDataCache = new Map();
    this.downloadQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Initialize the background service
   */
  initialize() {
    this.setupWebRequestListener();
    this.setupMessageListener();
    console.log('OnlyFans Background Service initialized');
  }

  /**
   * Setup web request listener to intercept API calls
   */
  setupWebRequestListener() {
    chrome.webRequest.onSendHeaders.addListener(
      (details) => {
        this.handleApiRequest(details);
      },
      {
        urls: [
          "*://*.onlyfans.com/api2/v2/users/*",
          "*://*.onlyfans.com/api2/v2/posts/*", 
          "*://*.onlyfans.com/api2/v2/chats/*",
          "*://*.onlyfans.com/*/"
        ]
      },
      ["requestHeaders"]
    );
  }

  /**
   * Handle API requests and extract relevant data
   */
  handleApiRequest(details) {
    try {
      // Skip if not a valid request
      if (details.tabId < 0 || details.url.includes('#trilobite')) {
        return;
      }

      // Check if this is a relevant API endpoint
      const isRelevantEndpoint = details.url.match(
        /(onlyfans\.com\/api2\/v2\/(users|posts|chats)|onlyfans\.com\/[0-9]+\/)/
      );
      
      if (!isRelevantEndpoint) {
        return;
      }

      // Extract headers (excluding security headers)
      const headers = this.extractHeaders(details.requestHeaders);
      
      // Send data to content script
      this.sendToContentScript(details.url, headers, details.tabId);
      
    } catch (error) {
      console.error('Error handling API request:', error);
    }
  }

  /**
   * Extract relevant headers from request
   */
  extractHeaders(requestHeaders) {
    const excludedHeaders = new Set([
      'Sec-Fetch-Site',
      'Sec-Fetch-Mode', 
      'Sec-Fetch-Dest',
      'Sec-Fetch-User',
      'DNT',
      'User-Agent'
    ]);

    const headers = {};
    
    for (const header of requestHeaders) {
      if (!excludedHeaders.has(header.name)) {
        headers[header.name] = header.value;
      }
    }
    
    return headers;
  }

  /**
   * Send API data to content script
   */
  async sendToContentScript(url, headers, tabId) {
    try {
      // Fetch the API data
      const response = await this.fetchApiData(url, headers);
      
      if (!response) return;
      
      // Parse and process the data
      const data = this.processApiResponse(response);
      
      if (!data) return;
      
      // Send to content script
      const message = {
        type: 'apiData',
        data: data,
        isForDm: url.includes('messages'),
        headers: headers
      };
      
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to send message to content script:', chrome.runtime.lastError);
        }
      });
      
    } catch (error) {
      console.error('Error sending data to content script:', error);
    }
  }

  /**
   * Fetch API data from OnlyFans
   */
  async fetchApiData(url, headers) {
    try {
      const response = await fetch(url + '#trilobite', {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error('Error fetching API data:', error);
      return null;
    }
  }

  /**
   * Process API response data
   */
  processApiResponse(data) {
    try {
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data.list) {
        return data.list;
      } else if (data.id && Array.isArray(data.media)) {
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Error processing API response:', error);
      return null;
    }
  }

  /**
   * Setup message listener for download requests
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        // Handle download requests
        if (Array.isArray(message) && message.length >= 3) {
          this.handleDownloadRequest(message);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Invalid message format' });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  }

  /**
   * Handle download request from content script
   */
  async handleDownloadRequest([url, creator, type]) {
    try {
      if (!url) {
        throw new Error('No URL provided');
      }

      // Get user settings
      const settings = await this.getUserSettings();
      
      // Generate filename
      const filename = this.generateFilename(url, creator, type, settings);
      
      // Add to download queue
      this.downloadQueue.push({
        url: url,
        filename: filename,
        creator: creator,
        type: type
      });
      
      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        this.processDownloadQueue();
      }
      
    } catch (error) {
      console.error('Error handling download request:', error);
    }
  }

  /**
   * Get user settings from storage
   */
  async getUserSettings() {
    try {
      const result = await chrome.storage.sync.get({
        quality: 'full',
        autoCreateFolder: true
      });
      return result;
    } catch (error) {
      console.error('Error loading user settings:', error);
      return { quality: 'full', autoCreateFolder: true };
    }
  }

  /**
   * Generate filename for download
   */
  generateFilename(url, creator, type, settings) {
    try {
      // Extract file extension from URL
      const urlParts = url.split('?')[0].split('/');
      const filename = urlParts[urlParts.length - 1];
      
      // Clean creator name
      const cleanCreator = creator.replace(/[^a-zA-Z0-9]/g, '_');
      
      // Create folder structure if enabled
      if (settings.autoCreateFolder) {
        return `${cleanCreator}/${filename}`;
      } else {
        return filename;
      }
      
    } catch (error) {
      console.error('Error generating filename:', error);
      return `download_${Date.now()}.file`;
    }
  }

  /**
   * Process download queue
   */
  async processDownloadQueue() {
    if (this.isProcessingQueue || this.downloadQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.downloadQueue.length > 0) {
        const download = this.downloadQueue.shift();
        await this.executeDownload(download);
        
        // Add small delay between downloads to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing download queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute individual download
   */
  async executeDownload(download) {
    try {
      const { url, filename, creator, type } = download;
      
      console.log(`Starting download: ${filename}`);
      
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: filename,
        conflictAction: 'uniquify',
        saveAs: false
      });
      
      if (downloadId) {
        console.log(`Download started successfully: ${filename}`);
      } else {
        throw new Error('Download failed to start');
      }
      
    } catch (error) {
      console.error(`Download failed for ${download.filename}:`, error);
      
      // Show notification to user
      this.showNotification('Download Failed', `Failed to download ${download.filename}`);
    }
  }

  /**
   * Show notification to user
   */
  showNotification(title, message) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon48.png',
        title: title,
        message: message
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.apiDataCache.clear();
    this.downloadQueue = [];
    this.isProcessingQueue = false;
  }
}

// Initialize the background service
const backgroundService = new OnlyFansBackgroundService();
backgroundService.initialize();

// Handle extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('OnlyFans Downloader installed');
});

chrome.runtime.onSuspend.addListener(() => {
  backgroundService.cleanup();
}); 