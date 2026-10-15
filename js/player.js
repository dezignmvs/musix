/**
 * HTML5 Audio Player Engine
 * Single shared Audio instance managing entire app playback, queue, and state
 */

export const REPEAT_MODES = {
  OFF: 'off',
  ALL: 'all',
  ONE: 'one'
};

class AudioPlayerEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.crossOrigin = 'anonymous';

    // State
    this.currentTrack = null;
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isLoading = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = parseFloat(localStorage.getItem('player_volume') ?? '0.85');
    this.isMuted = false;
    this.isShuffle = localStorage.getItem('player_shuffle') === 'true';
    this.repeatMode = localStorage.getItem('player_repeat') || REPEAT_MODES.OFF;

    this.audio.volume = this.volume;

    // Event listeners
    this.subscribers = new Set();
    this._initAudioEvents();
    this._initMediaSession();
  }

  /**
   * Subscribe to state updates
   */
  subscribe(fn) {
    this.subscribers.add(fn);
    // Immediately emit current state
    fn(this.getState());
    return () => this.subscribers.delete(fn);
  }

  _notify(type = 'state_change') {
    const state = this.getState();
    this.subscribers.forEach(fn => fn(state, type));
  }

  getState() {
    return {
      currentTrack: this.currentTrack,
      queue: [...this.queue],
      currentIndex: this.currentIndex,
      isPlaying: this.isPlaying,
      isLoading: this.isLoading,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      isMuted: this.isMuted,
      isShuffle: this.isShuffle,
      repeatMode: this.repeatMode
    };
  }

  _initAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.isLoading = false;
      this._notify('play');
      this._updateMediaSessionState('playing');
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this._notify('pause');
      this._updateMediaSessionState('paused');
    });

    this.audio.addEventListener('waiting', () => {
      this.isLoading = true;
      this._notify('waiting');
    });

    this.audio.addEventListener('playing', () => {
      this.isLoading = false;
      this._notify('playing');
    });

    this.audio.addEventListener('canplay', () => {
      this.isLoading = false;
      this._notify('canplay');
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
      this.duration = this.audio.duration || this.currentTrack?.duration || 0;
      this._notify('timeupdate');
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        this.duration = this.audio.duration;
        this._notify('durationchange');
      }
    });

    this.audio.addEventListener('ended', () => {
      this._handleTrackEnded();
    });

    this.audio.addEventListener('error', (e) => {
      this.isLoading = false;
      this.isPlaying = false;
      console.warn('[AudioPlayer] Audio playback error:', e);
      this._notify('error');
    });
  }

  _initMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) this.seek(details.seekTime);
      });
    }
  }

  _updateMediaSessionMetadata() {
    if ('mediaSession' in navigator && this.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.title,
        artist: this.currentTrack.artist,
        album: this.currentTrack.album,
        artwork: [
          { src: this.currentTrack.artwork, sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }

  _updateMediaSessionState(state) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  /**
   * Set playback queue and start playing from track index
   */
  async playQueue(tracks, startIndex = 0) {
    if (!tracks || tracks.length === 0) return;
    this.queue = [...tracks];
    this.currentIndex = Math.max(0, Math.min(startIndex, this.queue.length - 1));
    await this.loadAndPlay(this.queue[this.currentIndex]);
  }

  /**
   * Load and play a specific track
   */
  async loadAndPlay(track) {
    if (!track) return;

    // Check if track is already in queue; if not, add it
    let idx = this.queue.findIndex(t => t.id === track.id);
    if (idx === -1) {
      this.queue.push(track);
      this.currentIndex = this.queue.length - 1;
    } else {
      this.currentIndex = idx;
    }

    this.currentTrack = track;
    this.isLoading = true;
    this.currentTime = 0;
    this.duration = track.duration || 0;
    this._notify('trackchange');

    this._updateMediaSessionMetadata();

    try {
      if (this.audio.src !== track.audioUrl) {
        this.audio.src = track.audioUrl;
      }
      this.audio.currentTime = 0;
      await this.audio.play();
    } catch (err) {
      this.isLoading = false;
      this.isPlaying = false;
      console.warn('[AudioPlayer] Playback was prevented or failed:', err.message);
      this._notify('error');
    }
  }

  /**
   * Play / Pause toggle
   */
  async togglePlay() {
    if (!this.currentTrack && this.queue.length > 0) {
      await this.loadAndPlay(this.queue[0]);
      return;
    }

    if (this.isPlaying) {
      this.pause();
    } else {
      await this.play();
    }
  }

  async play() {
    if (!this.currentTrack) {
      if (this.queue.length > 0) {
        await this.loadAndPlay(this.queue[0]);
      }
      return;
    }
    try {
      await this.audio.play();
    } catch (err) {
      console.warn('[AudioPlayer] Autoplay prevented:', err.message);
    }
  }

  pause() {
    this.audio.pause();
  }

  /**
   * Next track in queue
   */
  async next() {
    if (this.queue.length === 0) return;

    if (this.isShuffle && this.queue.length > 1) {
      let randIdx;
      do {
        randIdx = Math.floor(Math.random() * this.queue.length);
      } while (randIdx === this.currentIndex);
      this.currentIndex = randIdx;
      await this.loadAndPlay(this.queue[this.currentIndex]);
      return;
    }

    if (this.currentIndex + 1 < this.queue.length) {
      this.currentIndex++;
      await this.loadAndPlay(this.queue[this.currentIndex]);
    } else if (this.repeatMode === REPEAT_MODES.ALL) {
      this.currentIndex = 0;
      await this.loadAndPlay(this.queue[this.currentIndex]);
    } else {
      this.pause();
      this.seek(0);
    }
  }

  /**
   * Previous track in queue
   */
  async previous() {
    // If more than 3 seconds in, restart track
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      await this.loadAndPlay(this.queue[this.currentIndex]);
    } else if (this.repeatMode === REPEAT_MODES.ALL) {
      this.currentIndex = this.queue.length - 1;
      await this.loadAndPlay(this.queue[this.currentIndex]);
    } else {
      this.seek(0);
    }
  }

  _handleTrackEnded() {
    if (this.repeatMode === REPEAT_MODES.ONE) {
      this.seek(0);
      this.play();
    } else {
      this.next();
    }
  }

  seek(seconds) {
    if (isNaN(seconds)) return;
    const clamped = Math.max(0, Math.min(seconds, this.duration || 0));
    this.audio.currentTime = clamped;
    this.currentTime = clamped;
    this._notify('seek');
  }

  setVolume(val) {
    const clamped = Math.max(0, Math.min(val, 1));
    this.volume = clamped;
    this.audio.volume = clamped;
    if (clamped > 0 && this.isMuted) {
      this.isMuted = false;
    }
    localStorage.setItem('player_volume', String(clamped));
    this._notify('volumechange');
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
    this._notify('volumechange');
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    localStorage.setItem('player_shuffle', String(this.isShuffle));
    this._notify('modechange');
  }

  cycleRepeat() {
    if (this.repeatMode === REPEAT_MODES.OFF) {
      this.repeatMode = REPEAT_MODES.ALL;
    } else if (this.repeatMode === REPEAT_MODES.ALL) {
      this.repeatMode = REPEAT_MODES.ONE;
    } else {
      this.repeatMode = REPEAT_MODES.OFF;
    }
    localStorage.setItem('player_repeat', this.repeatMode);
    this._notify('modechange');
  }

  // Queue manipulation
  addToQueue(track) {
    this.queue.push(track);
    this._notify('queuechange');
  }

  addToQueueNext(track) {
    this.queue.splice(this.currentIndex + 1, 0, track);
    this._notify('queuechange');
  }

  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
      if (this.queue.length > 0) {
        this.next();
      } else {
        this.currentTrack = null;
        this.audio.pause();
        this.audio.src = '';
      }
    }
    this._notify('queuechange');
  }

  clearQueue() {
    this.queue = this.currentTrack ? [this.currentTrack] : [];
    this.currentIndex = this.currentTrack ? 0 : -1;
    this._notify('queuechange');
  }
}

export const player = new AudioPlayerEngine();
