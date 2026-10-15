/**
 * Cloud Music Uploads Manager
 * Pre-configured with User's Cloudinary Credentials
 * Cloud Name: da6fjyirm
 * Upload Preset: musixData
 */

import { player } from './player.js';

export const DEFAULT_CLOUDINARY_CONFIG = {
  cloudName: 'da6fjyirm',
  uploadPreset: 'musixData'
};

class CloudUploadsManager {
  constructor() {
    this.cloudName = localStorage.getItem('cloudinary_cloud_name') || DEFAULT_CLOUDINARY_CONFIG.cloudName;
    this.uploadPreset = localStorage.getItem('cloudinary_upload_preset') || DEFAULT_CLOUDINARY_CONFIG.uploadPreset;
    this.uploadedTracks = [];
    this.listeners = new Set();
    this._loadSavedTracks();
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
    return [...this.uploadedTracks];
  }

  setCloudinaryConfig(cloudName, uploadPreset) {
    this.cloudName = cloudName.trim();
    this.uploadPreset = uploadPreset.trim();
    localStorage.setItem('cloudinary_cloud_name', this.cloudName);
    localStorage.setItem('cloudinary_upload_preset', this.uploadPreset);
  }

  _loadSavedTracks() {
    try {
      const stored = localStorage.getItem('cloud_uploaded_tracks');
      if (stored) {
        this.uploadedTracks = JSON.parse(stored);
      }
    } catch (e) {
      this.uploadedTracks = [];
    }
  }

  _persistTracks() {
    try {
      localStorage.setItem('cloud_uploaded_tracks', JSON.stringify(this.uploadedTracks));
    } catch (e) {
      console.warn('Could not save uploaded tracks:', e);
    }
  }

  /**
   * Upload audio file and optional artwork image to Cloudinary
   */
  async uploadTrack({ audioFile, artworkFile, title, artist, album, onProgress }) {
    if (!audioFile) throw new Error('Audio file is required');

    let audioUrl = '';
    let artworkUrl = './assets/images/default-cover.svg';
    let duration = 0;

    // Calculate duration locally
    const tempUrl = URL.createObjectURL(audioFile);
    try {
      const tempAudio = new Audio(tempUrl);
      duration = await new Promise(res => {
        tempAudio.addEventListener('loadedmetadata', () => res(Math.round(tempAudio.duration || 0)));
        tempAudio.addEventListener('error', () => res(0));
        setTimeout(() => res(0), 3000);
      });
    } finally {
      URL.revokeObjectURL(tempUrl);
    }

    // 1. Upload Artwork to Cloudinary if provided
    if (artworkFile) {
      onProgress && onProgress(15, 'Uploading cover artwork to Cloudinary (da6fjyirm)...');
      artworkUrl = await this._uploadToCloudinary(artworkFile, 'image');
    }

    // 2. Upload Audio Track to Cloudinary
    onProgress && onProgress(45, 'Uploading audio file to Cloudinary...');
    // Note: In Cloudinary, audio files (MP3, WAV, etc.) are processed under resource_type "video" or "auto"
    audioUrl = await this._uploadToCloudinary(audioFile, 'video');
    onProgress && onProgress(90, 'Finalizing track metadata...');

    const newTrack = {
      id: `cloud:${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: title || audioFile.name.replace(/\.[^/.]+$/, ''),
      artist: artist || 'My Uploads',
      album: album || 'Cloud Library',
      artwork: artworkUrl,
      duration: duration || 180,
      audioUrl: audioUrl,
      provider: 'cloudinary',
      isPlayable: true,
      isPreview: false,
      uploadedAt: new Date().toISOString(),
      fileSize: audioFile.size
    };

    this.uploadedTracks.unshift(newTrack);
    this._persistTracks();
    this._notify();
    onProgress && onProgress(100, 'Upload complete! Track is ready to stream.');

    return newTrack;
  }

  async _uploadToCloudinary(file, resourceType = 'auto') {
    const endpoint = `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Cloudinary upload failed (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.secure_url || data.url;
  }

  removeTrack(id) {
    const idx = this.uploadedTracks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.uploadedTracks.splice(idx, 1);
      this._persistTracks();
      this._notify();
    }
  }
}

export const cloudUploads = new CloudUploadsManager();
