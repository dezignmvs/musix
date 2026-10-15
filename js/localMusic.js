/**
 * Local Music Import & Library Module with IndexedDB Persistence
 * Designed for PWA & Mobile Standalone mode:
 * - Scans device audio files (MP3, WAV, M4A, OGG, FLAC)
 * - Stores audio Blobs in IndexedDB so tracks persist permanently across reboots & offline
 * - One-click "Auto-Scan Device Music" for mobile & desktop PWA
 */

import { player } from './player.js';

const DB_NAME = 'MusicsLocalDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_tracks';

class LocalMusicManager {
  constructor() {
    this.localTracks = [];
    this.listeners = new Set();
    this.db = null;
    this.initPromise = this._initDB();
  }

  async _initDB() {
    return new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = async (e) => {
        this.db = e.target.result;
        await this._loadFromIndexedDB();
        // Request persistent storage if supported (ensures mobile OS doesn't clear storage)
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().then(persistent => {
            console.log('[Storage] Persistent storage granted:', persistent);
          });
        }
        resolve(this.db);
      };
      req.onerror = () => {
        console.warn('[IndexedDB] Could not open database, falling back to session storage');
        this._loadSavedMetadataFallback();
        resolve(null);
      };
    });
  }

  async _loadFromIndexedDB() {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        this.localTracks = records.map(record => {
          let audioUrl = '';
          if (record.blob) {
            audioUrl = URL.createObjectURL(record.blob);
          }
          return {
            id: record.id,
            title: record.title,
            artist: record.artist,
            album: record.album,
            artwork: record.artwork || './assets/images/default-cover.svg',
            duration: record.duration || 0,
            audioUrl: audioUrl,
            provider: 'local',
            isPlayable: Boolean(audioUrl),
            isPreview: false,
            fileSize: record.fileSize,
            fileName: record.fileName,
            fileType: record.fileType,
            blob: record.blob
          };
        });
        console.info(`[LocalMusic] Loaded ${this.localTracks.length} tracks from IndexedDB.`);
        this._notify();
      };
    } catch (e) {
      console.warn('Error loading from IndexedDB:', e);
    }
  }

  _loadSavedMetadataFallback() {
    try {
      const stored = localStorage.getItem('local_tracks_meta');
      if (stored) {
        this.localTracks = JSON.parse(stored);
      }
    } catch (e) {
      this.localTracks = [];
    }
    this._notify();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.getTracks());
    return () => this.listeners.delete(fn);
  }

  _notify() {
    const list = this.getTracks();
    this.listeners.forEach(fn => fn(list));
  }

  getTracks() {
    return [...this.localTracks];
  }

  /**
   * Process incoming FileList or Array of Files, storing in IndexedDB for permanent PWA playback
   */
  async importFiles(files) {
    await this.initPromise;
    const validExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.opus'];
    const addedTracks = [];

    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!file.type.startsWith('audio/') && !validExtensions.includes(ext)) {
        continue;
      }

      // Parse metadata from filename (Artist - Title)
      let title = file.name.replace(/\.[^/.]+$/, "");
      let artist = 'Device Music';
      let album = 'Device Storage';

      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      } else if (title.includes(' by ')) {
        const parts = title.split(' by ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }

      const objectUrl = URL.createObjectURL(file);
      const duration = await this._getAudioDuration(objectUrl);
      const trackId = `local:${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const track = {
        id: trackId,
        title: title,
        artist: artist,
        album: album,
        artwork: './assets/images/default-cover.svg',
        duration: duration,
        audioUrl: objectUrl,
        provider: 'local',
        isPlayable: true,
        isPreview: false,
        fileSize: file.size,
        fileName: file.name,
        fileType: file.type,
        blob: file
      };

      // Save to IndexedDB
      if (this.db) {
        try {
          const tx = this.db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({
            id: trackId,
            title,
            artist,
            album,
            artwork: track.artwork,
            duration,
            fileSize: file.size,
            fileName: file.name,
            fileType: file.type,
            blob: file
          });
        } catch (e) {
          console.warn('Failed to write track to IndexedDB:', e);
        }
      }

      this.localTracks.unshift(track);
      addedTracks.push(track);
    }

    this._notify();
    return addedTracks;
  }

  /**
   * Scan Device Music using native Directory Picker or File System API
   */
  async scanDeviceMusic() {
    // 1. Try modern File System Directory Picker (Chrome/Edge/Android desktop)
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker({ id: 'music_folder', mode: 'read' });
        const files = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            if (file.type.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.flac'].some(e => file.name.endsWith(e))) {
              files.push(file);
            }
          }
        }
        if (files.length > 0) {
          return await this.importFiles(files);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.info('[DeviceScanner] Falling back to file input picker:', err.message);
        }
      }
    }

    // 2. Standard mobile file picker fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'audio/*,.mp3,.wav,.m4a,.ogg,.flac';
      input.onchange = async (e) => {
        if (e.target.files?.length > 0) {
          const added = await this.importFiles(e.target.files);
          resolve(added);
        } else {
          resolve([]);
        }
      };
      input.click();
    });
  }

  _getAudioDuration(url) {
    return new Promise((resolve) => {
      const tempAudio = new Audio();
      tempAudio.src = url;
      tempAudio.addEventListener('loadedmetadata', () => {
        resolve(Math.round(tempAudio.duration || 0));
      });
      tempAudio.addEventListener('error', () => {
        resolve(0);
      });
      setTimeout(() => resolve(0), 3000);
    });
  }

  updateTrackMetadata(id, title, artist, album) {
    const track = this.localTracks.find(t => t.id === id);
    if (track) {
      if (title) track.title = title.trim();
      if (artist) track.artist = artist.trim();
      if (album) track.album = album.trim();
      if (this.db) {
        try {
          const tx = this.db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: track.artwork,
            duration: track.duration,
            fileSize: track.fileSize,
            fileName: track.fileName,
            fileType: track.fileType,
            blob: track.blob
          });
        } catch (e) {}
      }
      this._notify();
    }
  }

  removeTrack(id) {
    const idx = this.localTracks.findIndex(t => t.id === id);
    if (idx !== -1) {
      const track = this.localTracks[idx];
      if (track.audioUrl && track.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(track.audioUrl);
      }
      this.localTracks.splice(idx, 1);
      if (this.db) {
        try {
          const tx = this.db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(id);
        } catch (e) {}
      }
      this._notify();
    }
  }

  clearAll() {
    this.localTracks.forEach(t => {
      if (t.audioUrl && t.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(t.audioUrl);
      }
    });
    this.localTracks = [];
    if (this.db) {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      } catch (e) {}
    }
    this._notify();
  }
}

export const localMusic = new LocalMusicManager();
