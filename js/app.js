/**
 * Main Application Orchestrator & UI Binding
 * Antigravity - Premium Music Streaming Web App
 */

import { player, REPEAT_MODES } from './player.js';
import { router } from './router.js';
import { library } from './library.js';
import { localMusic } from './localMusic.js';
import { cloudUploads } from './uploads.js';
import { auth } from './auth.js';
import { musicApi } from './api.js';
import { pwa } from './pwa.js';

// Expose pwa instance globally for buttons
window.pwaInstance = pwa;

// Global track registry to resolve tracks by ID across modules
function findTrackById(id) {
  // Check player queue
  let track = player.queue.find(t => t.id === id);
  if (track) return track;

  // Check last search results
  if (window._lastSearchResults) {
    track = window._lastSearchResults.find(t => t.id === id);
    if (track) return track;
  }

  // Check curated catalog
  const featured = musicApi.getFeatured();
  if (Array.isArray(featured)) {
    track = featured.find(t => t.id === id);
    if (track) return track;
  }

  // Check liked songs
  track = library.getState().likedSongs.find(t => t.id === id);
  if (track) return track;

  // Check playlists
  for (const pl of library.getState().playlists) {
    track = (pl.tracks || []).find(t => t.id === id);
    if (track) return track;
  }

  // Check local music
  track = localMusic.getTracks().find(t => t.id === id);
  if (track) return track;

  // Check uploads
  track = cloudUploads.getTracks().find(t => t.id === id);
  if (track) return track;

  return null;
}

document.addEventListener('DOMContentLoaded', async () => {
  const viewContainer = document.getElementById('view-container');
  router.init(viewContainer);

  // Initialize UI Bindings
  initPlayerBindings();
  initSidebarBindings();
  initModalBindings();
  initKeyboardShortcuts();
  initToast();

  // Listen for provider status change
  musicApi.onStatusChange((status) => {
    const providerNameEl = document.getElementById('topbar-provider-name');
    const providerDot = document.getElementById('topbar-provider-dot');
    if (providerNameEl) providerNameEl.textContent = status.provider;
    if (providerDot) {
      providerDot.className = 'provider-dot' + (status.online ? '' : ' fallback');
    }
  });

  // Listen for auth state change
  auth.subscribe((user) => {
    const userNameEl = document.getElementById('sidebar-user-name');
    const userStatusEl = document.getElementById('sidebar-user-status');
    if (userNameEl) userNameEl.textContent = user?.displayName || (user?.isAnonymous ? 'Anonymous Listener' : 'Listener');
    if (userStatusEl) userStatusEl.textContent = user?.isAnonymous ? 'Firebase Anonymous' : 'Registered Member';
  });

  // Listen for library playlists change to update sidebar
  library.subscribe(({ playlists }) => {
    const list = document.getElementById('sidebar-playlists');
    if (list) {
      list.innerHTML = playlists.map(pl => `
        <div class="sidebar-playlist-item truncate" onclick="window.location.hash='playlist/${pl.id}'">
          <i class="hgi-stroke hgi-playlist-01" style="font-size: 15px; color: var(--text-muted);"></i>
          <span class="truncate">${escapeHtml(pl.name)}</span>
        </div>
      `).join('');
    }
  });

  // Auto-load default curated track in player so it's ready on first user tap
  const featured = await musicApi.getFeatured();
  if (featured && featured.length > 0 && !player.currentTrack) {
    player.queue = [...featured];
    player.currentTrack = featured[0];
    player.currentIndex = 0;
    updatePlayerUI(player.getState());
  }
});

/* ==========================================================================
   PLAYER UI BINDINGS & STATE SYNC
   ========================================================================== */
