/**
 * Library & Playlists Manager
 * Manages Liked Songs, Recently Played, and Playlists (Synced with Firestore / LocalStorage)
 */

import { firebaseService } from './firebase.js';
import { auth } from './auth.js';

class LibraryManager {
  constructor() {
    this.likedSongs = [];
    this.recentlyPlayed = [];
    this.playlists = [];
    this.listeners = new Set();
    this._loadLocalState();
    this._initFirestoreSync();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  _notify() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  getState() {
    return {
      likedSongs: [...this.likedSongs],
      recentlyPlayed: [...this.recentlyPlayed],
      playlists: [...this.playlists]
    };
  }

  _loadLocalState() {
    try {
      this.likedSongs = JSON.parse(localStorage.getItem('lib_liked_songs') || '[]');
      this.recentlyPlayed = JSON.parse(localStorage.getItem('lib_recently_played') || '[]');
      
      const savedPlaylists = localStorage.getItem('lib_playlists');
      if (savedPlaylists) {
        this.playlists = JSON.parse(savedPlaylists);
      } else {
        // Starter default playlists
        this.playlists = [
          {
            id: 'playlist_chill_vibes',
            name: 'Late Night Chill',
            description: 'Smooth melodies and relaxed rhythm for deep focus and evening calm.',
            artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
            tracks: [],
            createdAt: new Date().toISOString()
          },
          {
            id: 'playlist_electronic_flow',
            name: 'Electronic Resonance',
            description: 'Uplifting synthwave, ambient textures, and driving electronic basslines.',
            artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
            tracks: [],
            createdAt: new Date().toISOString()
          }
        ];
        this._persistLocal();
      }
    } catch (e) {
      console.warn('Could not load library local state:', e);
    }
  }

  _persistLocal() {
    try {
      localStorage.setItem('lib_liked_songs', JSON.stringify(this.likedSongs));
      localStorage.setItem('lib_recently_played', JSON.stringify(this.recentlyPlayed));
      localStorage.setItem('lib_playlists', JSON.stringify(this.playlists));
    } catch (e) {
      console.warn('Could not persist library state:', e);
    }
  }

  async _initFirestoreSync() {
    await firebaseService.initPromise;
    if (firebaseService.isConfigured && firebaseService.db) {
      // Connect to Firestore collections for the user
      auth.subscribe(async (user) => {
        if (!user || user.isAnonymous) return;
        try {
          const { collection, getDocs, doc, setDoc } = await import(
            `https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js`
          );
          // Pull user playlists
          const plSnap = await getDocs(collection(firebaseService.db, `users/${user.uid}/playlists`));
          const remotePlaylists = [];
          plSnap.forEach(d => remotePlaylists.push({ id: d.id, ...d.data() }));
          if (remotePlaylists.length > 0) {
            this.playlists = remotePlaylists;
            this._persistLocal();
            this._notify();
          }
        } catch (err) {
          console.warn('[Firestore] Sync error:', err.message);
        }
      });
    }
  }

  // Liked Songs
  isLiked(trackId) {
    return this.likedSongs.some(t => t.id === trackId);
  }

  toggleLike(track) {
    if (!track) return false;
    const index = this.likedSongs.findIndex(t => t.id === track.id);
    let liked = false;

    if (index !== -1) {
      this.likedSongs.splice(index, 1);
      liked = false;
    } else {
      this.likedSongs.unshift(track);
      liked = true;
    }

    this._persistLocal();
    this._notify();
    return liked;
  }

  // Recently Played
  addRecentlyPlayed(track) {
    if (!track) return;
    this.recentlyPlayed = this.recentlyPlayed.filter(t => t.id !== track.id);
    this.recentlyPlayed.unshift({
      ...track,
      playedAt: new Date().toISOString()
    });
    // Keep top 30
    if (this.recentlyPlayed.length > 30) {
      this.recentlyPlayed.pop();
    }
    this._persistLocal();
    this._notify();
  }

  // Playlists
  createPlaylist(name, description = '', artwork = '') {
    const newPlaylist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: name.trim() || 'Untitled Playlist',
      description: description.trim(),
      artwork: artwork || './assets/images/default-cover.svg',
      tracks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.playlists.unshift(newPlaylist);
    this._persistLocal();
    this._notify();
    return newPlaylist;
  }

  getPlaylist(id) {
    return this.playlists.find(p => p.id === id);
  }

  updatePlaylist(id, { name, description, artwork }) {
    const pl = this.getPlaylist(id);
    if (!pl) return;
    if (name) pl.name = name.trim();
    if (description !== undefined) pl.description = description.trim();
    if (artwork) pl.artwork = artwork;
    pl.updatedAt = new Date().toISOString();
    this._persistLocal();
    this._notify();
  }

  deletePlaylist(id) {
    this.playlists = this.playlists.filter(p => p.id !== id);
    this._persistLocal();
    this._notify();
  }

  addTrackToPlaylist(playlistId, track) {
    const pl = this.getPlaylist(playlistId);
    if (!pl || !track) return false;

    // Check if duplicate
    if (!pl.tracks.some(t => t.id === track.id)) {
      pl.tracks.push(track);
      pl.updatedAt = new Date().toISOString();
      if (!pl.artwork || pl.artwork.includes('default-cover.svg')) {
        pl.artwork = track.artwork;
      }
      this._persistLocal();
      this._notify();
      return true;
    }
    return false;
  }

  removeTrackFromPlaylist(playlistId, trackId) {
    const pl = this.getPlaylist(playlistId);
    if (!pl) return;
    pl.tracks = pl.tracks.filter(t => t.id !== trackId);
    pl.updatedAt = new Date().toISOString();
    this._persistLocal();
    this._notify();
  }
}

export const library = new LibraryManager();
