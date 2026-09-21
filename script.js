(() => {
  'use strict';

  const VIDEO_SOURCE = 'assets/scroll-video.mp4';

  // Choreography: the video uses the entire scroll range.
  // Input B begins rising late in the journey and reaches full-screen at 100%.
  const B_ENTER_START = 0.70;
  const C_FADE_START = 0.56;
  const C_FADE_END = 0.74;

  const body = document.body;
  const page = document.getElementById('page');
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loaderBar');
  const loaderPercent = document.getElementById('loaderPercent');
  const retryButton = document.getElementById('retryButton');
  const story = document.getElementById('scrollStory');
  const video = document.getElementById('scrollVideo');
  const identityPanel = document.getElementById('identityPanel');
  const finalScreen = document.getElementById('finalScreen');
  const scrollCue = document.getElementById('scrollCue');

  let objectUrl = null;
  let videoDuration = 0;
  let rafPending = false;
  let lastViewportWidth = window.innerWidth;
  let destroyed = false;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  function setViewportHeight(force = false) {
    // Mobile browser chrome changes innerHeight while scrolling. Recalculate only for
    // genuine width changes/rotation unless explicitly forced.
    const widthChanged = Math.abs(window.innerWidth - lastViewportWidth) > 40;
    if (!force && !widthChanged) return;

    lastViewportWidth = window.innerWidth;
    document.documentElement.style.setProperty('--viewport-h', `${window.innerHeight}px`);
  }

  function setLoaderProgress(value) {
    const pct = Math.round(clamp(value) * 100);
    loaderBar.style.width = `${pct}%`;
    loaderPercent.textContent = `${pct}%`;
  }

  async function fetchEntireVideo(url) {
    setLoaderProgress(0);
    retryButton.hidden = true;

    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Video request failed (${response.status})`);

    const total = Number(response.headers.get('content-length')) || 0;

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;

        if (total > 0) {
          // Final 6% is reserved for browser decode/seek preparation.
          setLoaderProgress((received / total) * 0.94);
        } else {
          loaderPercent.textContent = `${(received / 1024 / 1024).toFixed(1)} MB`;
          loaderBar.style.width = '65%';
        }
      }

      return new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' });
    }

    const blob = await response.blob();
    setLoaderProgress(0.94);
    return blob;
  }

  function waitForMediaEvent(target, eventName, timeout = 12000) {
    return new Promise((resolve, reject) => {
      let timeoutId = 0;

      const cleanup = () => {
        clearTimeout(timeoutId);
        target.removeEventListener(eventName, done);
        target.removeEventListener('error', fail);
      };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('The video could not be decoded.')); };

      target.addEventListener(eventName, done, { once: true });
      target.addEventListener('error', fail, { once: true });
      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${eventName}.`));
      }, timeout);
    });
  }

  async function primeVideo(blob) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    video.src = objectUrl;
    video.load();

    if (video.readyState < 1) await waitForMediaEvent(video, 'loadedmetadata');
    setLoaderProgress(0.97);

    videoDuration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!videoDuration) throw new Error('The video duration is unavailable.');

    if (video.readyState < 2) await waitForMediaEvent(video, 'loadeddata');

    // Muted play/pause helps Safari/iOS prime the decoder for immediate seeking.
    try {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') await playPromise;
      video.pause();
    } catch (_) {
      video.pause();
    }

    video.currentTime = Math.min(0.001, videoDuration);
    await new Promise(resolve => requestAnimationFrame(resolve));
    setLoaderProgress(1);
  }

  function getStoryProgress() {
    const rect = story.getBoundingClientRect();
    const viewportH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--viewport-h')) || window.innerHeight;
    const travel = Math.max(1, story.offsetHeight - viewportH);
    return clamp(-rect.top / travel);
  }

  function render() {
    rafPending = false;
    if (!videoDuration || destroyed) return;

    const progress = getStoryProgress();
    const targetTime = progress * videoDuration;

    // The file is blob-backed and fully downloaded before this runs.
    if (Math.abs(video.currentTime - targetTime) > 0.012) {
      try { video.currentTime = targetTime; } catch (_) { /* next frame retries */ }
    }

    // Input C remains at the bottom, then lifts and fades as B arrives.
    const cFade = clamp((progress - C_FADE_START) / (C_FADE_END - C_FADE_START));
    const cScale = 1 - (cFade * 0.035);
    identityPanel.style.opacity = String(1 - cFade);
    identityPanel.style.transform = `translate3d(-50%, ${-22 * cFade}px, 0) scale(${cScale})`;

    // Input B reaches exactly 100% coverage at the final video frame.
    const bProgress = clamp((progress - B_ENTER_START) / (1 - B_ENTER_START));
    finalScreen.style.transform = `translate3d(0, ${(1 - bProgress) * 100}%, 0)`;

    scrollCue.style.opacity = String(clamp(1 - progress * 8));
  }

  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(render);
  }

  async function revealPage() {
    await new Promise(resolve => setTimeout(resolve, 140));
    page.setAttribute('aria-hidden', 'false');
    body.classList.remove('is-loading');
    loader.classList.add('is-hidden');
    requestRender();
  }

  function showLoadError(error) {
    console.error(error);
    loaderBar.style.width = '0%';
    loaderPercent.textContent = 'Could not load video';
    retryButton.hidden = false;
  }

  async function init() {
    setViewportHeight(true);

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    try {
      const blob = await fetchEntireVideo(VIDEO_SOURCE);
      await primeVideo(blob);
      await revealPage();
    } catch (error) {
      showLoadError(error);
    }
  }

  document.querySelectorAll('[data-coming-soon]').forEach(link => {
    link.addEventListener('click', event => event.preventDefault());
  });

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', () => {
    setViewportHeight(false);
    requestRender();
  }, { passive: true });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      setViewportHeight(true);
      requestRender();
    }, 180);
  }, { passive: true });

  retryButton.addEventListener('click', () => {
    retryButton.hidden = true;
    loaderPercent.textContent = '0%';
    init();
  });

  window.addEventListener('pagehide', () => {
    destroyed = true;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, { once: true });

  init();
})();
