/**
 * BhariyaMusic API Provider
 * Primary provider for music search and playback
 * 
 * GitHub: BhariyaConnect/BhariyaMusic
 * Endpoints:
 * - Prepare: GET /music/api/prepare/{song_name/url} -> returns song_id
 * - Fetch:   GET /music/api/fetch/{song_id} -> returns song details
 * - Audio:   GET /music/api/audio/{song_id} -> stream fallback
 */

const DEFAULT_BASE_URL = 'https://bhindi1.ddns.net/music';
const TIMEOUT_MS = 6000;

class BhariyaMusicProvider {
  constructor() {
    this.name = 'BhariyaMusic';
    this.baseUrl = localStorage.getItem('bhariya_api_base_url') || DEFAULT_BASE_URL;
    this.isAvailable = null;
  }

  setBaseUrl(url) {
    if (!url) return;
    this.baseUrl = url.replace(/\/+$/, '');
    localStorage.setItem('bhariya_api_base_url', this.baseUrl);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  /**
   * Helper to perform fetch with a timeout
   */
  async _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Normalizes BhariyaMusic song object to standard internal track format
   */
  normalizeTrack(raw) {
    if (!raw) return null;

    // BhariyaMusic fields: ID, SONG_NAME, YT_ID, SPOTIFY_ID, DURATION, AUDIO_URL, THUMBNAIL, LYRICS
    const id = raw.ID || raw.id || raw.YT_ID || `bhariya_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Split song title and artist if formatted as "Artist - Title" or "Title by Artist"
    let title = raw.SONG_NAME || raw.song_name || raw.title || 'Unknown Title';
    let artist = 'Various Artists';
    let album = 'Single';

    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else if (title.includes(' by ')) {
      const parts = title.split(' by ');
      title = parts[0].trim();
      artist = parts[1].trim();
    }

    // Audio stream URL handling: direct AUDIO_URL or fallback /api/audio/{id}
    let audioUrl = raw.AUDIO_URL || raw.audio_url || '';
    if (!audioUrl && raw.ID) {
      audioUrl = `${this.baseUrl}/api/audio/${encodeURIComponent(raw.ID)}`;
    }

    return {
      id: `bhariya:${id}`,
      rawId: id,
      title: title,
      artist: artist,
      album: album,
      artwork: raw.THUMBNAIL || raw.thumbnail || './assets/images/default-cover.svg',
      duration: Number(raw.DURATION || raw.duration || 0),
      audioUrl: audioUrl,
      provider: 'bhariyamusic',
      isPlayable: Boolean(audioUrl),
      isPreview: false,
      lyrics: raw.LYRICS || raw.lyrics || '',
      ytId: raw.YT_ID || null,
      spotifyId: raw.SPOTIFY_ID || null
    };
  }

  /**
   * Search for songs using BhariyaMusic API
   * Step 1: GET /api/prepare/{query}
   * Step 2: GET /api/fetch/{id}
   */
  async search(query) {
    if (!query || !query.trim()) return [];

    const cleanQuery = query.trim();
    const prepareUrl = `${this.baseUrl}/api/prepare/${encodeURIComponent(cleanQuery)}`;

    try {
      const prepareRes = await this._fetchWithTimeout(prepareUrl);
      if (!prepareRes.ok) {
        throw new Error(`Prepare endpoint returned HTTP ${prepareRes.status}`);
      }

      // Check whether response is text ID or JSON
      const contentType = prepareRes.headers.get('content-type') || '';
      let songId = '';

      if (contentType.includes('application/json')) {
        const json = await prepareRes.json();
        songId = json.song_id || json.ID || json.id || json.songId || '';
      } else {
        songId = (await prepareRes.text()).trim();
      }

      if (!songId) {
        throw new Error('No song ID returned by prepare endpoint');
      }

      // Fetch song data
      const fetchUrl = `${this.baseUrl}/api/fetch/${encodeURIComponent(songId)}`;
      const fetchRes = await this._fetchWithTimeout(fetchUrl);
      if (!fetchRes.ok) {
        throw new Error(`Fetch endpoint returned HTTP ${fetchRes.status}`);
      }

      const songData = await fetchRes.json();
      const normalized = this.normalizeTrack(songData);
      this.isAvailable = true;

      return normalized ? [normalized] : [];
    } catch (err) {
      this.isAvailable = false;
      console.warn(`[BhariyaMusic] Search error for "${cleanQuery}":`, err.message);
      throw err;
    }
  }

  /**
   * Health check for BhariyaMusic server
   */
  async checkHealth() {
    try {
      // Light check to verify server responsiveness
      const res = await this._fetchWithTimeout(`${this.baseUrl}/api/prepare/ping`);
      this.isAvailable = res.ok;
      return res.ok;
    } catch (e) {
      this.isAvailable = false;
      return false;
    }
  }
}

export const bhariyaMusicProvider = new BhariyaMusicProvider();
