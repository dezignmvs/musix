/**
 * Firebase Client & State Provider
 * Pre-configured with User's Firebase Project (warhouse-79e3c)
 */

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBWuVTq7LUPCJKvkCKb-VKP9m4_JtzFzQo",
  authDomain: "warhouse-79e3c.firebaseapp.com",
  projectId: "warhouse-79e3c",
  storageBucket: "warhouse-79e3c.firebasestorage.app",
  messagingSenderId: "306485782478",
  appId: "1:306485782478:web:029dbb1f775b817fbe2d9f",
  measurementId: "G-T97D1FGYBN"
};

const FIREBASE_SDK_VERSION = '10.12.0';

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.isConfigured = false;
    this.initPromise = this._init();
  }

  async _init() {
    let config = DEFAULT_FIREBASE_CONFIG;
    const customConfigStr = localStorage.getItem('firebase_config');
    if (customConfigStr) {
      try {
        config = JSON.parse(customConfigStr);
      } catch (e) {
        config = DEFAULT_FIREBASE_CONFIG;
      }
    }

    try {
      const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`);
      const { getAuth } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`);
      const { getFirestore } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`);

      this.app = initializeApp(config);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.isConfigured = true;
      console.info('[Firebase] Connected to project:', config.projectId);
      return true;
    } catch (err) {
      console.warn('[Firebase] Initialization error:', err);
      this.isConfigured = false;
      return false;
    }
  }

  setFirebaseConfig(configObj) {
    if (!configObj) return;
    localStorage.setItem('firebase_config', JSON.stringify(configObj));
    return this._init();
  }

  getSavedConfig() {
    try {
      const saved = localStorage.getItem('firebase_config');
      return saved ? JSON.parse(saved) : DEFAULT_FIREBASE_CONFIG;
    } catch (e) {
      return DEFAULT_FIREBASE_CONFIG;
    }
  }
}

export const firebaseService = new FirebaseService();
