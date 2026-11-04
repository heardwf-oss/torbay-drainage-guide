// Fetch once: local Blob playback can seek even when the host ignores Range.
// Reuse this function in the standalone player; it has no external dependencies.
export function prepareSeekableVideo(video, report = () => {}) {
  prepareSeekableVideo.requests ||= new WeakMap();
  if (prepareSeekableVideo.requests.has(video)) return prepareSeekableVideo.requests.get(video);
  const originalUrl = video.currentSrc || video.getAttribute('src') || video.querySelector('source')?.src;
  const state = {time: video.currentTime || 0, volume: video.volume, muted: video.muted, rate: video.playbackRate};
  const captionModes = [...video.textTracks].map(track => track.mode);
  let objectUrl = null, reader = null, inactivityTimer = null, cancelMetadata = () => {};
  const controller = new AbortController();
  const touch = () => {clearTimeout(inactivityTimer);inactivityTimer=setTimeout(()=>controller.abort(),30000);};
  video.dataset.videoPreparing = 'true';
  video.dataset.videoSeekReady = 'false';
  video.pause();
  video.preload = 'none';
  video.removeAttribute('src');
  for (const source of video.querySelectorAll('source')) source.removeAttribute('src');
  video.load();
  const preparation = (async () => {
    try {
      if (!originalUrl) throw new Error('No video source.');
      report('Preparing the video for chapter playback…');
      touch();const response = await fetch(originalUrl, {cache: 'force-cache',signal:controller.signal});touch();
      if (!response.ok) throw new Error('Video download failed.');
      const total = Number(response.headers.get('content-length')) || 0;
      const chunks = [];
      let received = 0, lastPercent = -1;
      if (response.body?.getReader) {
        reader = response.body.getReader();
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          touch();chunks.push(value);
          received += value.byteLength;
          const percent = total ? Math.min(99, Math.floor(received / total * 100)) : -1;
          if (percent >= lastPercent + 5) {
            lastPercent = percent;
            report('Preparing the video for chapter playback… ' + percent + '%.');
          }
        }
      } else {
        chunks.push(await response.arrayBuffer());
      }
      clearTimeout(inactivityTimer);reader?.releaseLock();reader=null;
      const blob = new Blob(chunks, {type: 'video/mp4'});
      if (!blob.size) throw new Error('Empty video download.');
      objectUrl = URL.createObjectURL(blob);
      const metadata = new Promise((resolve, reject) => {
        const timeout = setTimeout(()=>failed(),15000);
        const clear = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', ready);
          video.removeEventListener('error', failed);
        };
        cancelMetadata=clear;
        const ready = () => { clear(); resolve(); };
        const failed = () => { clear(); reject(new Error('Video could not be decoded.')); };
        video.addEventListener('loadedmetadata', ready);
        video.addEventListener('error', failed);
      });
      video.src = objectUrl;
      video.preload = 'metadata';
      video.load();
      await metadata;
      video.volume = state.volume;
      video.muted = state.muted;
      video.playbackRate = state.rate;
      if (state.time) video.currentTime = Math.min(state.time, video.duration || state.time);
      [...video.textTracks].forEach((track, index) => {
        if (captionModes[index]) track.mode = captionModes[index];
      });
      video.dataset.videoSeekReady = 'true';
      report('Video ready. Press Play or choose a chapter.');
      window.addEventListener('pagehide', event => {
        if (!event.persisted) URL.revokeObjectURL(objectUrl);
      });
      return true;
    } catch {
      controller.abort();await reader?.cancel().catch(()=>{});reader?.releaseLock();reader=null;
      prepareSeekableVideo.requests.delete(video);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (originalUrl) {
        video.src = originalUrl;
        video.preload = 'none';
        video.load();
      }
      report('Chapter playback could not be prepared. Play from the beginning or download the video.');
      return false;
    } finally {
      clearTimeout(inactivityTimer);cancelMetadata();
      video.dataset.videoPreparing = 'false';
    }
  })();
  prepareSeekableVideo.requests.set(video, preparation);
  return preparation;
}

const video = document.getElementById('guide-video-player');
const status = document.getElementById('guide-video-status');
const chapters = [...document.querySelectorAll('[data-video-seek]')];

if (video && chapters.length) {
  let requestedTime = null, requestedTitle = '', seeking = false, pendingPlay = null, preparation = null, playRequested = false, fallback = false;
  // Captions start off; a user's later selection is retained through chapter changes.
  for(const track of video.textTracks)track.mode='disabled';
  video.preload='none';
  const report = message => {
    status.textContent = message + (requestedTime !== null && video.dataset.videoPreparing === 'true' ? ' The selected chapter will play when ready.' : '');
  };
  const playChapter = () => {
    if (requestedTime === null || video.dataset.videoSeekReady !== 'true') return;
    const time = requestedTime, title = requestedTitle;
    requestedTime = null;
    seeking = true;
    if (pendingPlay) video.removeEventListener('seeked', pendingPlay);
    const play = () => {
      pendingPlay = null;
      seeking = false;
      video.play().then(() => report('Playing ' + title + '.')).catch(() => {
        report('Chapter selected. Press Play on the video to continue.');
      });
    };
    if (Math.abs(video.currentTime - time) < 0.05) play();
    else {
      pendingPlay = play;
      video.addEventListener('seeked', play, {once: true});
      video.currentTime = time;
    }
  };
  const ensurePrepared = () => {
    if(preparation)return preparation;
    fallback=false;preparation=prepareSeekableVideo(video,report).then(ready=>{
      if(ready){if(requestedTime!==null)playChapter();else if(playRequested)video.play().catch(()=>report('Video ready. Press Play to continue.'));}
      else {fallback=true;requestedTime=null;if(pendingPlay)video.removeEventListener('seeked',pendingPlay);pendingPlay=null;seeking=false;preparation=null;}
      playRequested=false;return ready;
    });return preparation;
  };
  video.addEventListener('pointerdown',()=>{if(!preparation&&!fallback){playRequested=video.paused;ensurePrepared();}},{passive:true});
  video.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)&&!preparation&&!fallback){event.preventDefault();playRequested=true;ensurePrepared();}});
  video.addEventListener('play',()=>{if(video.dataset.videoSeekReady!=='true'&&!fallback){video.pause();playRequested=true;ensurePrepared();}});
  chapters.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    requestedTime = Number(link.dataset.videoSeek);
    requestedTitle = link.lastElementChild.textContent;
    chapters.forEach(item => item.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'true');
    if (video.dataset.videoSeekReady === 'true') playChapter();
    else if (video.dataset.videoPreparing === 'true') report('Preparing the video for chapter playback…');
    else ensurePrepared();
  }));
  video.addEventListener('timeupdate', () => {
    if (requestedTime !== null || seeking) return;
    let current = chapters[0];
    for (const chapter of chapters) {
      if (Number(chapter.dataset.videoSeek) <= video.currentTime) current = chapter;
    }
    for (const chapter of chapters) {
      if (chapter === current) chapter.setAttribute('aria-current', 'true');
      else chapter.removeAttribute('aria-current');
    }
  });
  video.addEventListener('error', () => {
    if (video.dataset.videoPreparing !== 'true') report('The video could not load. Use the download link to watch it.');
  });
}