function initPlayerBindings() {
  const btnPlayMain = document.getElementById('btn-play-main');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  const btnLike = document.getElementById('player-like-btn');
  const btnVolumeMute = document.getElementById('btn-volume-mute');
  const volumeSlider = document.getElementById('volume-slider');
  const btnQueue = document.getElementById('btn-queue');
  const queuePanel = document.getElementById('queue-panel');
  const queueCloseBtn = document.getElementById('queue-close-btn');

  // Timeline Scrubber
  const timelineContainer = document.getElementById('timeline-slider');

  timelineContainer?.addEventListener('click', (e) => {
    const rect = timelineContainer.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    const targetSeconds = ratio * (player.duration || 0);
    player.seek(targetSeconds);
  });

  // Control clicks
  btnPlayMain?.addEventListener('click', () => player.togglePlay());
  btnPrev?.addEventListener('click', () => player.previous());
  btnNext?.addEventListener('click', () => player.next());
  btnShuffle?.addEventListener('click', () => player.toggleShuffle());
  btnRepeat?.addEventListener('click', () => player.cycleRepeat());

  btnLike?.addEventListener('click', () => {
    if (player.currentTrack) {
      const liked = library.toggleLike(player.currentTrack);
      btnLike.classList.toggle('liked', liked);
      showAppToast(liked ? 'Saved to Liked Songs' : 'Removed from Liked Songs', 'info');
    }
  });

  btnVolumeMute?.addEventListener('click', () => player.toggleMute());

  volumeSlider?.addEventListener('input', (e) => {
    player.setVolume(parseFloat(e.target.value));
  });

  // Queue Panel toggle
  btnQueue?.addEventListener('click', () => {
    queuePanel?.classList.toggle('open');
    renderQueuePanel();
  });

  queueCloseBtn?.addEventListener('click', () => {
    queuePanel?.classList.remove('open');
  });

  // Mobile Mini-Player & Fullscreen Sheet
  const miniPlayer = document.getElementById('mobile-mini-player');
  const miniPlayBtn = document.getElementById('m-mini-play');
  const mobileNowPlaying = document.getElementById('mobile-now-playing');
  const mnpClose = document.getElementById('mnp-close');
  const mnpPlay = document.getElementById('mnp-play');
  const mnpPrev = document.getElementById('mnp-prev');
  const mnpNext = document.getElementById('mnp-next');
  const mnpShuffle = document.getElementById('mnp-shuffle');
  const mnpRepeat = document.getElementById('mnp-repeat');
  const mnpTimeline = document.getElementById('mnp-timeline-slider');

  miniPlayBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    player.togglePlay();
  });

  miniPlayer?.addEventListener('click', () => {
    mobileNowPlaying?.classList.add('open');
  });

  mnpClose?.addEventListener('click', () => {
    mobileNowPlaying?.classList.remove('open');
  });

  mnpPlay?.addEventListener('click', () => player.togglePlay());
  mnpPrev?.addEventListener('click', () => player.previous());
  mnpNext?.addEventListener('click', () => player.next());
  mnpShuffle?.addEventListener('click', () => player.toggleShuffle());
  mnpRepeat?.addEventListener('click', () => player.cycleRepeat());

  mnpTimeline?.addEventListener('click', (e) => {
    const rect = mnpTimeline.getBoundingClientRect();
    const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
    const targetSeconds = ratio * (player.duration || 0);
    player.seek(targetSeconds);
  });

  // Subscribe to Player engine changes
  player.subscribe((state, eventType) => {
    updatePlayerUI(state);
    if (eventType === 'queuechange' || eventType === 'trackchange') {
      renderQueuePanel();
      if (state.currentTrack) {
        library.addRecentlyPlayed(state.currentTrack);
      }
    }
  });
}

