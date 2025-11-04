const CLIENT_ID = "23d1200b4f6e4d7fa2a0fcc8ae3de7c8";
const REDIRECT_URI = "https://vvggmm.github.io/spotify-playlist-app/";
const SCOPES = "playlist-modify-private playlist-modify-public";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return;

  const verifier = localStorage.getItem("verifier");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = await res.json();
  localStorage.setItem("access_token", data.access_token);

  history.replaceState(null, "", "/"); // 🔥 esto limpia la URL

  console.log("✅ Token obtenido");
}

handleRedirect();

function getToken() {
  return localStorage.getItem("access_token");
}

async function generateCodeVerifier() {
  const array = new Uint32Array(56/2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function generateCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64encode(hashed);
}


async function login() {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: "playlist-modify-private playlist-modify-public user-read-private"
  });

  window.location = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

document.getElementById("loginBtn").onclick = login;

const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const token = getToken();

// si hay token, mostrar UI
if (token) {
  document.getElementById("app").style.display = "block";
  document.getElementById("loginBtn").style.display = "none";

  // cargar canciones predefinidas en textarea
  document.getElementById("songInput").value = window.SONGS.join("\n");
}

function log(t) {
  document.getElementById("log").textContent += t + "\n";
}

async function createPlaylist() {
  const name = document.getElementById("playlistName").value.trim();
  if (!name) return alert("Ingresa nombre");

  const user = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  const playlist = await fetch(
    `https://api.spotify.com/v1/users/${user.id}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        description: "Rock vibes estilo Greta Van Fleet 🤘",
        public: false
      })
    }
  ).then(r => r.json());

  log(`✅ Playlist creada: ${playlist.name}`);

  // tomar canciones del textarea
  const songLines = document.getElementById("songInput").value.split("\n").map(s => s.trim()).filter(Boolean);

  const uris = [];

  for (const song of songLines) {
    const data = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(song)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());

    const uri = data.tracks?.items?.[0]?.uri;
    log(uri ? `✔️ ${song}` : `❌ ${song}`);

    if (uri) uris.push(uri);
  }

  await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris })
  });

  log("🔥 Playlist completa!");
}

document.getElementById("createBtn").onclick = createPlaylist;

