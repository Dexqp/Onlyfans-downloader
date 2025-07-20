/**
 * OnlyFans Downloader - Content Script
 * Modern, well-structured content script for OnlyFans media downloading
 */

class OnlyFansDownloader {
  constructor() {
    this.mediaStore = new Map();
    this.videoStore = new Map();
    this.imageStore = new Map();
    this.settings = {
      quality: 'full',
      autoCreateFolder: true
    };
    this.uniqueClass = this.generateUniqueClass();
    this.observer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the downloader
   */
  async initialize() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.setupVideoLoadHandler();
      this.startObserving();
      
      // Setup MutationObserver for dynamic content
      this.setupMutationObserver();
      
      // Setup infinite scroll and lazy loading handlers
      this.setupInfiniteScrollHandling();
      this.setupIntersectionObserver();
      
      // Wait for the SPA to load actual content
      this.waitForContent();
      
      // Setup dynamic button updating for multi-media posts
      this.setupDynamicButtonUpdating();
      this.setupMultiMediaPostHandling();
      this.setupImageCarouselHandling();
      this.setupSwipeHandling();
      this.setupDirectImageClickHandling();
      this.setupThumbnailNavigationHandling();
      
      this.isInitialized = true;
      console.log('OnlyFans Downloader initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OnlyFans Downloader:', error);
    }
  }

  /**
   * Wait for OnlyFans SPA content to load
   */
  waitForContent() {
    console.log('⏳ Waiting for OnlyFans content to load...');
    
    // Check if we're on a content page
    const checkForContent = () => {
      // Look for OnlyFans content indicators
      const hasPosts = document.querySelectorAll('.b-post').length > 0;
      const hasMessages = document.querySelectorAll('.b-chat__message').length > 0;
      const hasVideos = document.querySelectorAll('video').length > 0;
      const hasImages = document.querySelectorAll('img.b-post__media__img').length > 0;
      
      if (hasPosts || hasMessages || hasVideos || hasImages) {
        console.log('✅ OnlyFans content detected, starting downloader...');
        this.injectDownloadButtons();
        this.setupPhotoSwipeHandler();
        this.createFloatingDownloadButton();
        
        // Setup multi-media post handling
        this.setupMultiMediaPostHandling();
        this.setupImageCarouselHandling();
        this.setupSwipeHandling();
        this.setupDirectImageClickHandling();
        this.setupThumbnailNavigationHandling();
        
        return true;
      }
      
      return false;
    };
    
    // Try immediately
    if (checkForContent()) {
      return;
    }
    
    // If not found, wait and retry
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    const retry = () => {
      attempts++;
      console.log(`⏳ Content check attempt ${attempts}/${maxAttempts}...`);
      
      if (checkForContent()) {
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(retry, 1000);
      } else {
        console.log('⚠️ Content not detected after 30 seconds, but continuing...');
        // Still try to inject buttons in case content loads later
        this.injectDownloadButtons();
        this.setupPhotoSwipeHandler();
        this.createFloatingDownloadButton();
        
        // Setup multi-media post handling
        this.setupMultiMediaPostHandling();
        this.setupImageCarouselHandling();
        this.setupSwipeHandling();
        this.setupDirectImageClickHandling();
        this.setupThumbnailNavigationHandling();
      }
    };
    
    setTimeout(retry, 2000); // Start checking after 2 seconds
  }

  /**
   * Load user settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        quality: 'full',
        autoCreateFolder: true
      });
      this.settings = result;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Generate unique CSS class for download buttons
   */
  generateUniqueClass() {
    return `of-downloader-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Setup message listener for API data
   */
  setupEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'apiData') {
        this.processApiData(message.data, message.isForDm);
      }
      sendResponse({ received: true });
    });

    // Listen for route changes in the SPA
    this.setupRouteChangeDetection();
  }

  /**
   * Setup route change detection for OnlyFans SPA
   */
  setupRouteChangeDetection() {
    // Listen for URL changes
    let currentUrl = window.location.href;
    
    const checkForRouteChange = () => {
      if (window.location.href !== currentUrl) {
        console.log('🔄 Route changed, reinitializing downloader...');
        currentUrl = window.location.href;
        
        // Cleanup existing observers
        this.cleanupObservers();
        
        // Clear existing buttons
        const existingButtons = document.querySelectorAll(`.${this.uniqueClass}`);
        existingButtons.forEach(btn => btn.remove());
        
        // Remove floating button
        const floatingButton = document.querySelector('#of-downloader-floating-btn');
        if (floatingButton) {
          floatingButton.remove();
        }
        
        // Wait a bit then reinitialize
        setTimeout(() => {
          this.setupMutationObserver();
          this.waitForContent();
        }, 1000);
      }
    };
    
    // Check for route changes every second
    setInterval(checkForRouteChange, 1000);
    
    // Also listen for popstate events
    window.addEventListener('popstate', () => {
      console.log('🔄 Browser navigation detected...');
      
      // Cleanup existing observers
      this.cleanupObservers();
      
      setTimeout(() => {
        this.setupMutationObserver();
        this.waitForContent();
      }, 1000);
    });
  }

  /**
   * Setup popup event listeners (called from popup.js)
   */
  setupPopupEventListeners() {
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
   * Process API data and store media URLs
   */
  processApiData(data, isForDm) {
    try {
      const store = isForDm ? this.videoStore : this.mediaStore;
      
      if (Array.isArray(data)) {
        data.forEach(item => this.processMediaItem(item, store));
      } else if (data.id && Array.isArray(data.media)) {
        this.processMediaItem(data, store);
      }
    } catch (error) {
      console.error('Error processing API data:', error);
    }
  }

  /**
   * Process individual media item
   */
  processMediaItem(item, store) {
    if (item.id) {
      store.set(item.id, item);
    }

    if (Array.isArray(item.media)) {
      item.media.forEach(media => {
        if (media.type === 'video') {
          this.processVideoMedia(media);
        } else {
          this.processImageMedia(media);
        }
      });
    }
  }

  /**
   * Process video media and store quality options
   */
  processVideoMedia(media) {
    const videoMap = {};
    
    if (media.source?.source) {
      videoMap.full = media.source.source;
    }
    
    if (media.videoSources) {
      if (media.videoSources[240]) videoMap[240] = media.videoSources[240];
      if (media.videoSources[720]) videoMap[720] = media.videoSources[720];
    }

    // Store video URLs by preview images
    const previews = [media.preview, media.squarePreview, media.thumb].filter(Boolean);
    previews.forEach(preview => {
      if (preview) {
        this.imageStore.set(this.cleanUrl(preview), videoMap);
      }
    });
  }

  /**
   * Process image media
   */
  processImageMedia(media) {
    const previews = [media.preview, media.squarePreview, media.thumb].filter(Boolean);
    previews.forEach(preview => {
      if (preview && media.src) {
        this.imageStore.set(this.cleanUrl(preview), media.src);
      }
    });
  }

  /**
   * Clean URL by removing query parameters
   */
  cleanUrl(url) {
    return url ? url.split('?')[0] : url;
  }

  /**
   * Start observing DOM changes
   */
  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      let hasNewContent = false;
      
      mutations.forEach((mutation) => {
        // Check for new nodes being added
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is OnlyFans content
              if (node.classList?.contains('b-post') || 
                  node.classList?.contains('b-chat__message') ||
                  node.querySelector?.('.b-post') ||
                  node.querySelector?.('.b-chat__message') ||
                  node.querySelector?.('video') ||
                  node.querySelector?.('img.b-post__media__img')) {
                hasNewContent = true;
                console.log('🆕 New OnlyFans content detected:', node);
              }
            }
          });
        }
        
        // Check for attribute changes that might indicate content loading
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const targetElement = mutation.target;
          if (targetElement.classList?.contains('b-post') || 
              targetElement.classList?.contains('b-chat__message') ||
              targetElement.classList?.contains('video-wrapper')) {
            shouldUpdate = true;
          }
        }
      });

      // If we detected new content, inject buttons immediately
      if (hasNewContent) {
        console.log('🚀 New content detected, injecting download buttons...');
        this.injectDownloadButtons();
        this.setupPhotoSwipeHandler();
      } else if (shouldUpdate) {
        this.debounce(this.injectDownloadButtons.bind(this), 500)();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  /**
   * Debounce function to prevent excessive calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Inject download buttons into posts
   */
  injectDownloadButtons() {
    // Handle feed posts
    this.handleFeedPosts();
    
    // Handle chat messages
    this.handleChatMessages();
    
    // Handle video players
    this.handleVideoPlayers();
  }

  /**
   * Handle feed posts
   */
  handleFeedPosts() {
    const posts = document.querySelectorAll('.b-post');
    
    posts.forEach(post => {
      if (post.querySelector(`.${this.uniqueClass}`)) return;
      
      const mediaToDownload = this.extractMediaFromPost(post);
      
      if (mediaToDownload.length > 0) {
        const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
        const toolsContainer = post.querySelector('.b-post__tools');
        
        if (toolsContainer) {
          toolsContainer.appendChild(buttonContainer);
        }
      }
    });
  }

  /**
   * Handle chat messages
   */
  handleChatMessages() {
    const messages = document.querySelectorAll('.b-chat__message');
    
    messages.forEach(message => {
      if (message.querySelector(`.${this.uniqueClass}`)) return;
      
      const mediaToDownload = this.extractMediaFromMessage(message);
      
      if (mediaToDownload.length > 0) {
        const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
        const bodyContainer = message.querySelector('.b-chat__message__body');
        
        if (bodyContainer) {
          bodyContainer.appendChild(buttonContainer);
        }
      }
    });
  }

  /**
   * Enhanced video player detection based on OnlyFans HTML structure
   */
  handleVideoPlayers() {
    console.log('🎬 Enhanced video player detection starting...');
    
    // Method 1: Handle traditional video wrappers
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    this.processVideoWrappers(videoWrappers);
    
    // Method 2: Handle OnlyFans-specific video players with dimension classes
    const dimensionVideoPlayers = document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]');
    this.processDimensionVideoPlayers(dimensionVideoPlayers);
    
    // Method 3: Handle video.js players
    const videoJsPlayers = document.querySelectorAll('.video-js, .vjs-fluid');
    this.processVideoJsPlayers(videoJsPlayers);
    
    // Method 4: Handle standalone video elements
    const standaloneVideos = document.querySelectorAll('video:not(.video-wrapper video):not(.video-js video)');
    this.processStandaloneVideos(standaloneVideos);
    
    // Method 5: Handle any video elements with specific data attributes
    const dataAttributeVideos = document.querySelectorAll('video[data-src], video[data-video], video[data-url]');
    this.processDataAttributeVideos(dataAttributeVideos);
  }

  /**
   * Process traditional video wrappers
   */
  processVideoWrappers(videoWrappers) {
    console.log(`📦 Processing ${videoWrappers.length} video wrappers`);
    
    videoWrappers.forEach(wrapper => {
      const videoUrl = this.extractVideoUrl(wrapper, wrapper.closest('.b-post'));
      if (!videoUrl) {
        console.log('⚠️ No video URL found for wrapper, will retry later');
        setTimeout(() => {
          this.retryVideoExtraction(wrapper);
        }, 2000);
        return;
      }
      
      this.createVideoDownloadButton(wrapper, videoUrl);
    });
  }

  /**
   * Process OnlyFans dimension-specific video players
   */
  processDimensionVideoPlayers(dimensionPlayers) {
    console.log(`📐 Processing ${dimensionPlayers.length} dimension video players`);
    
    dimensionPlayers.forEach(player => {
      // Extract video URL using enhanced methods
      const videoUrl = this.extractVideoUrlFromDimensionPlayer(player);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for dimension player, will retry later');
        setTimeout(() => {
          this.retryDimensionPlayerExtraction(player);
        }, 2000);
        return;
      }
      
      this.createVideoDownloadButton(player, videoUrl);
    });
  }

  /**
   * Process video.js players
   */
  processVideoJsPlayers(videoJsPlayers) {
    console.log(`🎥 Processing ${videoJsPlayers.length} video.js players`);
    
    videoJsPlayers.forEach(player => {
      const videoUrl = this.extractVideoUrlFromVideoJsPlayer(player);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for video.js player, will retry later');
        setTimeout(() => {
          this.retryVideoJsPlayerExtraction(player);
        }, 2000);
        return;
      }
      
      this.createVideoDownloadButton(player, videoUrl);
    });
  }

  /**
   * Process standalone video elements
   */
  processStandaloneVideos(standaloneVideos) {
    console.log(`🎬 Processing ${standaloneVideos.length} standalone videos`);
    
    standaloneVideos.forEach(video => {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for standalone video, will retry later');
        setTimeout(() => {
          this.retryVideoExtraction(video.parentElement);
        }, 2000);
        return;
      }
      
      const parent = video.parentElement;
      if (parent && !parent.querySelector(`.${this.uniqueClass}`)) {
        this.createVideoDownloadButton(parent, videoUrl);
      }
    });
  }

  /**
   * Process videos with data attributes
   */
  processDataAttributeVideos(dataAttributeVideos) {
    console.log(`🔗 Processing ${dataAttributeVideos.length} data attribute videos`);
    
    dataAttributeVideos.forEach(video => {
      const videoUrl = this.extractVideoUrlFromDataAttributes(video);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for data attribute video, will retry later');
        setTimeout(() => {
          this.retryDataAttributeVideoExtraction(video);
        }, 2000);
        return;
      }
      
      const parent = video.parentElement;
      if (parent && !parent.querySelector(`.${this.uniqueClass}`)) {
        this.createVideoDownloadButton(parent, videoUrl);
      }
    });
  }

  /**
   * Retry video extraction for a specific element
   */
  retryVideoExtraction(element) {
    console.log('🔄 Retrying video extraction for:', element);
    
    if (element.classList.contains('video-wrapper')) {
      const videoUrl = this.extractVideoUrl(element, element.closest('.b-post'));
      if (videoUrl) {
        console.log('✅ Found video URL on retry:', videoUrl);
        const creatorUsername = this.getCreatorUsername(element);
        const downloadData = [[videoUrl, creatorUsername, 'download video']];
        
        // Remove existing buttons and add new one
        const existingButtons = element.querySelectorAll(`.${this.uniqueClass}`);
        existingButtons.forEach(btn => btn.remove());
        
        const buttonContainer = this.createDownloadButtonContainer(downloadData);
        element.appendChild(buttonContainer);
      }
    } else {
      // Handle standalone video
      const video = element.querySelector('video');
      if (video) {
        const videoUrl = this.extractVideoUrlFromElement(video);
        if (videoUrl) {
          console.log('✅ Found video URL on retry:', videoUrl);
          const creatorUsername = this.getCreatorUsername(video);
          const downloadData = [[videoUrl, creatorUsername, 'download video']];
          
          if (!element.querySelector(`.${this.uniqueClass}`)) {
            const buttonContainer = this.createDownloadButtonContainer(downloadData);
            element.appendChild(buttonContainer);
          }
        }
      }
    }
  }

  /**
   * Extract media URLs from a post
   */
  extractMediaFromPost(post) {
    const mediaToDownload = [];
    const creatorUsername = this.getCreatorUsername(post);
    
    // First, check for videos (prioritize videos over images)
    const videoWrappers = post.querySelectorAll('div.video-wrapper');
    let hasVideo = false;
    
    videoWrappers.forEach(wrapper => {
      const videoUrl = this.extractVideoUrl(wrapper, post);
      if (videoUrl) {
        mediaToDownload.push([videoUrl, creatorUsername, 'download video']);
        hasVideo = true;
      }
    });
    
    // Only add images if no videos were found, or if there are additional images
    if (!hasVideo) {
      const images = post.querySelectorAll('img.b-post__media__img');
      images.forEach(img => {
        if (img.src) {
          mediaToDownload.push([img.src, creatorUsername, 'download']);
        }
      });
    } else {
      // If we have videos, only add images that are not thumbnails/previews of the videos
      const images = post.querySelectorAll('img.b-post__media__img');
      images.forEach(img => {
        if (img.src) {
          // Check if this image is likely a video thumbnail/preview
          const isVideoThumbnail = this.isVideoThumbnail(img, videoWrappers);
          if (!isVideoThumbnail) {
            mediaToDownload.push([img.src, creatorUsername, 'download']);
          }
        }
      });
    }
    
    return mediaToDownload;
  }

  /**
   * Check if an image is likely a video thumbnail/preview
   */
  isVideoThumbnail(img, videoWrappers) {
    const imgSrc = img.src;
    
    // Check if this image is near a video wrapper
    for (const wrapper of videoWrappers) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      
      // If image is close to video wrapper, it's likely a thumbnail
      const distance = Math.abs(wrapperRect.top - imgRect.top) + Math.abs(wrapperRect.left - imgRect.left);
      if (distance < 100) {
        return true;
      }
    }
    
    // Check if image filename suggests it's a thumbnail
    if (imgSrc.includes('thumb') || imgSrc.includes('preview') || imgSrc.includes('small')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract video URL from video wrapper with multiple fallback methods
   */
  extractVideoUrl(wrapper, post) {
    console.log('🔍 Extracting video URL from wrapper:', wrapper);
    
    // Method 1: Try to get from video source element
    const video = wrapper.querySelector('video.vjs-tech');
    if (video) {
      console.log('📹 Found video element:', video);
      
      const source = video.querySelector('source[label="original"]');
      if (source && source.src) {
        console.log('✅ Found original source:', source.src);
        return source.src;
      }
      
      // Try any source element
      const anySource = video.querySelector('source');
      if (anySource && anySource.src) {
        console.log('✅ Found any source:', anySource.src);
        return anySource.src;
      }
      
      // Try video src directly
      if (video.src) {
        console.log('✅ Found video src:', video.src);
        return video.src;
      }
    }

    // Method 2: Try to get from API data (mediaStore)
    const postId = post?.getAttribute('data-id');
    if (postId && this.mediaStore.has(postId)) {
      console.log('📊 Found post in mediaStore:', postId);
      const postData = this.mediaStore.get(postId);
      const mediaList = postData.media || [];
      
      for (const media of mediaList) {
        if (media.type === 'video') {
          const qualityMap = {
            full: media.source?.source,
            240: media.videoSources?.[240],
            720: media.videoSources?.[720]
          };
          
          const videoUrl = qualityMap[this.settings.quality] || qualityMap.full;
          if (videoUrl) {
            console.log('✅ Found video URL from API data:', videoUrl);
            return videoUrl;
          }
        }
      }
    }

    // Method 3: Try to extract from data attributes
    const videoElement = wrapper.querySelector('video');
    if (videoElement) {
      console.log('🔍 Checking data attributes on video element');
      
      // Check for data attributes that might contain video URLs
      const dataSrc = videoElement.getAttribute('data-src');
      if (dataSrc) {
        console.log('✅ Found data-src:', dataSrc);
        return dataSrc;
      }
      
      const dataVideo = videoElement.getAttribute('data-video');
      if (dataVideo) {
        console.log('✅ Found data-video:', dataVideo);
        return dataVideo;
      }
    }

    // Method 4: Try to get from parent wrapper data attributes
    const wrapperDataSrc = wrapper.getAttribute('data-src');
    if (wrapperDataSrc) {
      console.log('✅ Found wrapper data-src:', wrapperDataSrc);
      return wrapperDataSrc;
    }

    // Method 5: Try to find video URL in the DOM structure
    const allVideos = wrapper.querySelectorAll('video');
    for (const video of allVideos) {
      console.log('🔍 Checking video element:', video);
      console.log('Video src:', video.src);
      console.log('Video sources:', Array.from(video.querySelectorAll('source')).map(s => s.src));
      
      if (video.src && video.src !== '') {
        console.log('✅ Found video src in DOM:', video.src);
        return video.src;
      }
      
      const sources = video.querySelectorAll('source');
      for (const source of sources) {
        if (source.src && source.src !== '') {
          console.log('✅ Found source src in DOM:', source.src);
          return source.src;
        }
      }
    }

    // Method 6: Try to extract from any video-related elements
    const videoElements = wrapper.querySelectorAll('[data-video], [data-src], [data-url]');
    for (const element of videoElements) {
      const videoUrl = element.getAttribute('data-video') || element.getAttribute('data-src') || element.getAttribute('data-url');
      if (videoUrl && videoUrl.includes('http')) {
        console.log('✅ Found video URL in data attribute:', videoUrl);
        return videoUrl;
      }
    }

    console.log('❌ No video URL found');
    return null;
  }

  /**
   * Extract media URLs from a chat message
   */
  extractMediaFromMessage(message) {
    const mediaToDownload = [];
    const creatorUsername = this.getCreatorUsername(message);
    
    const mediaContainer = message.querySelector('.b-chat__message__media');
    if (!mediaContainer) return mediaToDownload;
    
    // Extract images
    const images = mediaContainer.querySelectorAll('img');
    images.forEach(img => {
      if (img.src) {
        mediaToDownload.push([img.src, creatorUsername, 'download']);
      }
    });
    
    // Extract videos with improved logic
    const videos = mediaContainer.querySelectorAll('video');
    videos.forEach(video => {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        mediaToDownload.push([videoUrl, creatorUsername, 'download video']);
      }
    });
    
    return mediaToDownload;
  }

  /**
   * Extract video URL from video element
   */
  extractVideoUrlFromElement(video) {
    // Method 1: Try source element with original label
    const source = video.querySelector('source[label="original"]');
    if (source && source.src) {
      return source.src;
    }
    
    // Method 2: Try any source element
    const anySource = video.querySelector('source');
    if (anySource && anySource.src) {
      return anySource.src;
    }
    
    // Method 3: Try video src directly
    if (video.src) {
      return video.src;
    }
    
    // Method 4: Check data attributes
    const dataSrc = video.getAttribute('data-src');
    if (dataSrc) return dataSrc;
    
    const dataVideo = video.getAttribute('data-video');
    if (dataVideo) return dataVideo;
    
    return null;
  }

  /**
   * Get creator username from element context
   */
  getCreatorUsername(element) {
    // Try to get from username element
    const usernameElement = element.querySelector('.g-user-username');
    if (usernameElement) {
      return usernameElement.textContent.trim().replace('@', '');
    }
    
    // Try to get from page title (for DMs)
    const pageTitle = document.querySelector('h1.g-page-title');
    if (pageTitle) {
      return pageTitle.textContent.trim();
    }
    
    // Fallback to URL path
    const pathParts = window.location.pathname.split('/');
    return pathParts[1] || 'unknown_creator';
  }

  /**
   * Create download button container
   */
  createDownloadButtonContainer(mediaToDownload) {
    const container = document.createElement('div');
    container.className = this.uniqueClass;
    container.style.cssText = 'margin: 10px 0; display: flex; gap: 5px; flex-wrap: wrap;';
    
    // Group media by type and create smart buttons
    const mediaGroups = this.groupMediaByType(mediaToDownload);
    
    mediaGroups.forEach(group => {
      const button = this.createSmartDownloadButton(group);
      container.appendChild(button);
    });
    
    return container;
  }

  /**
   * Group media by type for smart button creation
   */
  groupMediaByType(mediaToDownload) {
    const groups = {
      video: [],
      image: [],
      mixed: []
    };
    
    mediaToDownload.forEach(([url, creator, type]) => {
      if (type.includes('video')) {
        groups.video.push([url, creator, type]);
      } else {
        groups.image.push([url, creator, type]);
      }
    });
    
    // If we have both videos and images, create a mixed group
    if (groups.video.length > 0 && groups.image.length > 0) {
      groups.mixed = [...groups.video, ...groups.image];
      groups.video = [];
      groups.image = [];
    }
    
    // Return non-empty groups
    return Object.values(groups).filter(group => group.length > 0);
  }

  /**
   * Create smart download button that adapts to content type
   */
  createSmartDownloadButton(mediaGroup) {
    const button = document.createElement('button');
    const isVideo = mediaGroup.some(([url, creator, type]) => type.includes('video'));
    const isMixed = mediaGroup.length > 1;
    
    // Set button text based on content type
    if (isMixed) {
      button.textContent = `📥 Download All (${mediaGroup.length})`;
    } else if (isVideo) {
      button.textContent = '🎬 Download Video';
    } else {
      button.textContent = '📷 Download Image';
    }
    
    button.style.cssText = `
      padding: 8px 12px;
      background-color: ${isVideo ? '#007bff' : '#28a745'};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = isVideo ? '#0056b3' : '#218838';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = isVideo ? '#007bff' : '#28a745';
    });
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        button.textContent = '⏳ Downloading...';
        button.disabled = true;
        
        // Download all media in the group
        for (const [url, creator, type] of mediaGroup) {
          try {
            await this.downloadMedia(url, creator, type);
          } catch (error) {
            console.error(`Failed to download ${url}:`, error);
          }
        }
        
        button.textContent = '✅ Downloaded';
        setTimeout(() => {
          if (isMixed) {
            button.textContent = `📥 Download All (${mediaGroup.length})`;
          } else if (isVideo) {
            button.textContent = '🎬 Download Video';
          } else {
            button.textContent = '📷 Download Image';
          }
          button.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('Download failed:', error);
        button.textContent = '❌ Failed';
        setTimeout(() => {
          if (isMixed) {
            button.textContent = `📥 Download All (${mediaGroup.length})`;
          } else if (isVideo) {
            button.textContent = '🎬 Download Video';
          } else {
            button.textContent = '📷 Download Image';
          }
          button.disabled = false;
        }, 2000);
      }
    });
    
    return button;
  }

  /**
   * Download media file
   */
  async downloadMedia(url, creator, type) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage([url, creator, type], (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Setup PhotoSwipe handler with dynamic button updating
   */
  setupPhotoSwipeHandler() {
    const checkPhotoSwipe = () => {
      const viewer = document.querySelector('.pswp--open');
      if (!viewer) {
        setTimeout(checkPhotoSwipe, 1000);
        return;
      }
      
      const topBar = viewer.querySelector('.pswp__top-bar');
      if (!topBar) {
        setTimeout(checkPhotoSwipe, 1000);
        return;
      }
      
      // Remove existing download buttons
      const existingButtons = topBar.querySelectorAll(`.${this.uniqueClass}`);
      existingButtons.forEach(btn => btn.remove());
      
      // Get current slide media
      const activeSlide = viewer.querySelector('.pswp__item[aria-hidden="false"]');
      if (!activeSlide) {
        setTimeout(checkPhotoSwipe, 1000);
        return;
      }
      
      let mediaUrl = null;
      let buttonLabel = 'download';
      
      // Check for video
      const videoSource = activeSlide.querySelector('source[label="original"]');
      if (videoSource) {
        mediaUrl = videoSource.getAttribute('src');
        buttonLabel = 'download video';
      } else {
        // Check for image
        const image = activeSlide.querySelector('img');
        if (image) {
          mediaUrl = image.getAttribute('src');
        }
      }
      
      if (mediaUrl) {
        const username = window.location.pathname.split('/')[1] || 'unknown_creator';
        const downloadData = [[mediaUrl, username, buttonLabel]];
        const buttonContainer = this.createDownloadButtonContainer(downloadData);
        buttonContainer.classList.add(this.uniqueClass);
        topBar.insertBefore(buttonContainer, topBar.firstChild);
      }
      
      setTimeout(checkPhotoSwipe, 1000);
    };
    
    setTimeout(checkPhotoSwipe, 1000);
  }

  /**
   * Setup dynamic button updating for posts with multiple media
   */
  setupDynamicButtonUpdating() {
    console.log('🔄 Setting up dynamic button updating for multi-media posts...');
    
    // Listen for PhotoSwipe events
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if PhotoSwipe was opened
      if (target.closest('.b-post__media__img') || target.closest('.b-post__media__video')) {
        console.log('🖼️ PhotoSwipe opened, setting up dynamic updates...');
        setTimeout(() => {
          this.setupPhotoSwipeDynamicUpdates();
        }, 500);
      }
    });
    
    // Listen for PhotoSwipe navigation
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const viewer = document.querySelector('.pswp--open');
        if (viewer) {
          console.log('🔄 PhotoSwipe navigation detected, updating buttons...');
          setTimeout(() => {
            this.updatePhotoSwipeButtons();
          }, 100);
        }
      }
    });
    
    // Listen for PhotoSwipe slide changes
    this.observePhotoSwipeChanges();
  }

  /**
   * Setup PhotoSwipe dynamic updates
   */
  setupPhotoSwipeDynamicUpdates() {
    const checkPhotoSwipe = () => {
      const viewer = document.querySelector('.pswp--open');
      if (!viewer) {
        return;
      }
      
      // Update buttons immediately
      this.updatePhotoSwipeButtons();
      
      // Set up observer for slide changes
      this.observePhotoSwipeSlideChanges(viewer);
      
      // Check for PhotoSwipe close
      const checkClose = () => {
        if (!document.querySelector('.pswp--open')) {
          console.log('🖼️ PhotoSwipe closed');
          return;
        }
        setTimeout(checkClose, 1000);
      };
      
      setTimeout(checkClose, 1000);
    };
    
    setTimeout(checkPhotoSwipe, 100);
  }

  /**
   * Observe PhotoSwipe changes
   */
  observePhotoSwipeChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList.contains('pswp--open')) {
                console.log('🖼️ PhotoSwipe opened, setting up dynamic updates...');
                setTimeout(() => {
                  this.setupPhotoSwipeDynamicUpdates();
                }, 500);
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Observe PhotoSwipe slide changes
   */
  observePhotoSwipeSlideChanges(viewer) {
    const slideObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
          const slide = mutation.target;
          if (slide.getAttribute('aria-hidden') === 'false') {
            setTimeout(() => {
              this.updatePhotoSwipeButtons();
            }, 100);
          }
        }
      });
    });
    
    slideObserver.observe(viewer, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden']
    });
  }

  /**
   * Update PhotoSwipe buttons for current slide
   */
  updatePhotoSwipeButtons() {
    const viewer = document.querySelector('.pswp--open');
    if (!viewer) {
      return;
    }
    
    const topBar = viewer.querySelector('.pswp__top-bar');
    if (!topBar) {
      return;
    }
    
    // Remove existing download buttons
    const existingButtons = topBar.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Get current slide
    const activeSlide = viewer.querySelector('.pswp__item[aria-hidden="false"]');
    if (!activeSlide) {
      return;
    }
    
    // Extract media URL from current slide
    let mediaUrl = null;
    let buttonLabel = 'download';
    let creatorUsername = 'unknown_creator';
    
    // Try to get creator username from the original post
    const postElement = this.findOriginalPostFromPhotoSwipe(viewer);
    if (postElement) {
      creatorUsername = this.getCreatorUsername(postElement);
    }
    
    // Check for video in current slide
    const videoSource = activeSlide.querySelector('source[label="original"]');
    if (videoSource) {
      mediaUrl = videoSource.getAttribute('src');
      buttonLabel = 'download video';
    } else {
      // Check for image in current slide
      const image = activeSlide.querySelector('img');
      if (image) {
        mediaUrl = image.getAttribute('src');
      }
    }
    
    if (mediaUrl) {
      console.log('✅ Found media URL in PhotoSwipe slide:', mediaUrl);
      const downloadData = [[mediaUrl, creatorUsername, buttonLabel]];
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      buttonContainer.classList.add(this.uniqueClass);
      topBar.insertBefore(buttonContainer, topBar.firstChild);
    } else {
      console.log('⚠️ No media URL found in current PhotoSwipe slide');
    }
  }

  /**
   * Find original post element from PhotoSwipe
   */
  findOriginalPostFromPhotoSwipe(viewer) {
    // Try to find the original post by looking for data attributes or classes
    const slides = viewer.querySelectorAll('.pswp__item');
    for (const slide of slides) {
      const img = slide.querySelector('img');
      if (img) {
        // Try to find the original post by matching image src
        const posts = document.querySelectorAll('.b-post');
        for (const post of posts) {
          const postImages = post.querySelectorAll('img.b-post__media__img');
          for (const postImg of postImages) {
            if (postImg.src === img.src) {
              return post;
            }
          }
        }
      }
    }
    
    // Fallback: try to get from URL or page context
    const pathParts = window.location.pathname.split('/');
    return pathParts[1] ? document.querySelector(`[data-username="${pathParts[1]}"]`) : null;
  }

  /**
   * Setup multi-media post handling
   */
  setupMultiMediaPostHandling() {
    console.log('📸 Setting up multi-media post handling...');
    
    // Handle posts with multiple images/videos
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
      
      if (mediaItems.length > 1) {
        console.log(`📸 Found post with ${mediaItems.length} media items`);
        
        // Add click handlers to each media item
        mediaItems.forEach((mediaItem, index) => {
          mediaItem.addEventListener('click', () => {
            console.log(`🖼️ Media item ${index + 1} clicked`);
            setTimeout(() => {
              this.updateButtonsForCurrentMediaItem(mediaItem, post);
            }, 500);
          });
        });
        
        // Add navigation handlers for PhotoSwipe
        this.setupPhotoSwipeNavigationHandling(post);
      }
    });
  }

  /**
   * Update buttons for current media item
   */
  updateButtonsForCurrentMediaItem(mediaItem, post) {
    const viewer = document.querySelector('.pswp--open');
    if (!viewer) {
      return;
    }
    
    console.log('🔄 Updating buttons for current media item...');
    
    // Get current slide index
    const currentSlide = viewer.querySelector('.pswp__item[aria-hidden="false"]');
    if (!currentSlide) {
      return;
    }
    
    // Find the corresponding media item in the original post
    const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
    const currentIndex = Array.from(mediaItems).findIndex(item => {
      const img = item.querySelector('img');
      const slideImg = currentSlide.querySelector('img');
      return img && slideImg && img.src === slideImg.src;
    });
    
    if (currentIndex !== -1) {
      console.log(`📸 Current media item index: ${currentIndex + 1}/${mediaItems.length}`);
      
      // Update buttons based on current media item
      this.updateButtonsForMediaIndex(post, currentIndex, mediaItems.length);
    }
  }

  /**
   * Update buttons for specific media index
   */
  updateButtonsForMediaIndex(post, currentIndex, totalItems) {
    const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
    const currentItem = mediaItems[currentIndex];
    
    if (!currentItem) {
      return;
    }
    
    // Remove existing buttons
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Extract media URL for current item
    let mediaUrl = null;
    let buttonLabel = 'download';
    
    if (currentItem.classList.contains('b-post__media__video')) {
      // Handle video
      const video = currentItem.querySelector('video');
      if (video) {
        mediaUrl = this.extractVideoUrlFromElement(video);
        buttonLabel = 'download video';
      }
    } else {
      // Handle image
      const img = currentItem.querySelector('img');
      if (img) {
        mediaUrl = img.src;
      }
    }
    
    if (mediaUrl) {
      const creatorUsername = this.getCreatorUsername(post);
      const downloadData = [[mediaUrl, creatorUsername, buttonLabel]];
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      post.appendChild(buttonContainer);
      
      console.log(`✅ Updated buttons for media item ${currentIndex + 1}/${totalItems}`);
    }
  }

  /**
   * Setup PhotoSwipe navigation handling
   */
  setupPhotoSwipeNavigationHandling(post) {
    // Listen for PhotoSwipe navigation events
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const viewer = document.querySelector('.pswp--open');
        if (viewer) {
          setTimeout(() => {
            this.handlePhotoSwipeNavigation(post);
          }, 100);
        }
      }
    });
    
    // Listen for PhotoSwipe slide changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
          const slide = mutation.target;
          if (slide.getAttribute('aria-hidden') === 'false') {
            setTimeout(() => {
              this.handlePhotoSwipeNavigation(post);
            }, 100);
          }
        }
      });
    });
    
    // Start observing when PhotoSwipe opens
    document.addEventListener('click', (event) => {
      if (event.target.closest('.b-post__media__img') || event.target.closest('.b-post__media__video')) {
        setTimeout(() => {
          const viewer = document.querySelector('.pswp--open');
          if (viewer) {
            observer.observe(viewer, {
              attributes: true,
              subtree: true,
              attributeFilter: ['aria-hidden']
            });
          }
        }, 500);
      }
    });
  }

  /**
   * Handle PhotoSwipe navigation
   */
  handlePhotoSwipeNavigation(post) {
    const viewer = document.querySelector('.pswp--open');
    if (!viewer) {
      return;
    }
    
    const currentSlide = viewer.querySelector('.pswp__item[aria-hidden="false"]');
    if (!currentSlide) {
      return;
    }
    
    // Find current slide index
    const slides = viewer.querySelectorAll('.pswp__item');
    const currentIndex = Array.from(slides).findIndex(slide => slide === currentSlide);
    
    if (currentIndex !== -1) {
      console.log(`🔄 PhotoSwipe navigation: slide ${currentIndex + 1}/${slides.length}`);
      this.updateButtonsForMediaIndex(post, currentIndex, slides.length);
    }
  }

  /**
   * Setup video load handler for dynamically loaded videos
   */
  setupVideoLoadHandler() {
    // Listen for video load events
    document.addEventListener('load', (event) => {
      if (event.target.tagName === 'VIDEO') {
        console.log('🎬 Video loaded:', event.target);
        this.handleVideoLoad(event.target);
      }
    }, true);

    // Listen for video play events
    document.addEventListener('play', (event) => {
      if (event.target.tagName === 'VIDEO') {
        console.log('▶️ Video started playing:', event.target);
        this.handleVideoPlay(event.target);
      }
    }, true);

    // Listen for click events on play buttons
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('vjs-play-control') || 
          target.closest('.vjs-play-control') ||
          target.classList.contains('play-button') ||
          target.textContent.includes('Play')) {
        console.log('▶️ Play button clicked, checking for videos');
        setTimeout(() => {
          this.forceVideoDetection();
        }, 1000);
      }
    }, true);
  }

  /**
   * Force video detection by checking all video elements
   */
  forceVideoDetection() {
    console.log('🔍 Force detecting videos...');
    
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      console.log('🔍 Checking video:', video);
      console.log('Video src:', video.src);
      console.log('Video sources:', Array.from(video.querySelectorAll('source')).map(s => s.src));
      
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        console.log('✅ Found video URL on force detection:', videoUrl);
        const creatorUsername = this.getCreatorUsername(video);
        const downloadData = [[videoUrl, creatorUsername, 'download video']];
        
        // Find the appropriate parent to add the button
        const parent = video.closest('.b-post, .b-chat__message, .video-wrapper') || video.parentElement;
        if (parent && !parent.querySelector(`.${this.uniqueClass}`)) {
          const buttonContainer = this.createDownloadButtonContainer(downloadData);
          parent.appendChild(buttonContainer);
        }
      }
    });
  }

  /**
   * Handle video load event
   */
  handleVideoLoad(video) {
    const videoUrl = this.extractVideoUrlFromElement(video);
    if (!videoUrl) return;
    
    const creatorUsername = this.getCreatorUsername(video);
    const downloadData = [[videoUrl, creatorUsername, 'download video']];
    
    // Check if button already exists
    const parent = video.parentElement;
    if (parent && !parent.querySelector(`.${this.uniqueClass}`)) {
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      parent.appendChild(buttonContainer);
    }
  }

  /**
   * Handle video play event
   */
  handleVideoPlay(video) {
    // Same as handleVideoLoad but triggered on play
    this.handleVideoLoad(video);
  }

  /**
   * Create floating download all button
   */
  createFloatingDownloadButton() {
    setTimeout(() => {
      const existingButton = document.querySelector('#of-downloader-floating-btn');
      if (existingButton) return;
      
      const button = document.createElement('button');
      button.id = 'of-downloader-floating-btn';
      button.textContent = '📥 Download All';
      button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 16px;
        font-size: 14px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        z-index: 9999;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.2s;
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#0056b3';
        button.style.transform = 'translateY(-2px)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#007bff';
        button.style.transform = 'translateY(0)';
      });
      
      button.addEventListener('click', async () => {
        try {
          button.textContent = '⏳ Collecting...';
          button.disabled = true;
          
          const links = this.collectAllDownloadLinks();
          
          if (links.length === 0) {
            button.textContent = '❌ No media found';
            setTimeout(() => {
              button.textContent = '📥 Download All';
              button.disabled = false;
            }, 2000);
            return;
          }
          
          button.textContent = `⏳ Downloading ${links.length}...`;
          
          for (let i = 0; i < links.length; i++) {
            const [url, creator, type] = links[i];
            try {
              await this.downloadMedia(url, creator, type);
              button.textContent = `⏳ Downloaded ${i + 1}/${links.length}`;
            } catch (error) {
              console.error(`Failed to download ${url}:`, error);
            }
          }
          
          button.textContent = `✅ Downloaded ${links.length} files`;
          setTimeout(() => {
            button.textContent = '📥 Download All';
            button.disabled = false;
          }, 3000);
        } catch (error) {
          console.error('Bulk download failed:', error);
          button.textContent = '❌ Download failed';
          setTimeout(() => {
            button.textContent = '📥 Download All';
            button.disabled = false;
          }, 3000);
        }
      });

      // Add right-click context menu for refresh
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.refreshDownloadButtons();
        button.textContent = '🔄 Refreshed';
        setTimeout(() => {
          button.textContent = '📥 Download All';
        }, 1000);
      });
      
      document.body.appendChild(button);
    }, 2000);
  }

  /**
   * Refresh download buttons manually
   */
  refreshDownloadButtons() {
    console.log('🔄 Manually refreshing download buttons...');
    
    // Remove all existing download buttons
    const existingButtons = document.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Re-inject download buttons
    this.injectDownloadButtons();
    
    console.log('✅ Download buttons refreshed');
  }

  /**
   * Collect all download links from the page
   */
  collectAllDownloadLinks() {
    const links = [];
    
    // Collect from posts
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      const mediaToDownload = this.extractMediaFromPost(post);
      links.push(...mediaToDownload);
    });
    
    // Collect from chat messages
    const messages = document.querySelectorAll('.b-chat__message');
    messages.forEach(message => {
      const mediaToDownload = this.extractMediaFromMessage(message);
      links.push(...mediaToDownload);
    });
    
    return links;
  }

  /**
   * Enhanced debug method to analyze OnlyFans video player structure
   */
  debugVideoElements() {
    console.log('🔍 === ENHANCED VIDEO DEBUG INFO ===');
    
    // Check for video elements
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} video elements on page`);
    
    videos.forEach((video, index) => {
      console.log(`Video ${index + 1}:`, {
        src: video.src,
        sources: Array.from(video.querySelectorAll('source')).map(s => ({
          src: s.src,
          label: s.getAttribute('label'),
          type: s.getAttribute('type')
        })),
        dataAttributes: {
          'data-src': video.getAttribute('data-src'),
          'data-video': video.getAttribute('data-video'),
          'data-url': video.getAttribute('data-url'),
          'data-source': video.getAttribute('data-source')
        },
        parent: video.parentElement?.className,
        parentDataAttributes: {
          'data-src': video.parentElement?.getAttribute('data-src'),
          'data-video': video.parentElement?.getAttribute('data-video')
        }
      });
    });
    
    // Check for video wrappers
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    console.log(`Found ${videoWrappers.length} video wrappers on page`);
    
    videoWrappers.forEach((wrapper, index) => {
      console.log(`Video Wrapper ${index + 1}:`, {
        className: wrapper.className,
        dataAttributes: {
          'data-src': wrapper.getAttribute('data-src'),
          'data-video': wrapper.getAttribute('data-video')
        },
        hasVideo: !!wrapper.querySelector('video'),
        hasVideoJsTech: !!wrapper.querySelector('.vjs-tech')
      });
    });
    
    // Check for dimension-specific video players
    const dimensionPlayers = document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]');
    console.log(`Found ${dimensionPlayers.length} dimension video players on page`);
    
    dimensionPlayers.forEach((player, index) => {
      console.log(`Dimension Player ${index + 1}:`, {
        className: player.className,
        dataAttributes: {
          'data-src': player.getAttribute('data-src'),
          'data-video': player.getAttribute('data-video')
        },
        hasVideo: !!player.querySelector('video'),
        hasVideoJsTech: !!player.querySelector('.vjs-tech'),
        hasSource: !!player.querySelector('source')
      });
    });
    
    // Check for video.js players
    const videoJsPlayers = document.querySelectorAll('.video-js, .vjs-fluid');
    console.log(`Found ${videoJsPlayers.length} video.js players on page`);
    
    videoJsPlayers.forEach((player, index) => {
      console.log(`Video.js Player ${index + 1}:`, {
        className: player.className,
        dataAttributes: {
          'data-src': player.getAttribute('data-src'),
          'data-video': player.getAttribute('data-video')
        },
        hasVideo: !!player.querySelector('video'),
        hasVideoJsTech: !!player.querySelector('.vjs-tech'),
        hasSource: !!player.querySelector('source'),
        sources: Array.from(player.querySelectorAll('source')).map(s => ({
          src: s.src,
          label: s.getAttribute('label'),
          type: s.getAttribute('type')
        }))
      });
    });
    
    // Check for data attribute videos
    const dataAttributeVideos = document.querySelectorAll('video[data-src], video[data-video], video[data-url]');
    console.log(`Found ${dataAttributeVideos.length} videos with data attributes on page`);
    
    dataAttributeVideos.forEach((video, index) => {
      console.log(`Data Attribute Video ${index + 1}:`, {
        src: video.src,
        dataAttributes: {
          'data-src': video.getAttribute('data-src'),
          'data-video': video.getAttribute('data-video'),
          'data-url': video.getAttribute('data-url'),
          'data-source': video.getAttribute('data-source')
        },
        parent: video.parentElement?.className,
        parentDataAttributes: {
          'data-src': video.parentElement?.getAttribute('data-src'),
          'data-video': video.parentElement?.getAttribute('data-video')
        }
      });
    });
    
    // Check for video.js tech elements
    const videoJsTechElements = document.querySelectorAll('.vjs-tech');
    console.log(`Found ${videoJsTechElements.length} video.js tech elements on page`);
    
    videoJsTechElements.forEach((tech, index) => {
      console.log(`Video.js Tech ${index + 1}:`, {
        src: tech.src,
        sources: Array.from(tech.querySelectorAll('source')).map(s => ({
          src: s.src,
          label: s.getAttribute('label'),
          type: s.getAttribute('type')
        })),
        parent: tech.parentElement?.className
      });
    });
    
    // Check for source elements with specific labels
    const originalSources = document.querySelectorAll('source[label="original"]');
    console.log(`Found ${originalSources.length} source elements with "original" label`);
    
    originalSources.forEach((source, index) => {
      console.log(`Original Source ${index + 1}:`, {
        src: source.src,
        label: source.getAttribute('label'),
        type: source.getAttribute('type'),
        parent: source.parentElement?.className
      });
    });
    
    // Check for any source elements
    const allSources = document.querySelectorAll('source');
    console.log(`Found ${allSources.length} total source elements on page`);
    
    allSources.forEach((source, index) => {
      console.log(`Source ${index + 1}:`, {
        src: source.src,
        label: source.getAttribute('label'),
        type: source.getAttribute('type'),
        parent: source.parentElement?.className
      });
    });
    
    // Check for CSS classes that might indicate video players
    const videoPlayerClasses = document.querySelectorAll('[class*="videoPlayer"], [class*="vjs-"], [class*="video-js"]');
    console.log(`Found ${videoPlayerClasses.length} elements with video player classes`);
    
    videoPlayerClasses.forEach((element, index) => {
      console.log(`Video Player Class Element ${index + 1}:`, {
        className: element.className,
        tagName: element.tagName,
        hasVideo: !!element.querySelector('video'),
        hasSource: !!element.querySelector('source')
      });
    });
    
    console.log('🔍 === END ENHANCED DEBUG INFO ===');
  }

  /**
   * Analyze OnlyFans-specific HTML structure patterns
   */
  analyzeOnlyFansStructure() {
    console.log('🔍 === ONLYFANS STRUCTURE ANALYSIS ===');
    
    // Check for dimension-specific CSS classes
    const dimensionStyles = document.querySelectorAll('style[class*="vjs-styles-dimensions"]');
    console.log(`Found ${dimensionStyles.length} dimension style elements`);
    
    dimensionStyles.forEach((style, index) => {
      console.log(`Dimension Style ${index + 1}:`, {
        className: style.className,
        content: style.textContent.substring(0, 200) + '...'
      });
    });
    
    // Check for video player dimension classes
    const dimensionClasses = document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]');
    console.log(`Found ${dimensionClasses.length} elements with video player dimension classes`);
    
    dimensionClasses.forEach((element, index) => {
      const classes = element.className.split(' ');
      const dimensionClass = classes.find(cls => cls.includes('videoPlayer-') && cls.includes('-dimensions'));
      
      console.log(`Dimension Class Element ${index + 1}:`, {
        className: element.className,
        dimensionClass: dimensionClass,
        tagName: element.tagName,
        hasVideo: !!element.querySelector('video'),
        hasVideoJs: !!element.querySelector('.vjs-tech'),
        hasSource: !!element.querySelector('source'),
        dataAttributes: {
          'data-src': element.getAttribute('data-src'),
          'data-video': element.getAttribute('data-video'),
          'data-url': element.getAttribute('data-url')
        }
      });
    });
    
    // Check for video.js fluid elements
    const fluidElements = document.querySelectorAll('.vjs-fluid');
    console.log(`Found ${fluidElements.length} video.js fluid elements`);
    
    fluidElements.forEach((element, index) => {
      console.log(`Fluid Element ${index + 1}:`, {
        className: element.className,
        tagName: element.tagName,
        hasVideo: !!element.querySelector('video'),
        hasVideoJs: !!element.querySelector('.vjs-tech'),
        hasSource: !!element.querySelector('source'),
        dataAttributes: {
          'data-src': element.getAttribute('data-src'),
          'data-video': element.getAttribute('data-video')
        }
      });
    });
    
    // Check for video.js default styles
    const defaultStyles = document.querySelectorAll('style[class*="vjs-styles-defaults"]');
    console.log(`Found ${defaultStyles.length} video.js default style elements`);
    
    defaultStyles.forEach((style, index) => {
      console.log(`Default Style ${index + 1}:`, {
        className: style.className,
        content: style.textContent.substring(0, 200) + '...'
      });
    });
    
    // Check for specific video player IDs from the HTML
    const specificPlayerIds = ['videoPlayer-3941380727', 'videoPlayer-3916772495'];
    specificPlayerIds.forEach(id => {
      const element = document.querySelector(`[class*="${id}"]`);
      if (element) {
        console.log(`Found specific player ${id}:`, {
          className: element.className,
          tagName: element.tagName,
          hasVideo: !!element.querySelector('video'),
          hasVideoJs: !!element.querySelector('.vjs-tech'),
          hasSource: !!element.querySelector('source')
        });
      } else {
        console.log(`Specific player ${id} not found`);
      }
    });
    
    // Check for OnlyFans-specific video player structure
    const onlyFansVideoStructure = {
      videoWrappers: document.querySelectorAll('.video-wrapper').length,
      videoJsPlayers: document.querySelectorAll('.video-js').length,
      fluidPlayers: document.querySelectorAll('.vjs-fluid').length,
      techElements: document.querySelectorAll('.vjs-tech').length,
      dimensionPlayers: document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]').length,
      sourceElements: document.querySelectorAll('source').length,
      originalSources: document.querySelectorAll('source[label="original"]').length
    };
    
    console.log('OnlyFans Video Structure Summary:', onlyFansVideoStructure);
    
    // Check for video player patterns in the DOM
    const videoPlayerPatterns = {
      'video-wrapper': document.querySelectorAll('.video-wrapper').length,
      'video-js': document.querySelectorAll('.video-js').length,
      'vjs-fluid': document.querySelectorAll('.vjs-fluid').length,
      'vjs-tech': document.querySelectorAll('.vjs-tech').length,
      'videoPlayer-*-dimensions': document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]').length,
      'source[label="original"]': document.querySelectorAll('source[label="original"]').length,
      'video[data-src]': document.querySelectorAll('video[data-src]').length,
      'video[data-video]': document.querySelectorAll('video[data-video]').length
    };
    
    console.log('Video Player Patterns:', videoPlayerPatterns);
    
    console.log('🔍 === END ONLYFANS STRUCTURE ANALYSIS ===');
  }

  /**
   * Extract video URL from dimension-specific player
   */
  extractVideoUrlFromDimensionPlayer(player) {
    console.log('🔍 Extracting video URL from dimension player:', player);
    
    // Method 1: Look for video elements within the player
    const videos = player.querySelectorAll('video');
    for (const video of videos) {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        console.log('✅ Found video URL in dimension player:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 2: Check for video.js tech elements
    const videoJsTech = player.querySelector('.vjs-tech');
    if (videoJsTech) {
      const videoUrl = this.extractVideoUrlFromElement(videoJsTech);
      if (videoUrl) {
        console.log('✅ Found video URL in video.js tech:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 3: Check data attributes on the player itself
    const dataSrc = player.getAttribute('data-src');
    if (dataSrc && dataSrc.includes('http')) {
      console.log('✅ Found video URL in player data-src:', dataSrc);
      return dataSrc;
    }
    
    const dataVideo = player.getAttribute('data-video');
    if (dataVideo && dataVideo.includes('http')) {
      console.log('✅ Found video URL in player data-video:', dataVideo);
      return dataVideo;
    }
    
    // Method 4: Look for any source elements
    const sources = player.querySelectorAll('source');
    for (const source of sources) {
      if (source.src && source.src.includes('http')) {
        console.log('✅ Found video URL in source element:', source.src);
        return source.src;
      }
    }
    
    console.log('❌ No video URL found in dimension player');
    return null;
  }

  /**
   * Extract video URL from video.js player
   */
  extractVideoUrlFromVideoJsPlayer(player) {
    console.log('🔍 Extracting video URL from video.js player:', player);
    
    // Method 1: Look for video.js tech element
    const videoJsTech = player.querySelector('.vjs-tech');
    if (videoJsTech) {
      const videoUrl = this.extractVideoUrlFromElement(videoJsTech);
      if (videoUrl) {
        console.log('✅ Found video URL in video.js tech:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 2: Look for any video element
    const videos = player.querySelectorAll('video');
    for (const video of videos) {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        console.log('✅ Found video URL in video.js player video:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 3: Check for source elements with specific labels
    const originalSource = player.querySelector('source[label="original"]');
    if (originalSource && originalSource.src) {
      console.log('✅ Found original source in video.js player:', originalSource.src);
      return originalSource.src;
    }
    
    // Method 4: Check any source element
    const anySource = player.querySelector('source');
    if (anySource && anySource.src) {
      console.log('✅ Found any source in video.js player:', anySource.src);
      return anySource.src;
    }
    
    console.log('❌ No video URL found in video.js player');
    return null;
  }

  /**
   * Extract video URL from data attributes
   */
  extractVideoUrlFromDataAttributes(video) {
    console.log('🔍 Extracting video URL from data attributes:', video);
    
    // Check common data attributes
    const dataAttributes = ['data-src', 'data-video', 'data-url', 'data-source'];
    
    for (const attr of dataAttributes) {
      const value = video.getAttribute(attr);
      if (value && value.includes('http')) {
        console.log(`✅ Found video URL in ${attr}:`, value);
        return value;
      }
    }
    
    // Also check parent elements for data attributes
    let parent = video.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      for (const attr of dataAttributes) {
        const value = parent.getAttribute(attr);
        if (value && value.includes('http')) {
          console.log(`✅ Found video URL in parent ${attr}:`, value);
          return value;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    
    console.log('❌ No video URL found in data attributes');
    return null;
  }

  /**
   * Create video download button
   */
  createVideoDownloadButton(container, videoUrl) {
    const creatorUsername = this.getCreatorUsername(container);
    const downloadData = [[videoUrl, creatorUsername, 'download video']];
    
    // Remove existing download buttons
    const existingButtons = container.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Add new download button
    const buttonContainer = this.createDownloadButtonContainer(downloadData);
    container.appendChild(buttonContainer);
    
    console.log('✅ Created video download button for:', videoUrl);
  }

  /**
   * Retry extraction for dimension players
   */
  retryDimensionPlayerExtraction(player) {
    console.log('🔄 Retrying dimension player extraction for:', player);
    
    const videoUrl = this.extractVideoUrlFromDimensionPlayer(player);
    if (videoUrl) {
      console.log('✅ Found video URL on retry:', videoUrl);
      this.createVideoDownloadButton(player, videoUrl);
    }
  }

  /**
   * Retry extraction for video.js players
   */
  retryVideoJsPlayerExtraction(player) {
    console.log('🔄 Retrying video.js player extraction for:', player);
    
    const videoUrl = this.extractVideoUrlFromVideoJsPlayer(player);
    if (videoUrl) {
      console.log('✅ Found video URL on retry:', videoUrl);
      this.createVideoDownloadButton(player, videoUrl);
    }
  }

  /**
   * Retry extraction for data attribute videos
   */
  retryDataAttributeVideoExtraction(video) {
    console.log('🔄 Retrying data attribute video extraction for:', video);
    
    const videoUrl = this.extractVideoUrlFromDataAttributes(video);
    if (videoUrl) {
      console.log('✅ Found video URL on retry:', videoUrl);
      const parent = video.parentElement;
      if (parent) {
        this.createVideoDownloadButton(parent, videoUrl);
      }
    }
  }

  /**
   * Setup image carousel/slider handling within posts
   */
  setupImageCarouselHandling() {
    console.log('🖼️ Setting up image carousel handling...');
    
    // Handle posts with image carousels/sliders
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      const carouselContainer = post.querySelector('.b-post__media__carousel, .b-post__media__slider, [class*="carousel"], [class*="slider"]');
      
      if (carouselContainer) {
        console.log('🖼️ Found image carousel in post');
        
        // Observe carousel changes
        const carouselObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' || mutation.type === 'childList') {
              setTimeout(() => {
                this.updateButtonsForCurrentCarouselItem(post, carouselContainer);
              }, 100);
            }
          });
        });
        
        carouselObserver.observe(carouselContainer, {
          attributes: true,
          childList: true,
          subtree: true
        });
        
        // Listen for carousel navigation events
        carouselContainer.addEventListener('click', (event) => {
          if (event.target.closest('[class*="nav"], [class*="arrow"], [class*="prev"], [class*="next"]')) {
            setTimeout(() => {
              this.updateButtonsForCurrentCarouselItem(post, carouselContainer);
            }, 200);
          }
        });
        
        // Listen for keyboard navigation
        carouselContainer.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            setTimeout(() => {
              this.updateButtonsForCurrentCarouselItem(post, carouselContainer);
            }, 200);
          }
        });
      }
    });
  }

  /**
   * Update buttons for current carousel item
   */
  updateButtonsForCurrentCarouselItem(post, carouselContainer) {
    // Find the currently visible/active item
    const activeItem = carouselContainer.querySelector('[class*="active"], [class*="current"], [style*="display: block"], [style*="opacity: 1"]');
    
    if (!activeItem) {
      // Try alternative selectors for active items
      const visibleItems = carouselContainer.querySelectorAll('img:not([style*="display: none"]), video:not([style*="display: none"])');
      if (visibleItems.length > 0) {
        const firstVisible = visibleItems[0];
        this.updateButtonsForMediaElement(post, firstVisible);
      }
      return;
    }
    
    this.updateButtonsForMediaElement(post, activeItem);
  }

  /**
   * Update buttons for specific media element
   */
  updateButtonsForMediaElement(post, mediaElement) {
    // Remove existing buttons
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Extract media URL
    let mediaUrl = null;
    let buttonLabel = 'download';
    
    if (mediaElement.tagName === 'VIDEO') {
      mediaUrl = this.extractVideoUrlFromElement(mediaElement);
      buttonLabel = 'download video';
    } else if (mediaElement.tagName === 'IMG') {
      mediaUrl = mediaElement.src;
    } else {
      // Check for video or image within the element
      const video = mediaElement.querySelector('video');
      if (video) {
        mediaUrl = this.extractVideoUrlFromElement(video);
        buttonLabel = 'download video';
      } else {
        const img = mediaElement.querySelector('img');
        if (img) {
          mediaUrl = img.src;
        }
      }
    }
    
    if (mediaUrl) {
      const creatorUsername = this.getCreatorUsername(post);
      const downloadData = [[mediaUrl, creatorUsername, buttonLabel]];
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      post.appendChild(buttonContainer);
      
      console.log('✅ Updated buttons for current carousel item:', mediaUrl);
    }
  }

  /**
   * Setup swipe/touch handling for mobile carousels
   */
  setupSwipeHandling() {
    console.log('📱 Setting up swipe handling for mobile carousels...');
    
    let startX = 0;
    let startY = 0;
    let currentPost = null;
    
    // Listen for touch events on posts
    document.addEventListener('touchstart', (event) => {
      const post = event.target.closest('.b-post');
      if (post) {
        currentPost = post;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }
    });
    
    document.addEventListener('touchend', (event) => {
      if (!currentPost) return;
      
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Check if it's a horizontal swipe (more horizontal than vertical)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        console.log('📱 Horizontal swipe detected, updating buttons...');
        setTimeout(() => {
          this.updateButtonsForCurrentCarouselItem(currentPost, currentPost.querySelector('.b-post__media__carousel, .b-post__media__slider'));
        }, 300);
      }
      
      currentPost = null;
    });
  }

  /**
   * Setup direct image click handling within posts
   */
  setupDirectImageClickHandling() {
    console.log('🖼️ Setting up direct image click handling...');
    
    // Handle direct clicks on images in posts
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked on an image in a post
      if (target.tagName === 'IMG' && target.closest('.b-post')) {
        const post = target.closest('.b-post');
        const allImages = post.querySelectorAll('img.b-post__media__img');
        
        if (allImages.length > 1) {
          console.log('🖼️ Direct image click detected in multi-image post');
          
          // Find the clicked image index
          const clickedIndex = Array.from(allImages).indexOf(target);
          
          if (clickedIndex !== -1) {
            console.log(`🖼️ Clicked image ${clickedIndex + 1}/${allImages.length}`);
            
            // Update buttons for the clicked image
            setTimeout(() => {
              this.updateButtonsForClickedImage(post, target, clickedIndex, allImages.length);
            }, 100);
          }
        }
      }
    });
  }

  /**
   * Update buttons for clicked image
   */
  updateButtonsForClickedImage(post, clickedImage, imageIndex, totalImages) {
    // Remove existing buttons
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Extract media URL from clicked image
    let mediaUrl = clickedImage.src;
    let buttonLabel = 'download';
    
    // Check if this image is associated with a video
    const videoContainer = clickedImage.closest('.b-post__media__video');
    if (videoContainer) {
      const video = videoContainer.querySelector('video');
      if (video) {
        const videoUrl = this.extractVideoUrlFromElement(video);
        if (videoUrl) {
          mediaUrl = videoUrl;
          buttonLabel = 'download video';
        }
      }
    }
    
    if (mediaUrl) {
      const creatorUsername = this.getCreatorUsername(post);
      const downloadData = [[mediaUrl, creatorUsername, buttonLabel]];
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      post.appendChild(buttonContainer);
      
      console.log(`✅ Updated buttons for clicked image ${imageIndex + 1}/${totalImages}:`, mediaUrl);
    }
  }

  /**
   * Setup thumbnail navigation handling
   */
  setupThumbnailNavigationHandling() {
    console.log('🖼️ Setting up thumbnail navigation handling...');
    
    // Handle thumbnail clicks in image galleries
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked on a thumbnail
      if (target.closest('[class*="thumb"], [class*="nav"], [class*="dot"]')) {
        const post = target.closest('.b-post');
        if (post) {
          console.log('🖼️ Thumbnail navigation detected');
          
          setTimeout(() => {
            this.updateButtonsForCurrentThumbnail(post);
          }, 200);
        }
      }
    });
  }

  /**
   * Update buttons for current thumbnail
   */
  updateButtonsForCurrentThumbnail(post) {
    // Find the currently active/selected thumbnail
    const activeThumbnail = post.querySelector('[class*="thumb"][class*="active"], [class*="nav"][class*="active"], [class*="dot"][class*="active"]');
    
    if (activeThumbnail) {
      // Find the corresponding main image/video
      const thumbnailIndex = this.getThumbnailIndex(activeThumbnail, post);
      const mainMedia = this.getMainMediaByIndex(post, thumbnailIndex);
      
      if (mainMedia) {
        this.updateButtonsForMediaElement(post, mainMedia);
      }
    }
  }

  /**
   * Get thumbnail index
   */
  getThumbnailIndex(thumbnail, post) {
    const allThumbnails = post.querySelectorAll('[class*="thumb"], [class*="nav"], [class*="dot"]');
    return Array.from(allThumbnails).indexOf(thumbnail);
  }

  /**
   * Get main media by index
   */
  getMainMediaByIndex(post, index) {
    const allMedia = post.querySelectorAll('img.b-post__media__img, .b-post__media__video');
    return allMedia[index] || null;
  }

  /**
   * Setup comprehensive MutationObserver for dynamic content
   */
  setupMutationObserver() {
    console.log('👁️ Setting up MutationObserver for dynamic content...');
    
    // Create main observer for new posts and content changes
    const mainObserver = new MutationObserver((mutations) => {
      let hasNewContent = false;
      let hasRemovedContent = false;
      
      mutations.forEach((mutation) => {
        // Check for added nodes (new posts, new media)
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new posts were added
              if (node.classList && node.classList.contains('b-post')) {
                console.log('📝 New post detected, adding buttons...');
                hasNewContent = true;
                this.handleNewPost(node);
              }
              
              // Check if new media was added to existing posts
              if (node.querySelector && (node.querySelector('.b-post__media__img') || node.querySelector('.b-post__media__video'))) {
                console.log('🖼️ New media detected, updating buttons...');
                hasNewContent = true;
                this.handleNewMedia(node);
              }
              
              // Check if PhotoSwipe was opened
              if (node.classList && node.classList.contains('pswp--open')) {
                console.log('🖼️ PhotoSwipe opened, setting up dynamic updates...');
                setTimeout(() => {
                  this.setupPhotoSwipeDynamicUpdates();
                }, 500);
              }
            }
          });
          
          // Check for removed nodes (posts removed, media changed)
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList && node.classList.contains('b-post')) {
                console.log('🗑️ Post removed, cleaning up...');
                hasRemovedContent = true;
              }
              
              // Check if PhotoSwipe was closed
              if (node.classList && node.classList.contains('pswp--open')) {
                console.log('🖼️ PhotoSwipe closed');
              }
            }
          });
        }
        
        // Check for attribute changes (media switching, carousel navigation)
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          
          // Check for carousel/slider navigation
          if (target.classList && (
            target.classList.contains('active') ||
            target.classList.contains('current') ||
            target.getAttribute('aria-hidden') === 'false'
          )) {
            console.log('🔄 Media navigation detected, updating buttons...');
            hasNewContent = true;
            this.handleMediaNavigation(target);
          }
          
          // Check for PhotoSwipe slide changes
          if (target.classList && target.classList.contains('pswp__item') && 
              mutation.attributeName === 'aria-hidden' && 
              target.getAttribute('aria-hidden') === 'false') {
            console.log('🖼️ PhotoSwipe slide changed, updating buttons...');
            hasNewContent = true;
            this.updatePhotoSwipeButtons();
          }
        }
      });
      
      // Debounced processing of content changes
      if (hasNewContent || hasRemovedContent) {
        this.debouncedProcessContentChanges();
      }
    });
    
    // Start observing the entire document
    mainObserver.observe(document.body, {
      childList: true,      // Watch for added/removed elements
      subtree: true,        // Watch all descendants
      attributes: true,     // Watch for attribute changes
      attributeFilter: ['class', 'aria-hidden', 'style'] // Only watch specific attributes
    });
    
    // Store observer reference for cleanup
    this.mainObserver = mainObserver;
    
    console.log('✅ MutationObserver setup complete');
  }

  /**
   * Handle new post being added
   */
  handleNewPost(postElement) {
    console.log('📝 Processing new post:', postElement);
    
    // Add download buttons to the new post
    const mediaToDownload = this.extractMediaFromPost(postElement);
    if (mediaToDownload.length > 0) {
      const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
      postElement.appendChild(buttonContainer);
      console.log('✅ Added buttons to new post');
    }
    
    // Setup multi-media handling for the new post
    this.setupMultiMediaHandlingForPost(postElement);
  }

  /**
   * Handle new media being added
   */
  handleNewMedia(mediaElement) {
    console.log('🖼️ Processing new media:', mediaElement);
    
    // Find the parent post
    const post = mediaElement.closest('.b-post');
    if (post) {
      // Update buttons for the post
      const mediaToDownload = this.extractMediaFromPost(post);
      if (mediaToDownload.length > 0) {
        // Remove existing buttons
        const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
        existingButtons.forEach(btn => btn.remove());
        
        // Add new buttons
        const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
        post.appendChild(buttonContainer);
        console.log('✅ Updated buttons for new media');
      }
    }
  }

  /**
   * Handle media navigation (carousel, slider, etc.)
   */
  handleMediaNavigation(navigatedElement) {
    console.log('🔄 Processing media navigation:', navigatedElement);
    
    // Find the parent post
    const post = navigatedElement.closest('.b-post');
    if (!post) return;
    
    // Find the currently active/visible media
    const activeMedia = this.findActiveMediaInPost(post);
    if (activeMedia) {
      this.updateButtonsForMediaElement(post, activeMedia);
      console.log('✅ Updated buttons for navigated media');
    }
  }

  /**
   * Find currently active media in a post
   */
  findActiveMediaInPost(post) {
    // Look for active carousel items
    const activeCarouselItem = post.querySelector('[class*="active"][class*="carousel"], [class*="current"][class*="carousel"]');
    if (activeCarouselItem) {
      return activeCarouselItem;
    }
    
    // Look for active slider items
    const activeSliderItem = post.querySelector('[class*="active"][class*="slider"], [class*="current"][class*="slider"]');
    if (activeSliderItem) {
      return activeSliderItem;
    }
    
    // Look for visible media (not hidden)
    const visibleMedia = post.querySelector('img.b-post__media__img:not([style*="display: none"]), video:not([style*="display: none"])');
    if (visibleMedia) {
      return visibleMedia;
    }
    
    // Look for first media item as fallback
    const firstMedia = post.querySelector('img.b-post__media__img, video');
    return firstMedia;
  }

  /**
   * Setup multi-media handling for a specific post
   */
  setupMultiMediaHandlingForPost(post) {
    const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
    
    if (mediaItems.length > 1) {
      console.log(`📸 Setting up multi-media handling for post with ${mediaItems.length} items`);
      
      // Add click handlers to each media item
      mediaItems.forEach((mediaItem, index) => {
        mediaItem.addEventListener('click', () => {
          console.log(`🖼️ Media item ${index + 1} clicked in post`);
          setTimeout(() => {
            this.updateButtonsForCurrentMediaItem(mediaItem, post);
          }, 100);
        });
      });
    }
  }

  /**
   * Debounced processing of content changes
   */
  debouncedProcessContentChanges() {
    if (this.contentChangeTimeout) {
      clearTimeout(this.contentChangeTimeout);
    }
    
    this.contentChangeTimeout = setTimeout(() => {
      console.log('🔄 Processing content changes...');
      
      // Re-inject buttons for all posts
      this.injectDownloadButtons();
      
      // Re-setup multi-media handling
      this.setupMultiMediaPostHandling();
      this.setupImageCarouselHandling();
      this.setupDirectImageClickHandling();
      this.setupThumbnailNavigationHandling();
      
      console.log('✅ Content changes processed');
    }, 500); // 500ms debounce
  }

  /**
   * Cleanup observers when needed
   */
  cleanupObservers() {
    if (this.mainObserver) {
      this.mainObserver.disconnect();
      console.log('🧹 Main observer disconnected');
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      console.log('🧹 Intersection observer disconnected');
    }
    
    if (this.contentChangeTimeout) {
      clearTimeout(this.contentChangeTimeout);
    }
  }

  /**
   * Setup infinite scroll handling
   */
  setupInfiniteScrollHandling() {
    console.log('♾️ Setting up infinite scroll handling...');
    
    // Listen for scroll events to detect new content loading
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.checkForNewContent();
      }, 500);
    });
    
    // Also listen for scroll events on specific containers
    document.addEventListener('scroll', (event) => {
      const target = event.target;
      if (target.classList && (
        target.classList.contains('b-feed') ||
        target.classList.contains('b-content') ||
        target.classList.contains('b-posts')
      )) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.checkForNewContent();
        }, 300);
      }
    }, true);
  }

  /**
   * Check for new content that might have been loaded
   */
  checkForNewContent() {
    const posts = document.querySelectorAll('.b-post');
    const postsWithButtons = document.querySelectorAll(`.b-post .${this.uniqueClass}`);
    
    // If there are posts without buttons, add them
    if (posts.length > postsWithButtons.length) {
      console.log(`♾️ Found ${posts.length - postsWithButtons.length} new posts without buttons, adding...`);
      
      posts.forEach(post => {
        if (!post.querySelector(`.${this.uniqueClass}`)) {
          const mediaToDownload = this.extractMediaFromPost(post);
          if (mediaToDownload.length > 0) {
            const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
            post.appendChild(buttonContainer);
            console.log('✅ Added buttons to new post from scroll');
          }
        }
      });
    }
  }

  /**
   * Setup intersection observer for lazy-loaded content
   */
  setupIntersectionObserver() {
    console.log('👁️ Setting up Intersection Observer for lazy content...');
    
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target;
          
          // Check if this is a post that just became visible
          if (target.classList && target.classList.contains('b-post')) {
            console.log('👁️ Post became visible, ensuring buttons exist...');
            
            if (!target.querySelector(`.${this.uniqueClass}`)) {
              const mediaToDownload = this.extractMediaFromPost(target);
              if (mediaToDownload.length > 0) {
                const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
                target.appendChild(buttonContainer);
                console.log('✅ Added buttons to newly visible post');
              }
            }
          }
        }
      });
    }, {
      rootMargin: '100px', // Start loading 100px before element becomes visible
      threshold: 0.1
    });
    
    // Observe all posts
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      intersectionObserver.observe(post);
    });
    
    // Store observer for cleanup
    this.intersectionObserver = intersectionObserver;
  }
}

// Initialize the downloader when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const downloader = new OnlyFansDownloader();
    downloader.initialize();
    
    // Make debug methods available globally
    window.onlyFansDebug = () => downloader.debugVideoElements();
    window.forceVideoDetection = () => downloader.forceVideoDetection();
    window.refreshButtons = () => downloader.refreshDownloadButtons();
    window.analyzeOnlyFansStructure = () => downloader.analyzeOnlyFansStructure();
  });
} else {
  const downloader = new OnlyFansDownloader();
  downloader.initialize();
  
  // Make debug methods available globally
  window.onlyFansDebug = () => downloader.debugVideoElements();
  window.forceVideoDetection = () => downloader.forceVideoDetection();
  window.refreshButtons = () => downloader.refreshDownloadButtons();
  window.analyzeOnlyFansStructure = () => downloader.analyzeOnlyFansStructure();
}