function updatePlayerUI(state) {
  const { currentTrack, isPlaying, isLoading, currentTime, duration, volume, isMuted, isShuffle, repeatMode } = state;

  // 1. Desktop Track Metadata
  const artImg = document.getElementById('player-artwork-img');
  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');
  const likeBtn = document.getElementById('player-like-btn');
  const btnPlayMain = document.getElementById('btn-play-main');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  const volumeSlider = document.getElementById('volume-slider');
  const btnVolumeMute = document.getElementById('btn-volume-mute');

  if (currentTrack) {
    if (artImg) artImg.src = currentTrack.artwork || './assets/images/default-cover.svg';
    if (titleEl) titleEl.textContent = currentTrack.title;
    if (artistEl) artistEl.textContent = currentTrack.artist;
    if (likeBtn) likeBtn.classList.toggle('liked', library.isLiked(currentTrack.id));
  }

  // Play / Pause Icon
  if (btnPlayMain) {
    btnPlayMain.innerHTML = isLoading
      ? '<i class="hgi-stroke hgi-loading-02 animate-spin"></i>'
      : isPlaying
      ? '<i class="hgi-stroke hgi-pause"></i>'
      : '<i class="hgi-stroke hgi-play"></i>';
  }

  // Shuffle & Repeat states
  if (btnShuffle) btnShuffle.classList.toggle('active', isShuffle);
  if (btnRepeat) {
    btnRepeat.classList.toggle('active', repeatMode !== REPEAT_MODES.OFF);
    btnRepeat.innerHTML = repeatMode === REPEAT_MODES.ONE
      ? '<i class="hgi-stroke hgi-repeat-one-01"></i>'
      : '<i class="hgi-stroke hgi-repeat"></i>';
  }

  // Scrubber Progress & Times
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');
  const progressEl = document.getElementById('timeline-progress');
  const thumbEl = document.getElementById('timeline-thumb');

  if (timeCurrent) timeCurrent.textContent = formatDuration(currentTime);
  if (timeTotal) timeTotal.textContent = formatDuration(duration);

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
  if (progressEl) progressEl.style.width = `${percent}%`;
  if (thumbEl) thumbEl.style.left = `${percent}%`;

  // Volume
  if (volumeSlider) volumeSlider.value = isMuted ? 0 : volume;
  if (btnVolumeMute) {
    const volIcon = isMuted || volume === 0
      ? 'hgi-volume-mute-01'
      : volume < 0.5
      ? 'hgi-volume-low'
      : 'hgi-volume-high';
    btnVolumeMute.innerHTML = `<i class="hgi-stroke ${volIcon}"></i>`;
  }

  // 2. Mobile Mini-Player Sync
  const miniPlayer = document.getElementById('mobile-mini-player');
  const mArt = document.getElementById('m-mini-art');
  const mTitle = document.getElementById('m-mini-title');
  const mArtist = document.getElementById('m-mini-artist');
  const mPlay = document.getElementById('m-mini-play');

  if (miniPlayer && currentTrack) {
    miniPlayer.classList.add('has-track');
    if (mArt) mArt.src = currentTrack.artwork || './assets/images/default-cover.svg';
    if (mTitle) mTitle.textContent = currentTrack.title;
    if (mArtist) mArtist.textContent = currentTrack.artist;
    if (mPlay) {
      mPlay.innerHTML = isLoading
        ? '<i class="hgi-stroke hgi-loading-02 animate-spin"></i>'
        : isPlaying
        ? '<i class="hgi-stroke hgi-pause"></i>'
        : '<i class="hgi-stroke hgi-play"></i>';
    }
  }

  // 3. Mobile Now-Playing Sheet Sync
  const mnpArt = document.getElementById('mnp-art');
  const mnpTitle = document.getElementById('mnp-title');
  const mnpArtist = document.getElementById('mnp-artist');
  const mnpPlay = document.getElementById('mnp-play');
  const mnpShuffle = document.getElementById('mnp-shuffle');
  const mnpRepeat = document.getElementById('mnp-repeat');
  const mnpCurrent = document.getElementById('mnp-time-current');
  const mnpTotal = document.getElementById('mnp-time-total');
  const mnpProgress = document.getElementById('mnp-timeline-progress');
  const mnpThumb = document.getElementById('mnp-timeline-thumb');

  if (currentTrack) {
    if (mnpArt) mnpArt.src = currentTrack.artwork || './assets/images/default-cover.svg';
    if (mnpTitle) mnpTitle.textContent = currentTrack.title;
    if (mnpArtist) mnpArtist.textContent = currentTrack.artist;
  }
  if (mnpPlay) {
    mnpPlay.innerHTML = isPlaying
      ? '<i class="hgi-stroke hgi-pause"></i>'
      : '<i class="hgi-stroke hgi-play"></i>';
  }
  if (mnpShuffle) mnpShuffle.classList.toggle('active', isShuffle);
  if (mnpRepeat) mnpRepeat.classList.toggle('active', repeatMode !== REPEAT_MODES.OFF);
  if (mnpCurrent) mnpCurrent.textContent = formatDuration(currentTime);
  if (mnpTotal) mnpTotal.textContent = formatDuration(duration);
  if (mnpProgress) mnpProgress.style.width = `${percent}%`;
  if (mnpThumb) mnpThumb.style.left = `${percent}%`;

  // Highlight active row in current view
  document.querySelectorAll('.track-row').forEach(row => {
    const isRowCurrent = row.getAttribute('data-track-id') === currentTrack?.id;
    row.classList.toggle('active', isRowCurrent);
  });
}

