/**
 * Picture-in-Picture (PiP) Handler for Facebook Messenger Video Calls
 *
 * This script is injected into the Messenger web page to automatically
 * enable PiP when the user switches to another window/app, and exit PiP
 * when returning to the Messenger window.
 */

(function () {
  "use strict";

  // Configuration
  const CONFIG = {
    // Selectors to find video elements (Messenger uses standard HTML5 video)
    videoSelectors: ["video[srcobject]", "video[src]", "video"],
    // Minimum video dimensions to consider as a call video (not a thumbnail)
    minVideoWidth: 100,
    minVideoHeight: 100,
    // Debounce time for focus/blur change (ms)
    debounceTime: 300,
    // Retry attempts to find video
    maxRetryAttempts: 5,
    retryDelay: 500,
  };

  // State
  let currentPipVideo = null;
  let isHandlingFocusChange = false;
  let focusChangeTimeout = null;
  let isWindowFocused = true;

  /**
   * Check if PiP is supported by the browser
   */
  function isPiPSupported() {
    return (
      "pictureInPictureEnabled" in document && document.pictureInPictureEnabled
    );
  }

  /**
   * Find active video call element
   * Returns the main video element if a video call is active
   */
  function findActiveCallVideo() {
    for (const selector of CONFIG.videoSelectors) {
      const videos = document.querySelectorAll(selector);

      for (const video of videos) {
        // Check if video is playing and has valid dimensions
        if (isActiveCallVideo(video)) {
          console.log("[PiP Handler] Found active video:", video);
          return video;
        }
      }
    }
    return null;
  }

  /**
   * Check if a video element is an active call video
   */
  function isActiveCallVideo(video) {
    if (!video) return false;

    // Must have a source (either srcObject for WebRTC or src)
    const hasSource = video.srcObject || video.src;
    if (!hasSource) {
      console.log("[PiP Handler] Video rejected: no source");
      return false;
    }

    // Check if ended
    if (video.ended) {
      console.log("[PiP Handler] Video rejected: ended");
      return false;
    }

    // Check readyState (must have some data loaded)
    if (video.readyState < 2) {
      console.log(
        "[PiP Handler] Video rejected: readyState =",
        video.readyState,
      );
      return false;
    }

    // Check dimensions - use videoWidth/videoHeight instead of getBoundingClientRect
    // because getBoundingClientRect may return 0 when window is not focused
    const width = video.videoWidth || video.clientWidth || 0;
    const height = video.videoHeight || video.clientHeight || 0;

    console.log(
      "[PiP Handler] Video dimensions:",
      width,
      "x",
      height,
      "paused:",
      video.paused,
    );

    if (width < CONFIG.minVideoWidth || height < CONFIG.minVideoHeight) {
      console.log("[PiP Handler] Video rejected: too small");
      return false;
    }

    // Additional check: video should have video tracks if using MediaStream
    if (video.srcObject instanceof MediaStream) {
      const videoTracks = video.srcObject.getVideoTracks();
      if (
        videoTracks.length === 0 ||
        !videoTracks.some((track) => track.enabled)
      ) {
        console.log("[PiP Handler] Video rejected: no enabled video tracks");
        return false;
      }
    }

    console.log("[PiP Handler] Video accepted!");
    return true;
  }

  /**
   * Enter Picture-in-Picture mode
   */
  async function enterPiP() {
    if (!isPiPSupported()) {
      console.log("[PiP Handler] Picture-in-Picture not supported");
      return false;
    }

    // Don't enter if already in PiP
    if (document.pictureInPictureElement) {
      console.log("[PiP Handler] Already in PiP mode");
      return true;
    }

    const video = findActiveCallVideo();
    if (!video) {
      console.log("[PiP Handler] No active video call found");
      return false;
    }

    // Remove disablePictureInPicture attribute if present (Messenger sets this)
    if (
      video.disablePictureInPicture ||
      video.hasAttribute("disablepictureinpicture")
    ) {
      console.log(
        "[PiP Handler] Removing disablePictureInPicture attribute...",
      );
      video.disablePictureInPicture = false;
      video.removeAttribute("disablepictureinpicture");
    }

    try {
      await video.requestPictureInPicture();
      currentPipVideo = video;
      console.log("[PiP Handler] Entered PiP mode");
      return true;
    } catch (error) {
      console.error("[PiP Handler] Failed to enter PiP:", error);
      return false;
    }
  }

  /**
   * Exit Picture-in-Picture mode
   */
  async function exitPiP() {
    if (!document.pictureInPictureElement) {
      currentPipVideo = null;
      return true;
    }

    try {
      await document.exitPictureInPicture();
      currentPipVideo = null;
      console.log("[PiP Handler] Exited PiP mode");
      return true;
    } catch (error) {
      console.error("[PiP Handler] Failed to exit PiP:", error);
      return false;
    }
  }

  /**
   * Handle focus change with retry logic
   */
  async function handleFocusChangeWithRetry(isFocused, retryCount = 0) {
    console.log(
      "[PiP Handler] Focus changed:",
      isFocused ? "focused" : "blurred",
      "retry:",
      retryCount,
    );

    if (!isFocused) {
      // Window lost focus - try to enter PiP
      const success = await enterPiP();

      // If no video found, retry a few times (video might be loading)
      if (!success && retryCount < CONFIG.maxRetryAttempts) {
        setTimeout(() => {
          if (!isWindowFocused) {
            // Still blurred
            handleFocusChangeWithRetry(false, retryCount + 1);
          }
        }, CONFIG.retryDelay);
      }
    } else {
      // Window gained focus - exit PiP
      await exitPiP();
    }
  }

  /**
   * Handle window blur (lost focus) - debounced
   */
  function handleWindowBlur() {
    console.log("[PiP Handler] Window blur detected");
    isWindowFocused = false;

    // Debounce to avoid rapid toggles
    if (focusChangeTimeout) {
      clearTimeout(focusChangeTimeout);
    }

    focusChangeTimeout = setTimeout(() => {
      if (!isHandlingFocusChange && !isWindowFocused) {
        isHandlingFocusChange = true;
        handleFocusChangeWithRetry(false).finally(() => {
          isHandlingFocusChange = false;
        });
      }
    }, CONFIG.debounceTime);
  }

  /**
   * Handle window focus (gained focus) - debounced
   */
  function handleWindowFocus() {
    console.log("[PiP Handler] Window focus detected");
    isWindowFocused = true;

    // Clear any pending blur timeout
    if (focusChangeTimeout) {
      clearTimeout(focusChangeTimeout);
    }

    // Exit PiP immediately when focused
    if (!isHandlingFocusChange) {
      isHandlingFocusChange = true;
      handleFocusChangeWithRetry(true).finally(() => {
        isHandlingFocusChange = false;
      });
    }
  }

  /**
   * Handle PiP window closed by user
   */
  function handleLeavePiP(event) {
    console.log("[PiP Handler] Left PiP mode");
    currentPipVideo = null;
  }

  /**
   * Setup event listeners for video elements
   */
  function setupVideoListeners(video) {
    video.addEventListener("leavepictureinpicture", handleLeavePiP);

    // Clean up when video ends or is removed
    video.addEventListener("ended", () => {
      if (currentPipVideo === video) {
        exitPiP();
      }
    });
  }

  /**
   * Observe DOM for new video elements
   */
  function observeVideos() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a video
            if (node.tagName === "VIDEO") {
              console.log("[PiP Handler] New video element detected");
              setupVideoListeners(node);
            }
            // Check for video elements inside the added node
            const videos = node.querySelectorAll?.("video");
            videos?.forEach((v) => {
              console.log("[PiP Handler] New nested video element detected");
              setupVideoListeners(v);
            });
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Setup listeners for existing videos
    document.querySelectorAll("video").forEach((video) => {
      console.log("[PiP Handler] Found existing video element");
      setupVideoListeners(video);
    });
  }

  /**
   * Initialize PiP handler
   */
  function init() {
    if (!isPiPSupported()) {
      console.log(
        "[PiP Handler] Picture-in-Picture not supported, skipping initialization",
      );
      return;
    }

    console.log("[PiP Handler] Initializing with blur/focus detection...");

    // Listen for window blur/focus events (works better in Electron than visibilitychange)
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    // Also listen for visibilitychange as fallback
    document.addEventListener("visibilitychange", () => {
      console.log(
        "[PiP Handler] Visibility changed:",
        document.hidden ? "hidden" : "visible",
      );
      if (document.hidden) {
        handleWindowBlur();
      } else {
        handleWindowFocus();
      }
    });

    // Observe DOM for video elements
    observeVideos();

    console.log(
      "[PiP Handler] Initialized successfully with blur/focus + visibility detection",
    );
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
