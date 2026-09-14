// src/auth.js

import { GOOGLE_CLIENT_ID } from './config.js';

/**
 * Google sign-in for identifying the DM, per the spec: "Google login
 * identifies the DM (ownership/authorship), not multiuser sync." This is
 * purely client-side via Google Identity Services (GIS) — no backend, no
 * server-side session. The ID token is decoded locally just to read the
 * signed-in person's name/email/picture; nothing is sent anywhere else.
 */

let currentUser = null;
let onSignInCallback = null;

function isConfigured() {
  return GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes('PASTE_YOUR');
}

function decodeJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

function handleCredentialResponse(response) {
  const payload = decodeJwt(response.credential);
  currentUser = {
    name: payload.name,
    email: payload.email,
    picture: payload.picture
  };
  if (onSignInCallback) onSignInCallback(currentUser);
}

function waitForGoogleScript(attemptsLeft, onReady) {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    onReady();
    return;
  }
  if (attemptsLeft <= 0) {
    console.warn('Google Identity Services script never loaded (check the <script> tag in index.html).');
    return;
  }
  setTimeout(() => waitForGoogleScript(attemptsLeft - 1, onReady), 200);
}

/**
 * Renders the Sign-In button into the given container element ID and calls
 * onSignIn(user) once the DM successfully signs in. Safe to call even if
 * config.js hasn't been filled in yet — shows a placeholder instead of
 * throwing.
 */
export function initGoogleSignIn(buttonContainerId, onSignIn) {
  const container = document.getElementById(buttonContainerId);
  if (!container) return;

  if (!isConfigured()) {
    container.innerHTML = '<span class="dm-signin-placeholder">Add your Google Client ID in src/config.js to enable sign-in.</span>';
    return;
  }

  onSignInCallback = onSignIn;

  waitForGoogleScript(25, () => {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large' });
  });
}

export function getCurrentUser() {
  return currentUser;
}

export function signOut() {
  currentUser = null;
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.disableAutoSelect();
  }
}