function renderQueuePanel() {
  const list = document.getElementById('queue-items-list');
  if (!list) return;

  if (player.queue.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding: 40px 10px;">
        <div class="empty-state-icon"><i class="hgi-stroke hgi-menu-01"></i></div>
        <div class="empty-state-title">Queue is empty</div>
        <div class="empty-state-desc">Play tracks or add them to queue to listen uninterrupted.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = player.queue.map((track, idx) => {
    const isCurrent = idx === player.currentIndex;
    return `
      <div class="queue-item ${isCurrent ? 'active' : ''}" onclick="window.playQueueIndex(${idx})">
        <img class="queue-item-art" src="${track.artwork || './assets/images/default-cover.svg'}" alt="${escapeHtml(track.title)}">
        <div class="queue-item-meta truncate">
          <div class="queue-item-title truncate">${escapeHtml(track.title)}</div>
          <div class="queue-item-artist truncate">${escapeHtml(track.artist)}</div>
        </div>
        <button class="btn-icon queue-remove-btn" onclick="event.stopPropagation(); window.removeFromQueueIndex(${idx})" aria-label="Remove from queue">
          <i class="hgi-stroke hgi-cancel-01"></i>
        </button>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   GLOBAL ACTIONS
   ========================================================================== */
window.autoScanMobileMusic = async () => {
  showAppToast('Opening device audio selector...', 'info');
  try {
    const added = await localMusic.scanDeviceMusic();
    if (added && added.length > 0) {
      showAppToast(`Auto-scanned ${added.length} track(s) from device! Saved to IndexedDB.`, 'success');
      router.renderCurrentView();
    } else {
      showAppToast('No new audio tracks selected', 'info');
    }
  } catch (err) {
    showAppToast(`Device scan error: ${err.message}`, 'error');
  }
};

window.playSingleTrack = async (trackId) => {
  const track = findTrackById(trackId);
  if (track) {
    await player.loadAndPlay(track);
  }
};

window.playTrackFromList = async (trackId) => {
  const track = findTrackById(trackId);
  if (track) {
    if (window._lastSearchResults?.some(t => t.id === trackId)) {
      const idx = window._lastSearchResults.findIndex(t => t.id === trackId);
      await player.playQueue(window._lastSearchResults, idx);
      return;
    }
    await player.loadAndPlay(track);
  }
};

window.playPlaylistDirect = async (playlistId) => {
  const pl = library.getPlaylist(playlistId);
  if (pl?.tracks?.length > 0) {
    await player.playQueue(pl.tracks, 0);
  } else {
    showAppToast('Playlist is empty. Add songs first!', 'warning');
  }
};

window.shufflePlaylistDirect = async (playlistId) => {
  const pl = library.getPlaylist(playlistId);
  if (pl?.tracks?.length > 0) {
    if (!player.isShuffle) player.toggleShuffle();
    await player.playQueue(pl.tracks, Math.floor(Math.random() * pl.tracks.length));
  }
};

window.playLikedDirect = async () => {
  const { likedSongs } = library.getState();
  if (likedSongs.length > 0) {
    await player.playQueue(likedSongs, 0);
  } else {
    showAppToast('No liked songs yet!', 'warning');
  }
};

window.toggleTrackLike = (trackId) => {
  const track = findTrackById(trackId);
  if (track) {
    const liked = library.toggleLike(track);
    showAppToast(liked ? 'Saved to Liked Songs' : 'Removed from Liked Songs', 'info');
    document.querySelectorAll(`.track-row[data-track-id="${trackId}"] .track-like-btn`).forEach(btn => {
      btn.classList.toggle('liked', liked);
    });
    if (player.currentTrack?.id === trackId) {
      document.getElementById('player-like-btn')?.classList.toggle('liked', liked);
    }
  }
};

window.playQueueIndex = async (idx) => {
  if (idx >= 0 && idx < player.queue.length) {
    player.currentIndex = idx;
    await player.loadAndPlay(player.queue[idx]);
  }
};

window.removeFromQueueIndex = (idx) => {
  player.removeFromQueue(idx);
};

// Track Context Menu
window.openTrackMenu = (trackId, playlistId, e) => {
  const track = findTrackById(trackId);
  if (!track) return;

  const existingMenu = document.getElementById('track-context-menu');
  if (existingMenu) existingMenu.remove();

  const menu = document.createElement('div');
  menu.id = 'track-context-menu';
  menu.style.position = 'fixed';
  menu.style.zIndex = '300';
  menu.style.backgroundColor = 'var(--bg-card)';
  menu.style.border = '1px solid var(--border-subtle)';
  menu.style.borderRadius = 'var(--radius-md)';
  menu.style.boxShadow = '0 12px 28px rgba(0,0,0,0.6)';
  menu.style.padding = '6px';
  menu.style.minWidth = '200px';

  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY, window.innerHeight - 200);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const playlists = library.getState().playlists;

  menu.innerHTML = `
    <button class="nav-link" style="width: 100%; border-radius: 4px; padding: 8px 10px; font-size: 13px;" onclick="window.addTrackToQueueNext('${trackId}')">
      <i class="hgi-stroke hgi-menu-01" style="font-size: 16px;"></i> Play Next
    </button>
    <button class="nav-link" style="width: 100%; border-radius: 4px; padding: 8px 10px; font-size: 13px;" onclick="window.addTrackToQueueEnd('${trackId}')">
      <i class="hgi-stroke hgi-add-01" style="font-size: 16px;"></i> Add to Queue
    </button>
    <div style="height: 1px; background: var(--border-light); margin: 4px 0;"></div>
    <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); padding: 4px 10px; text-transform: uppercase;">Add to Playlist</div>
    ${playlists.map(pl => `
      <button class="nav-link" style="width: 100%; border-radius: 4px; padding: 6px 10px; font-size: 12.5px;" onclick="window.addTrackToSpecificPlaylist('${pl.id}', '${trackId}')">
        <i class="hgi-stroke hgi-playlist-01" style="font-size: 14px;"></i>
        <span class="truncate">${escapeHtml(pl.name)}</span>
      </button>
    `).join('')}
    ${playlistId ? `
      <div style="height: 1px; background: var(--border-light); margin: 4px 0;"></div>
      <button class="nav-link" style="width: 100%; border-radius: 4px; padding: 8px 10px; font-size: 13px; color: var(--color-error);" onclick="window.removeTrackFromSpecificPlaylist('${playlistId}', '${trackId}')">
        <i class="hgi-stroke hgi-delete-02" style="font-size: 16px;"></i> Remove from playlist
      </button>
    ` : ''}
  `;

  document.body.appendChild(menu);

  const closeMenu = (evt) => {
    if (!menu.contains(evt.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 50);
};

window.addTrackToQueueNext = (trackId) => {
  const track = findTrackById(trackId);
  if (track) {
    player.addToQueueNext(track);
    showAppToast(`"${track.title}" will play next`, 'success');
  }
};

window.addTrackToQueueEnd = (trackId) => {
  const track = findTrackById(trackId);
  if (track) {
    player.addToQueue(track);
    showAppToast(`"${track.title}" added to queue`, 'success');
  }
};

window.addTrackToSpecificPlaylist = (playlistId, trackId) => {
  const track = findTrackById(trackId);
  if (track) {
    const success = library.addTrackToPlaylist(playlistId, track);
    const pl = library.getPlaylist(playlistId);
    showAppToast(success ? `Added to "${pl.name}"` : 'Track already in playlist', success ? 'success' : 'info');
  }
};

window.removeTrackFromSpecificPlaylist = (playlistId, trackId) => {
  library.removeTrackFromPlaylist(playlistId, trackId);
  showAppToast('Track removed from playlist', 'info');
  router.renderPlaylist(playlistId);
};

/* ==========================================================================
   MODAL CONTROLLERS
   ========================================================================== */
function initModalBindings() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });

  const plForm = document.getElementById('modal-playlist-form');
  plForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('modal-pl-name').value;
    const desc = document.getElementById('modal-pl-desc').value;
    const artwork = document.getElementById('modal-pl-art').value;

    const editId = plForm.getAttribute('data-edit-id');
    if (editId) {
      library.updatePlaylist(editId, { name, description: desc, artwork });
      showAppToast('Playlist updated!', 'success');
      router.renderPlaylist(editId);
    } else {
      const created = library.createPlaylist(name, desc, artwork);
      showAppToast(`Created "${created.name}"`, 'success');
      window.location.hash = `playlist/${created.id}`;
    }
    document.getElementById('modal-playlist')?.classList.remove('open');
  });

  const uploadForm = document.getElementById('modal-upload-form');
  uploadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const audioInput = document.getElementById('modal-upload-audio');
    const artInput = document.getElementById('modal-upload-artwork');
    const title = document.getElementById('modal-upload-title').value;
    const artist = document.getElementById('modal-upload-artist').value;
    const album = document.getElementById('modal-upload-album').value;

    const audioFile = audioInput?.files?.[0];
    if (!audioFile) {
      showAppToast('Please select an audio file to upload', 'error');
      return;
    }

    const progressBox = document.getElementById('upload-progress-box');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-text');
    const submitBtn = document.getElementById('modal-upload-submit');

    progressBox.style.display = 'block';
    submitBtn.disabled = true;

    try {
      await cloudUploads.uploadTrack({
        audioFile,
        artworkFile: artInput?.files?.[0] || null,
        title,
        artist,
        album,
        onProgress: (pct, msg) => {
          if (progressFill) progressFill.style.width = `${pct}%`;
          if (progressText) progressText.textContent = msg;
        }
      });

      showAppToast('Track uploaded to Cloudinary successfully!', 'success');
      document.getElementById('modal-upload')?.classList.remove('open');
      uploadForm.reset();
      progressBox.style.display = 'none';
      if (router.currentRoute === 'uploads') router.renderUploads();
    } catch (err) {
      showAppToast(`Upload error: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const authForm = document.getElementById('modal-auth-form');
  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = authForm.getAttribute('data-auth-mode');
    const email = document.getElementById('modal-auth-email').value;
    const password = document.getElementById('modal-auth-pass').value;
    const name = document.getElementById('modal-auth-name')?.value;

    try {
      if (mode === 'signup') {
        await auth.signUp(email, password, name);
        showAppToast('Account created successfully!', 'success');
      } else {
        await auth.login(email, password);
        showAppToast('Logged in successfully!', 'success');
      }
      document.getElementById('modal-auth')?.classList.remove('open');
      if (router.currentRoute === 'settings') router.renderSettings();
    } catch (err) {
      showAppToast(`Authentication failed: ${err.message}`, 'error');
    }
  });
}

