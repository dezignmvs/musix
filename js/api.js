/**
 * Music API Service
 * Orchestrates BhariyaMusic & Full-Length Streaming Provider
 * Real 100% full songs like Spotify feel
 */

import { bhariyaMusicProvider } from './providers/bhariyamusic.js';
import { fallbackProvider } from './providers/fallback.js';

class MusicApiService {
  constructor() {
    this.activeProviderName = 'Full Streaming';
    this.isBhariyaOnline = false;
    this.listeners = new Set();
  }

  onStatusChange(fn) {
    this.listeners.add(fn);
  }

  _notify(status) {
    this.listeners.forEach(fn => fn(status));
  }

  /**
   * Search query: Tries BhariyaMusic if configured/reachable, else uses full-length stream engine
   */
  async search(query) {
    if (!query || !query.trim()) {
      return this.getFeatured();
    }

    // 1. Attempt BhariyaMusic if user has active server
    try {
      const bhariyaResults = await bhariyaMusicProvider.search(query);
      if (bhariyaResults && bhariyaResults.length > 0 && bhariyaResults[0].audioUrl) {
        this.activeProviderName = 'BhariyaMusic';
        this.isBhariyaOnline = true;
        this._notify({ provider: 'BhariyaMusic', online: true });
        return bhariyaResults;
      }
    } catch (err) {
      // BhariyaMusic server offline or unavailable, seamless switch to full-length streaming
    }

    // 2. Full-Length Streaming Engine (Spotify feel, 320kbps full duration)
    this.activeProviderName = 'Full Streaming';
    this.isBhariyaOnline = false;
    this._notify({ provider: 'Streaming (320kbps)', online: true });

    return await fallbackProvider.search(query);
  }

  /**
   * Featured / Discovery tracks (Full length)
   */
  async getFeatured() {
    return fallbackProvider.getCuratedCatalog();
  }

  /**
   * Trending music (Full length global hits)
   */
  async getTrending() {
    return await fallbackProvider.search('Top Hits 2026', 12);
  }

  /**
   * Recommended albums / chillout
   */
  async getRecommended() {
    return await fallbackProvider.search('Chill Ambient Beats', 12);
  }
}

export const musicApi = new MusicApiService();
