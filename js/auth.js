/**
 * Authentication Module
 * Supports Firebase Anonymous Authentication by default and Email/Password credentials
 */

import { firebaseService } from './firebase.js';

const FIREBASE_SDK_VERSION = '10.12.0';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.listeners = new Set();
    this._loadLocalUser();
    this._initFirebaseAuth();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.currentUser);
    return () => this.listeners.delete(fn);
  }

  _notify() {
    this.listeners.forEach(fn => fn(this.currentUser));
  }

  _loadLocalUser() {
    try {
      const stored = localStorage.getItem('active_user_session');
      if (stored) {
        this.currentUser = JSON.parse(stored);
      } else {
        this.currentUser = {
          uid: 'guest_' + Math.random().toString(36).substr(2, 8),
          displayName: 'Anonymous Listener',
          email: null,
          isAnonymous: true,
          photoURL: null
        };
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  async _initFirebaseAuth() {
    await firebaseService.initPromise;
    if (firebaseService.isConfigured && firebaseService.auth) {
      const { onAuthStateChanged, signInAnonymously } = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`
      );

      onAuthStateChanged(firebaseService.auth, async (user) => {
        if (user) {
          this.currentUser = {
            uid: user.uid,
            displayName: user.displayName || (user.isAnonymous ? 'Anonymous Listener' : user.email?.split('@')[0]),
            email: user.email,
            isAnonymous: user.isAnonymous,
            photoURL: user.photoURL
          };
          localStorage.setItem('active_user_session', JSON.stringify(this.currentUser));
          console.info('[Auth] User active:', this.currentUser.uid, 'Anonymous:', user.isAnonymous);
          this._notify();
        } else {
          // Automatically sign in anonymously as requested
          try {
            console.info('[Auth] Initiating Anonymous Sign-In...');
            const anonCred = await signInAnonymously(firebaseService.auth);
            this.currentUser = {
              uid: anonCred.user.uid,
              displayName: 'Anonymous Listener',
              email: null,
              isAnonymous: true,
              photoURL: null
            };
            localStorage.setItem('active_user_session', JSON.stringify(this.currentUser));
            this._notify();
          } catch (err) {
            console.warn('[Auth] Anonymous sign-in failed, keeping local session:', err.message);
            this._loadLocalUser();
            this._notify();
          }
        }
      });
    }
  }

  async signInAnon() {
    if (firebaseService.isConfigured && firebaseService.auth) {
      const { signInAnonymously } = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`
      );
      const cred = await signInAnonymously(firebaseService.auth);
      return cred.user;
    }
    return this.currentUser;
  }

  async signUp(email, password, displayName) {
    if (firebaseService.isConfigured && firebaseService.auth) {
      const { createUserWithEmailAndPassword, updateProfile } = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`
      );
      const cred = await createUserWithEmailAndPassword(firebaseService.auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      return cred.user;
    } else {
      this.currentUser = {
        uid: `user_${Date.now()}`,
        displayName: displayName || email.split('@')[0],
        email: email,
        isAnonymous: false,
        photoURL: null
      };
      localStorage.setItem('active_user_session', JSON.stringify(this.currentUser));
      this._notify();
      return this.currentUser;
    }
  }

  async login(email, password) {
    if (firebaseService.isConfigured && firebaseService.auth) {
      const { signInWithEmailAndPassword } = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`
      );
      const cred = await signInWithEmailAndPassword(firebaseService.auth, email, password);
      return cred.user;
    } else {
      this.currentUser = {
        uid: `user_${Date.now()}`,
        displayName: email.split('@')[0],
        email: email,
        isAnonymous: false,
        photoURL: null
      };
      localStorage.setItem('active_user_session', JSON.stringify(this.currentUser));
      this._notify();
      return this.currentUser;
    }
  }

  async logout() {
    if (firebaseService.isConfigured && firebaseService.auth) {
      const { signOut } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`);
      await signOut(firebaseService.auth);
    }
    localStorage.removeItem('active_user_session');
    // Automatically re-sign in anonymously
    this._loadLocalUser();
    this.signInAnon();
  }

  getUser() {
    return this.currentUser;
  }
}

export const auth = new AuthManager();