window.openCreatePlaylistModal = () => {
  const modal = document.getElementById('modal-playlist');
  const title = document.getElementById('modal-playlist-title');
  const form = document.getElementById('modal-playlist-form');
  if (modal && form) {
    title.textContent = 'Create New Playlist';
    form.removeAttribute('data-edit-id');
    form.reset();
    modal.classList.add('open');
  }
};

window.openEditPlaylistModal = (id) => {
  const pl = library.getPlaylist(id);
  if (!pl) return;
  const modal = document.getElementById('modal-playlist');
  const title = document.getElementById('modal-playlist-title');
  const form = document.getElementById('modal-playlist-form');

  if (modal && form) {
    title.textContent = 'Edit Playlist';
    form.setAttribute('data-edit-id', id);
    document.getElementById('modal-pl-name').value = pl.name;
    document.getElementById('modal-pl-desc').value = pl.description || '';
    document.getElementById('modal-pl-art').value = pl.artwork || '';
    modal.classList.add('open');
  }
};

window.confirmDeletePlaylist = (id) => {
  const pl = library.getPlaylist(id);
  if (!pl) return;
  if (confirm(`Are you sure you want to delete "${pl.name}"?`)) {
    library.deletePlaylist(id);
    showAppToast(`Deleted "${pl.name}"`, 'info');
    window.location.hash = 'library';
  }
};

