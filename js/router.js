/**
 * Application Router & Page Views Renderer
 * Preserves continuous background playback during all page transitions
 * Includes Mobile & PWA Device Music Auto-Scanner
 */

import { musicApi } from './api.js';
import { player } from './player.js';
import { library } from './library.js';
import { localMusic } from './localMusic.js';
import { cloudUploads } from './uploads.js';
import { auth } from './auth.js';
import { firebaseService } from './firebase.js';
import { bhariyaMusicProvider } from './providers/bhariyamusic.js';

class AppRouter {
  constructor() {
    this.container = null;
    this.currentRoute = 'home';
    this.routeParams = {};
  }

  init(containerElement) {
    this.container = containerElement;
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();
  }

  navigate(route) {
    window.location.hash = route;
  }

  handleHashChange() {
    const rawHash = window.location.hash.replace(/^#\/?/, '') || 'home';
    const [route, param] = rawHash.split('/');

    this.currentRoute = route || 'home';
    this.routeParams = { id: param };

    // Update active nav links in sidebar and mobile nav
    document.querySelectorAll('[data-route]').forEach(el => {
      const match = el.getAttribute('data-route') === this.currentRoute;
      el.classList.toggle('active', match);
    });

    // Update breadcrumb
    const breadcrumb = document.getElementById('topbar-breadcrumb');
    if (breadcrumb) {
      breadcrumb.textContent = this._formatRouteTitle(this.currentRoute, param);
    }

    this.renderCurrentView();
  }

  _formatRouteTitle(route, param) {
    const map = {
      home: 'Home',
      search: 'Search & Browse',
      discover: 'Discover',
      library: 'Your Library',
      liked: 'Liked Songs',
      history: 'Recently Played',
      local: 'Local Music Import',
      uploads: 'Cloud Uploads',
      settings: 'Settings & Integrations',
      playlist: 'Playlist Details'
    };
    return map[route] || 'Home';
  }

  renderCurrentView() {
    if (!this.container) return;

    this.container.scrollTop = 0;

    switch (this.currentRoute) {
      case 'home':
        this.renderHome();
        break;
      case 'search':
        this.renderSearch();
        break;
      case 'discover':
        this.renderDiscover();
        break;
      case 'library':
        this.renderLibrary();
        break;
      case 'liked':
        this.renderLiked();
        break;
      case 'history':
        this.renderHistory();
        break;
      case 'local':
        this.renderLocal();
        break;
      case 'uploads':
        this.renderUploads();
        break;
      case 'playlist':
        this.renderPlaylist(this.routeParams.id);
        break;
      case 'settings':
        this.renderSettings();
        break;
      default:
        this.renderHome();
    }
  }

  /* ========================================================================
     HOME VIEW
     ======================================================================== */
  async renderHome() {
    const user = auth.getUser();
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';

    const playlists = library.getState().playlists;
    const recentlyPlayed = library.getState().recentlyPlayed.slice(0, 6);
    const uploadedTracks = cloudUploads.getTracks().slice(0, 4);
    const localTracks = localMusic.getTracks();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    this.container.innerHTML = `
      <!-- Greeting Header -->
      <div class="page-section" style="margin-bottom: 20px;">
        <h1 class="text-h1" style="margin-bottom: 6px;">${greeting}, ${user?.displayName || 'Listener'}</h1>
        <p class="text-body">Explore verified music from BhariyaMusic API, curated streams, and your private collection.</p>
      </div>

      <!-- Mobile & PWA Device Music Auto-Scan Banner -->
      <div style="background: linear-gradient(135deg, #1d2814, #141b0d); border: 1px solid var(--accent-border); border-radius: var(--radius-lg); padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 14px; min-width: 220px; flex: 1;">
          <div style="width: 44px; height: 44px; border-radius: 9999px; background: var(--accent-dim); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            <i class="hgi-stroke hgi-smart-phone-01"></i>
          </div>
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 14px; margin-bottom: 2px;">
              Device Music Auto-Sync ${isStandalone ? '<span class="brand-badge">PWA ACTIVE</span>' : ''}
            </div>
            <div class="text-caption">
              ${localTracks.length > 0 ? `Loaded <strong>${localTracks.length} local song(s)</strong> stored permanently in IndexedDB.` : 'Scan your mobile or computer storage to auto-load all your local MP3s for offline play.'}
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          ${localTracks.length > 0 ? `
            <button class="btn btn-secondary btn-sm" onclick="window.playLocalAll()">
              <i class="hgi-stroke hgi-play"></i> Play Local (${localTracks.length})
            </button>
          ` : ''}
          <button class="btn btn-primary btn-sm" onclick="window.autoScanMobileMusic()">
            <i class="hgi-stroke hgi-cloud-download"></i> ${localTracks.length > 0 ? 'Scan More Songs' : 'Auto-Scan Device Music'}
          </button>
        </div>
      </div>

      <!-- Quick Playlists Grid -->
      <div class="quick-grid">
        <div class="quick-card" onclick="window.location.hash='liked'">
          <img class="quick-card-art" src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=100&auto=format&fit=crop&q=80" alt="Liked Songs">
          <span class="quick-card-title">Liked Songs</span>
          <button class="quick-card-play" aria-label="Play Liked Songs"><i class="hgi-stroke hgi-play"></i></button>
        </div>
        ${playlists.slice(0, 5).map(pl => `
          <div class="quick-card" onclick="window.location.hash='playlist/${pl.id}'">
            <img class="quick-card-art" src="${pl.artwork || './assets/images/default-cover.svg'}" alt="${this.escapeHtml(pl.name)}">
            <span class="quick-card-title truncate">${this.escapeHtml(pl.name)}</span>
            <button class="quick-card-play" onclick="event.stopPropagation(); window.playPlaylistDirect('${pl.id}')" aria-label="Play ${this.escapeHtml(pl.name)}"><i class="hgi-stroke hgi-play"></i></button>
          </div>
        `).join('')}
      </div>

      <!-- Recently Played Section -->
      ${recentlyPlayed.length > 0 ? `
        <div class="page-section">
          <div class="section-header">
            <h2 class="section-title">Recently Played</h2>
            <span class="section-link" onclick="window.location.hash='history'">Show all</span>
          </div>
          <div class="cards-grid">
            ${recentlyPlayed.map(track => this._renderMusicCard(track)).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Featured Selections -->
      <div class="page-section">
        <div class="section-header">
          <h2 class="section-title">Featured Selections</h2>
          <span class="text-caption">Instant streaming audio</span>
        </div>
        <div class="cards-grid" id="home-featured-grid">
          <div class="skeleton" style="height: 220px;"></div>
          <div class="skeleton" style="height: 220px;"></div>
          <div class="skeleton" style="height: 220px;"></div>
          <div class="skeleton" style="height: 220px;"></div>
        </div>
      </div>

      <!-- Trending Section -->
      <div class="page-section">
        <div class="section-header">
          <h2 class="section-title">Trending Tracks</h2>
          <span class="section-link" onclick="window.location.hash='search'">Search more</span>
        </div>
        <div class="tracks-list" id="home-trending-list">
          <div class="skeleton" style="height: 52px;"></div>
          <div class="skeleton" style="height: 52px;"></div>
          <div class="skeleton" style="height: 52px;"></div>
        </div>
      </div>

      <!-- Cloud Uploads Preview -->
      ${uploadedTracks.length > 0 ? `
        <div class="page-section">
          <div class="section-header">
            <h2 class="section-title">Cloudinary Uploads</h2>
            <span class="section-link" onclick="window.location.hash='uploads'">View all</span>
          </div>
          <div class="cards-grid">
            ${uploadedTracks.map(track => this._renderMusicCard(track)).join('')}
          </div>
        </div>
      ` : ''}
    `;

    try {
      const featured = await musicApi.getFeatured();
      const featuredGrid = document.getElementById('home-featured-grid');
      if (featuredGrid) {
        featuredGrid.innerHTML = featured.map(track => this._renderMusicCard(track)).join('');
      }

      const trending = await musicApi.getTrending();
      const trendingList = document.getElementById('home-trending-list');
      if (trendingList) {
        trendingList.innerHTML = this._renderTrackList(trending.slice(0, 8));
      }
    } catch (e) {
      console.warn('Error loading home data:', e);
    }
  }

  /* ========================================================================
     SEARCH VIEW
     ======================================================================== */
  renderSearch() {
    this.container.innerHTML = `
      <div class="page-section" style="margin-bottom: 24px;">
        <h1 class="text-h1" style="margin-bottom: 12px;">Search Music</h1>
        <div style="display: flex; gap: 10px; max-width: 580px;">
          <div style="flex: 1; position: relative; display: flex; align-items: center;">
            <i class="hgi-stroke hgi-search-01" style="position: absolute; left: 14px; color: var(--text-muted);"></i>
            <input 
              type="text" 
              id="search-input" 
              placeholder="Search by song title, artist, or album..." 
              style="width: 100%; padding-left: 42px; padding-right: 36px; height: 46px; font-size: 15px;"
              autocomplete="off"
            >
            <button id="search-clear-btn" style="position: absolute; right: 10px; display: none; color: var(--text-muted); padding: 4px;">
              <i class="hgi-stroke hgi-cancel-01"></i>
            </button>
          </div>
          <button class="btn btn-primary" id="search-submit-btn" style="height: 46px; padding: 0 20px;">
            Search
          </button>
        </div>

        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
          <span class="text-caption">Primary Provider:</span>
          <span class="brand-badge" id="search-provider-badge">BhariyaMusic API</span>
          <span class="text-caption" style="color: var(--text-muted);">(Auto-fallback enabled)</span>
        </div>
      </div>

      <!-- Quick Genre Badges -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
        ${['Chillhop', 'Electronic', 'Synthwave', 'Ambient', 'Hip-Hop', 'Acoustic', 'Rock', 'Jazz'].map(genre => `
          <button class="btn btn-secondary btn-sm" onclick="window.triggerSearchTag('${genre}')">
            ${genre}
          </button>
        `).join('')}
      </div>

      <!-- Results Container -->
      <div id="search-results-area">
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="hgi-stroke hgi-search-01"></i>
          </div>
          <div class="empty-state-title">Search for your favorite tracks</div>
          <div class="empty-state-desc">Type a song or artist name above to search through BhariyaMusic and verified catalog sources.</div>
        </div>
      </div>
    `;

    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    const submitBtn = document.getElementById('search-submit-btn');

    let debounceTimer = null;

    const performSearch = async (term) => {
      const q = term || input.value.trim();
      if (!q) return;

      const resultsArea = document.getElementById('search-results-area');
      resultsArea.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px; padding: 12px 0;">
          <div class="skeleton" style="height: 54px;"></div>
          <div class="skeleton" style="height: 54px;"></div>
          <div class="skeleton" style="height: 54px;"></div>
          <div class="skeleton" style="height: 54px;"></div>
        </div>
      `;

      try {
        const tracks = await musicApi.search(q);
        const badge = document.getElementById('search-provider-badge');
        if (badge) {
          badge.textContent = musicApi.activeProviderName;
        }

        if (!tracks || tracks.length === 0) {
          resultsArea.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon"><i class="hgi-stroke hgi-alert-circle"></i></div>
              <div class="empty-state-title">No results found for "${this.escapeHtml(q)}"</div>
              <div class="empty-state-desc">Check your spelling or try searching for another artist or track name.</div>
            </div>
          `;
          return;
        }

        resultsArea.innerHTML = `
          <div class="section-header">
            <h2 class="section-title">Results for "${this.escapeHtml(q)}" (${tracks.length})</h2>
            <button class="btn btn-primary btn-sm" onclick="window.playAllSearchResults()">
              <i class="hgi-stroke hgi-play"></i> Play All
            </button>
          </div>
          <div class="tracks-list">
            ${this._renderTrackList(tracks)}
          </div>
        `;
        window._lastSearchResults = tracks;
      } catch (err) {
        resultsArea.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon" style="color: var(--color-error);"><i class="hgi-stroke hgi-alert-circle"></i></div>
            <div class="empty-state-title">Search request failed</div>
            <div class="empty-state-desc">${this.escapeHtml(err.message)}</div>
            <button class="btn btn-secondary btn-sm" onclick="window.triggerSearchTag('${this.escapeHtml(q)}')">Try Again</button>
          </div>
        `;
      }
    };

    input.addEventListener('input', () => {
      clearBtn.style.display = input.value ? 'block' : 'none';
      clearTimeout(debounceTimer);
      if (input.value.trim().length >= 2) {
        debounceTimer = setTimeout(() => performSearch(), 500);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        performSearch();
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      document.getElementById('search-results-area').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="hgi-stroke hgi-search-01"></i></div>
          <div class="empty-state-title">Search cleared</div>
          <div class="empty-state-desc">Enter another song or artist name to explore tracks.</div>
        </div>
      `;
    });

    submitBtn.addEventListener('click', () => performSearch());

    window.triggerSearchTag = (tag) => {
      input.value = tag;
      clearBtn.style.display = 'block';
      performSearch(tag);
    };

    window.playAllSearchResults = () => {
      if (window._lastSearchResults?.length > 0) {
        player.playQueue(window._lastSearchResults, 0);
      }
    };
  }

  /* ========================================================================
     DISCOVER VIEW
     ======================================================================== */
  async renderDiscover() {
    this.container.innerHTML = `
      <div class="page-section">
        <h1 class="text-h1" style="margin-bottom: 6px;">Discover & Explore</h1>
        <p class="text-body" style="margin-bottom: 24px;">Find fresh acoustic, chillhop, and synthwave vibes crafted for seamless focus.</p>

        <div class="section-header">
          <h2 class="section-title">Staff Picks & Curated Vinyl</h2>
        </div>
        <div class="cards-grid" id="discover-cards-grid">
          <div class="skeleton" style="height: 220px;"></div>
          <div class="skeleton" style="height: 220px;"></div>
          <div class="skeleton" style="height: 220px;"></div>
        </div>
      </div>
    `;

    try {
      const tracks = await musicApi.getFeatured();
      const grid = document.getElementById('discover-cards-grid');
      if (grid) {
        grid.innerHTML = tracks.map(t => this._renderMusicCard(t)).join('');
      }
    } catch (e) {
      console.warn(e);
    }
  }

  /* ========================================================================
     LIBRARY VIEW
     ======================================================================== */
  renderLibrary() {
    const { playlists, likedSongs, recentlyPlayed } = library.getState();
    const localTracks = localMusic.getTracks();
    const uploadedTracks = cloudUploads.getTracks();

    this.container.innerHTML = `
      <div class="page-section">
        <div class="section-header">
          <h1 class="text-h1">Your Library</h1>
          <button class="btn btn-primary" onclick="window.openCreatePlaylistModal()">
            <i class="hgi-stroke hgi-add-01"></i> Create Playlist
          </button>
        </div>

        <!-- Filter tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 4px;">
          <button class="btn btn-secondary btn-sm active" onclick="window.filterLibraryTab('all', this)">All</button>
          <button class="btn btn-secondary btn-sm" onclick="window.filterLibraryTab('playlists', this)">Playlists (${playlists.length})</button>
          <button class="btn btn-secondary btn-sm" onclick="window.filterLibraryTab('liked', this)">Liked (${likedSongs.length})</button>
          <button class="btn btn-secondary btn-sm" onclick="window.filterLibraryTab('local', this)">Device Songs (${localTracks.length})</button>
          <button class="btn btn-secondary btn-sm" onclick="window.filterLibraryTab('uploads', this)">Cloudinary (${uploadedTracks.length})</button>
        </div>

        <!-- Playlists Grid -->
        <div class="section-header">
          <h2 class="section-title">Playlists</h2>
        </div>
        <div class="cards-grid" id="lib-playlists-grid" style="margin-bottom: 32px;">
          <!-- Create Playlist Tile -->
          <div class="music-card" onclick="window.openCreatePlaylistModal()" style="border-style: dashed; justify-content: center; align-items: center; min-height: 220px; text-align: center;">
            <div style="width: 48px; height: 48px; border-radius: 9999px; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; color: var(--accent); margin-bottom: 12px;">
              <i class="hgi-stroke hgi-add-01"></i>
            </div>
            <div class="card-title">New Playlist</div>
            <div class="card-subtitle">Create a custom collection</div>
          </div>

          <!-- Liked Songs Tile -->
          <div class="music-card" onclick="window.location.hash='liked'">
            <div class="card-media">
              <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80" alt="Liked Songs">
              <button class="card-play-btn" onclick="event.stopPropagation(); window.playLikedDirect()" aria-label="Play Liked Songs">
                <i class="hgi-stroke hgi-play"></i>
              </button>
            </div>
            <div class="card-title">Liked Songs</div>
            <div class="card-subtitle">${likedSongs.length} tracks saved</div>
          </div>

          ${playlists.map(pl => `
            <div class="music-card" onclick="window.location.hash='playlist/${pl.id}'">
              <div class="card-media">
                <img src="${pl.artwork || './assets/images/default-cover.svg'}" alt="${this.escapeHtml(pl.name)}">
                <button class="card-play-btn" onclick="event.stopPropagation(); window.playPlaylistDirect('${pl.id}')" aria-label="Play ${this.escapeHtml(pl.name)}">
                  <i class="hgi-stroke hgi-play"></i>
                </button>
              </div>
              <div class="card-title truncate">${this.escapeHtml(pl.name)}</div>
              <div class="card-subtitle">${pl.tracks?.length || 0} tracks</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    window.filterLibraryTab = (tab, btn) => {
      btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (tab === 'liked') window.location.hash = 'liked';
      else if (tab === 'local') window.location.hash = 'local';
      else if (tab === 'uploads') window.location.hash = 'uploads';
    };
  }

  /* ========================================================================
     PLAYLIST VIEW
     ======================================================================== */
  renderPlaylist(playlistId) {
    const pl = library.getPlaylist(playlistId);
    if (!pl) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="hgi-stroke hgi-alert-circle"></i></div>
          <div class="empty-state-title">Playlist not found</div>
          <div class="empty-state-desc">The playlist you requested does not exist or was deleted.</div>
          <button class="btn btn-secondary" onclick="window.location.hash='library'">Return to Library</button>
        </div>
      `;
      return;
    }

    const totalSeconds = (pl.tracks || []).reduce((acc, t) => acc + (t.duration || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    this.container.innerHTML = `
      <div style="display: flex; gap: 24px; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap;">
        <img src="${pl.artwork || './assets/images/default-cover.svg'}" style="width: 180px; height: 180px; border-radius: var(--radius-lg); object-fit: cover; border: 1px solid var(--border-subtle);" alt="${this.escapeHtml(pl.name)}">
        <div style="flex: 1; min-width: 240px;">
          <div class="text-caption" style="text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--accent); margin-bottom: 4px;">Playlist</div>
          <h1 class="text-h1" style="font-size: 32px; margin-bottom: 8px;">${this.escapeHtml(pl.name)}</h1>
          <p class="text-body" style="margin-bottom: 12px;">${this.escapeHtml(pl.description || 'Curated user playlist.')}</p>
          <div class="text-caption" style="display: flex; align-items: center; gap: 8px;">
            <span>${pl.tracks?.length || 0} tracks</span>
            <span>•</span>
            <span>${totalMinutes} minutes</span>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px;">
        <button class="btn btn-primary" onclick="window.playPlaylistDirect('${pl.id}')" ${(!pl.tracks || pl.tracks.length === 0) ? 'disabled' : ''}>
          <i class="hgi-stroke hgi-play"></i> Play All
        </button>
        <button class="btn btn-secondary" onclick="window.shufflePlaylistDirect('${pl.id}')" ${(!pl.tracks || pl.tracks.length === 0) ? 'disabled' : ''}>
          <i class="hgi-stroke hgi-shuffle"></i> Shuffle
        </button>
        <button class="btn btn-outline" onclick="window.openEditPlaylistModal('${pl.id}')">
          <i class="hgi-stroke hgi-edit-01"></i> Edit
        </button>
        <button class="btn btn-outline btn-danger" onclick="window.confirmDeletePlaylist('${pl.id}')">
          <i class="hgi-stroke hgi-delete-02"></i> Delete
        </button>
      </div>

      ${pl.tracks && pl.tracks.length > 0 ? `
        <div class="tracks-list">
          ${this._renderTrackList(pl.tracks, pl.id)}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="hgi-stroke hgi-music-note-01"></i></div>
          <div class="empty-state-title">This playlist is empty</div>
          <div class="empty-state-desc">Search for songs or import local files and add them to this playlist.</div>
          <button class="btn btn-primary btn-sm" onclick="window.location.hash='search'">Find Music</button>
        </div>
      `}
    `;
  }

  /* ========================================================================
     LIKED SONGS VIEW
     ======================================================================== */
  renderLiked() {
    const { likedSongs } = library.getState();
    const totalSeconds = likedSongs.reduce((acc, t) => acc + (t.duration || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    this.container.innerHTML = `
      <div style="display: flex; gap: 24px; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap;">
        <div style="width: 160px; height: 160px; border-radius: var(--radius-lg); background: linear-gradient(135deg, #1f2937, #111827); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: 54px;">
          <i class="hgi-stroke hgi-favourite"></i>
        </div>
        <div style="flex: 1; min-width: 240px;">
          <div class="text-caption" style="text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: var(--accent); margin-bottom: 4px;">Collection</div>
          <h1 class="text-h1" style="font-size: 32px; margin-bottom: 8px;">Liked Songs</h1>
          <p class="text-body" style="margin-bottom: 12px;">All your favorite tracks from search, uploads, and imports stored in one place.</p>
          <div class="text-caption">${likedSongs.length} tracks • ${totalMinutes} minutes</div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px;">
        <button class="btn btn-primary" onclick="window.playLikedDirect()" ${likedSongs.length === 0 ? 'disabled' : ''}>
          <i class="hgi-stroke hgi-play"></i> Play Liked
        </button>
      </div>

      ${likedSongs.length > 0 ? `
        <div class="tracks-list">
          ${this._renderTrackList(likedSongs)}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="hgi-stroke hgi-favourite"></i></div>
          <div class="empty-state-title">No liked songs yet</div>
          <div class="empty-state-desc">Click the heart icon on any track to save it to your liked collection.</div>
          <button class="btn btn-primary btn-sm" onclick="window.location.hash='search'">Explore Music</button>
        </div>
      `}
    `;
  }

  /* ========================================================================
     HISTORY VIEW
     ======================================================================== */
  renderHistory() {
    const { recentlyPlayed } = library.getState();
    this.container.innerHTML = `
      <div class="page-section">
        <h1 class="text-h1" style="margin-bottom: 6px;">Recently Played</h1>
        <p class="text-body" style="margin-bottom: 24px;">Your listening history across all playback sources.</p>

        ${recentlyPlayed.length > 0 ? `
          <div class="tracks-list">
            ${this._renderTrackList(recentlyPlayed)}
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="hgi-stroke hgi-music-note-01"></i></div>
            <div class="empty-state-title">No listening history yet</div>
            <div class="empty-state-desc">Start playing music to build your history.</div>
          </div>
        `}
      </div>
    `;
  }

  /* ========================================================================
     LOCAL MUSIC & DEVICE AUTO-SCAN VIEW
     ======================================================================== */
  renderLocal() {
    const localTracks = localMusic.getTracks();

    this.container.innerHTML = `
      <div class="page-section">
        <div class="section-header">
          <div>
            <h1 class="text-h1" style="margin-bottom: 4px;">Local & Device Music</h1>
            <p class="text-body">Auto-scan or select audio from your mobile device or desktop. Stored permanently in IndexedDB.</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary" onclick="window.autoScanMobileMusic()">
              <i class="hgi-stroke hgi-smart-phone-01"></i> Auto-Scan Device
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('local-file-picker').click()">
              <i class="hgi-stroke hgi-cloud-upload"></i> Pick Files
            </button>
            <input type="file" id="local-file-picker" multiple accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" style="display: none;">
          </div>
        </div>

        <!-- IndexedDB Permanent Persistence Banner -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-left: 3px solid var(--accent); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 24px; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
          <strong style="color: var(--text-primary);">Permanent IndexedDB Storage:</strong> Audio files scanned from your device are stored securely in browser IndexedDB. They remain accessible offline and persist even when closing or rebooting your phone/PWA.
        </div>

        <!-- Drag & Drop / Mobile Tap Zone -->
        <div id="local-drop-zone" style="border: 2px dashed var(--border-subtle); border-radius: var(--radius-lg); padding: 40px 20px; text-align: center; margin-bottom: 28px; cursor: pointer; transition: all var(--transition-fast);">
          <div style="width: 52px; height: 52px; border-radius: 9999px; background: var(--bg-elevated); margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: 24px;">
            <i class="hgi-stroke hgi-smart-phone-01"></i>
          </div>
          <div class="text-h3" style="margin-bottom: 6px;">Tap to Auto-Scan or Drop Device Songs Here</div>
          <div class="text-caption">Auto-detects and scans MP3, WAV, M4A, OGG, and FLAC files</div>
        </div>

        <!-- Tracks List -->
        ${localTracks.length > 0 ? `
          <div class="section-header">
            <h2 class="section-title">Device Tracks (${localTracks.length})</h2>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary btn-sm" onclick="window.playLocalAll()">
                <i class="hgi-stroke hgi-play"></i> Play All
              </button>
              <button class="btn btn-outline btn-sm btn-danger" onclick="window.clearAllDeviceMusic()">
                <i class="hgi-stroke hgi-delete-02"></i> Clear
              </button>
            </div>
          </div>
          <div class="tracks-list">
            ${this._renderTrackList(localTracks)}
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="hgi-stroke hgi-smart-phone-01"></i></div>
            <div class="empty-state-title">No device songs scanned yet</div>
            <div class="empty-state-desc">Click "Auto-Scan Device" above to select and load your mobile music folder for instant offline streaming.</div>
            <button class="btn btn-primary btn-sm" onclick="window.autoScanMobileMusic()">Scan Device Audio</button>
          </div>
        `}
      </div>
    `;

    const dropZone = document.getElementById('local-drop-zone');
    const filePicker = document.getElementById('local-file-picker');

    if (dropZone && filePicker) {
      dropZone.addEventListener('click', () => window.autoScanMobileMusic());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
        dropZone.style.backgroundColor = 'var(--bg-hover)';
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-subtle)';
        dropZone.style.backgroundColor = 'transparent';
      });

      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-subtle)';
        dropZone.style.backgroundColor = 'transparent';
        if (e.dataTransfer.files?.length > 0) {
          const added = await localMusic.importFiles(e.dataTransfer.files);
          window.showAppToast(`Imported ${added.length} device song(s)!`, 'success');
          this.renderLocal();
        }
      });

      filePicker.addEventListener('change', async (e) => {
        if (e.target.files?.length > 0) {
          const added = await localMusic.importFiles(e.target.files);
          window.showAppToast(`Imported ${added.length} device song(s)!`, 'success');
          this.renderLocal();
        }
      });
    }

    window.playLocalAll = () => {
      const tracks = localMusic.getTracks().filter(t => t.isPlayable);
      if (tracks.length > 0) {
        player.playQueue(tracks, 0);
      }
    };

    window.clearAllDeviceMusic = () => {
      if (confirm('Clear all stored device music from IndexedDB?')) {
        localMusic.clearAll();
        window.showAppToast('Device music storage cleared', 'info');
        this.renderLocal();
      }
    };
  }

  /* ========================================================================
     CLOUD UPLOADS VIEW
     ======================================================================== */
  renderUploads() {
    const tracks = cloudUploads.getTracks();

    this.container.innerHTML = `
      <div class="page-section">
        <div class="section-header">
          <div>
            <h1 class="text-h1" style="margin-bottom: 4px;">My Cloud Uploads</h1>
            <p class="text-body">Upload your original audio & artwork to Cloudinary (cloud: <strong>da6fjyirm</strong>, preset: <strong>musixData</strong>).</p>
          </div>
          <button class="btn btn-primary" onclick="window.openUploadModal()">
            <i class="hgi-stroke hgi-cloud-upload"></i> Upload Track
          </button>
        </div>

        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div>
            <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary); margin-bottom: 2px;">
              Cloudinary Storage: <span style="color: var(--color-success); font-weight: 700;">Connected (da6fjyirm / musixData)</span>
            </div>
            <div class="text-caption">
              Uploads are securely sent to Cloudinary and accessible for playback across devices.
            </div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="window.openUploadModal()">
            <i class="hgi-stroke hgi-cloud-upload"></i> New Upload
          </button>
        </div>

        <!-- Uploads List -->
        ${tracks.length > 0 ? `
          <div class="tracks-list">
            ${this._renderTrackList(tracks)}
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="hgi-stroke hgi-cloud-upload"></i></div>
            <div class="empty-state-title">No uploaded tracks yet</div>
            <div class="empty-state-desc">Upload your music files with custom cover art to stream anywhere on any device.</div>
            <button class="btn btn-primary btn-sm" onclick="window.openUploadModal()">Upload Track</button>
          </div>
        `}
      </div>
    `;
  }

  /* ========================================================================
     SETTINGS & PREFERENCES VIEW
     (Online developer configurations removed as requested)
     ======================================================================== */
  renderSettings() {
    const user = auth.getUser();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const localCount = localMusic.getTracks().length;

    this.container.innerHTML = `
      <div class="page-section" style="max-width: 680px;">
        <h1 class="text-h1" style="margin-bottom: 6px;">Settings & Preferences</h1>
        <p class="text-body" style="margin-bottom: 28px;">Manage your account, playback quality, PWA installation, and device storage.</p>

        <!-- Account Profile Section -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;">
          <h2 class="text-h3" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i class="hgi-stroke hgi-user"></i> Account Profile
          </h2>
          <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
            <div style="width: 48px; height: 48px; border-radius: 9999px; background: #282828; display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: 20px;">
              <i class="hgi-stroke hgi-user"></i>
            </div>
            <div>
              <div style="font-weight: 700; color: var(--text-primary); font-size: 15px;">${this.escapeHtml(user?.displayName || 'Music Listener')}</div>
              <div class="text-caption">
                ${this.escapeHtml(user?.email || 'dezignmvs@gmail.com')} • 
                <span style="color: var(--color-success); font-weight: 600;">Authenticated</span>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.handleLogout()">Log Out</button>
          </div>
        </div>

        <!-- Audio & Playback Quality -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;">
          <h2 class="text-h3" style="margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
            <i class="hgi-stroke hgi-volume-high"></i> Audio & Playback Quality
          </h2>
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">Streaming Audio Quality</div>
                <div class="text-caption">High Definition 320kbps full-length AAC/MP3 playback</div>
              </div>
              <span class="brand-badge" style="background: var(--accent-dim); color: var(--accent);">320 KBPS</span>
            </div>
            <div style="height: 1px; background: var(--border-light);"></div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">Crossfade & Gapless</div>
                <div class="text-caption">Seamless Spotify-style track transitions</div>
              </div>
              <span class="brand-badge">ENABLED</span>
            </div>
            <div style="height: 1px; background: var(--border-light);"></div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">Auto-advance Next Track</div>
                <div class="text-caption">Automatically play next song when current track finishes</div>
              </div>
              <span class="brand-badge">ACTIVE</span>
            </div>
          </div>
        </div>

        <!-- PWA Installation -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;">
          <h2 class="text-h3" style="margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <i class="hgi-stroke hgi-smart-phone-01"></i> Progressive Web App (PWA)
          </h2>
          <p class="text-caption" style="margin-bottom: 14px;">
            ${isStandalone ? 'Application is running as an installed standalone app.' : 'Install Musics directly to your phone or desktop home screen for full offline support and instant launch.'}
          </p>
          <button class="btn btn-primary btn-sm" id="settings-install-pwa-btn">
            <i class="hgi-stroke hgi-download-01"></i> ${isStandalone ? 'Application Installed' : 'Install App'}
          </button>
        </div>

        <!-- Storage & Cache Management -->
        <div style="background-color: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;">
          <h2 class="text-h3" style="margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
            <i class="hgi-stroke hgi-folder-music"></i> Local Storage & Device Audio
          </h2>
          <p class="text-caption" style="margin-bottom: 14px;">
            Device tracks stored in IndexedDB: <strong>${localCount} track(s)</strong>.
          </p>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="window.autoScanMobileMusic()">
              <i class="hgi-stroke hgi-smart-phone-01"></i> Re-Scan Device Music
            </button>
            <button class="btn btn-outline btn-sm btn-danger" onclick="window.clearAppCache()">
              <i class="hgi-stroke hgi-delete-02"></i> Clear Local Cache
            </button>
          </div>
        </div>
      </div>
    `;

    const pwaBtn = document.getElementById('settings-install-pwa-btn');
    if (pwaBtn && window.pwaInstance) {
      window.pwaInstance.registerInstallButton(pwaBtn);
    }

    window.clearAppCache = () => {
      if (confirm('Clear local audio cache and temporary data?')) {
        localStorage.removeItem('lib_recently_played');
        window.showAppToast('Local cache cleared', 'info');
        this.renderSettings();
      }
    };
  }

  /* ========================================================================
     HELPERS
     ======================================================================== */
  _renderTrackList(tracks, playlistId = null) {
    if (!tracks || tracks.length === 0) return '';
    return tracks.map((track, i) => {
      const isLiked = library.isLiked(track.id);
      const isCurrent = player.currentTrack?.id === track.id;
      const durationStr = this._formatDuration(track.duration);

      return `
        <div class="track-row ${isCurrent ? 'active' : ''}" data-track-id="${this.escapeHtml(track.id)}" onclick="window.playTrackFromList('${this.escapeHtml(track.id)}')">
          <div class="track-col-index">
            <span class="index-num">${i + 1}</span>
            <span class="index-play"><i class="hgi-stroke hgi-play"></i></span>
          </div>

          <div class="track-col-main">
            <img class="track-thumb" src="${track.artwork || './assets/images/default-cover.svg'}" alt="${this.escapeHtml(track.title)}" loading="lazy">
            <div class="track-meta">
              <span class="track-title truncate">${this.escapeHtml(track.title)}</span>
              <span class="track-artist truncate">${this.escapeHtml(track.artist)}</span>
            </div>
          </div>

          <div class="track-col-album truncate">
            ${this.escapeHtml(track.album || 'Single')}
          </div>

          <div class="track-col-duration">
            <button class="track-like-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); window.toggleTrackLike('${this.escapeHtml(track.id)}')" aria-label="Like song">
              <i class="hgi-stroke hgi-favourite"></i>
            </button>
            <span>${durationStr}</span>
          </div>

          <div class="track-col-actions">
            <button class="btn-icon" onclick="event.stopPropagation(); window.openTrackMenu('${this.escapeHtml(track.id)}', '${playlistId || ''}', event)" aria-label="More actions">
              <i class="hgi-stroke hgi-more-horizontal"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  _renderMusicCard(track) {
    return `
      <div class="music-card" onclick="window.playSingleTrack('${this.escapeHtml(track.id)}')">
        <div class="card-media">
          <img src="${track.artwork || './assets/images/default-cover.svg'}" alt="${this.escapeHtml(track.title)}" loading="lazy">
          <button class="card-play-btn" onclick="event.stopPropagation(); window.playSingleTrack('${this.escapeHtml(track.id)}')" aria-label="Play ${this.escapeHtml(track.title)}">
            <i class="hgi-stroke hgi-play"></i>
          </button>
        </div>
        <div class="card-title truncate">${this.escapeHtml(track.title)}</div>
        <div class="card-subtitle truncate">${this.escapeHtml(track.artist)}</div>
      </div>
    `;
  }

  _formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '3:20';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const router = new AppRouter();