window.openUploadModal = () => {
  const modal = document.getElementById('modal-upload');
  modal?.classList.add('open');
};

window.openAuthModal = (mode = 'login') => {
  const modal = document.getElementById('modal-auth');
  const form = document.getElementById('modal-auth-form');
  const title = document.getElementById('modal-auth-title');
  const nameGroup = document.getElementById('modal-auth-name-group');
  const submitBtn = document.getElementById('modal-auth-submit');

  if (modal && form) {
    form.setAttribute('data-auth-mode', mode);
    if (mode === 'signup') {
      title.textContent = 'Create Musics Account';
      nameGroup.style.display = 'flex';
      submitBtn.textContent = 'Sign Up';
    } else {
      title.textContent = 'Log In to Musics';
      nameGroup.style.display = 'none';
      submitBtn.textContent = 'Log In';
    }
    modal.classList.add('open');
  }
};

window.handleLogout = async () => {
  if (confirm('Log out from your current account?')) {
    await auth.logout();
    showAppToast('Logged out (Reverted to Firebase Anonymous Session)', 'info');
    if (router.currentRoute === 'settings') router.renderSettings();
  }
};

/* ==========================================================================
   KEYBOARD SHORTCUTS
   ========================================================================== */
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        player.togglePlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        player.seek(player.currentTime + 5);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        player.seek(player.currentTime - 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        player.setVolume(player.volume + 0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        player.setVolume(player.volume - 0.05);
        break;
      case 'KeyM':
        player.toggleMute();
        break;
      case 'KeyL':
        if (player.currentTrack) {
          window.toggleTrackLike(player.currentTrack.id);
        }
        break;
    }
  });
}

function initSidebarBindings() {
  const btnInstall = document.getElementById('sidebar-install-btn');
  if (btnInstall && pwa) {
    pwa.registerInstallButton(btnInstall);
  }
}

/* ==========================================================================
   TOAST NOTIFICATION ENGINE
   ========================================================================== */
function initToast() {
  window.showAppToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'hgi-alert-circle';
    if (type === 'success') iconClass = 'hgi-checkmark-circle-01';
    else if (type === 'error') iconClass = 'hgi-alert-circle';

    toast.innerHTML = `
      <i class="hgi-stroke ${iconClass}"></i>
      <span style="flex: 1;">${escapeHtml(msg)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  };
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
