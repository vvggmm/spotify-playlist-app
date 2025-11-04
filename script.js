const CLIENT_ID = "23d1200b4f6e4d7fa2a0fcc8ae3de7c8";
const REDIRECT_URI = "https://vvggmm.github.io/spotify-playlist-app/";
const SCOPES = "playlist-modify-private playlist-modify-public user-read-private";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";

/* --- Manejo del redirect (Authorization Code + PKCE) --- */
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return; // no hay code -> nada que hacer

  const verifier = localStorage.getItem("verifier");
  if (!verifier) {
    console.error("No code_verifier en localStorage");
    return;
  }

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

  if (data.access_token) {
    localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
  } else {
    console.error("Error al obtener token:", data);
  }

  // limpiar URL (quita ?code=)
  history.replaceState(null, "", REDIRECT_URI);

  // inicializar la app ahora que tenemos token
  initApp();
}

/* --- Utils token --- */
function getToken() {
  return localStorage.getItem("access_token");
}

/* --- PKCE helpers --- */
async function generateCodeVerifier() {
  // generar string aleatorio
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input) {
  // input: ArrayBuffer
  const bytes = new Uint8Array(input);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function generateCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64encode(hashed);
}

/* --- Login (genera verifier/challenge y redirige) --- */
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
    scope: SCOPES
  });

  window.location = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/* --- UI init: muestra app si hay token y asigna listeners --- */
function initApp() {
  const token = getToken();

  // asignar listener del botón de login (si existe)
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", login);
  }

  if (token) {
    document.getElementById("app").style.display = "block";
    if (loginBtn) loginBtn.style.display = "none";

    // llenar textarea con canciones predefinidas
    if (window.SONGS && document.getElementById("songInput")) {
      document.getElementById("songInput").value = window.SONGS.join("\n");
    }
  } else {
    // si no hay token, asegurar que app esté oculta
    document.getElementById("app").style.display = "none";
    if (loginBtn) loginBtn.style.display = "inline-block";
  }

  // asignar createBtn (no hace falta chequear si ya lo hizo)
  const createBtn = document.getElementById("createBtn");
  if (createBtn) createBtn.onclick = createPlaylist;
}

/* --- Logging simple --- */
function log(t) {
  const el = document.getElementById("log");
  if (!el) return;
  el.textContent += t + "\n";
  el.scrollTop = el.scrollHeight;
}

/* --- Crear playlist (usa getToken() en cada llamada) --- */
async function createPlaylist() {
  const token = getToken();
  const name = document.getElementById("playlistName").value.trim();
  if (!name) return alert("Ingresa nombre");
  if (!token) return alert("No estás autenticado. Logueate primero.");

  // obtener user
  const me = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  if (!me.id) {
    log("❌ Error obteniendo usuario (token inválido).");
    return;
  }

  const playlist = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
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
  }).then(r => r.json());

  log(`✅ Playlist creada: ${playlist.name}`);

  const songLines = document.getElementById("songInput").value.split("\n").map(s => s.trim()).filter(Boolean);
  const uris = [];

  for (const song of songLines) {
    try {
      const data = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(song)}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json());

      const uri = data.tracks?.items?.[0]?.uri;
      log(uri ? `✔️ ${song}` : `❌ ${song}`);
      if (uri) uris.push(uri);
    } catch (e) {
      log(`⚠️ Error buscando ${song}`);
    }
  }

  if (uris.length) {
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris })
    });
    log("🔥 Playlist completa!");
  } else {
    log("⚠️ No se encontraron tracks para agregar.");
  }
}

/* --- Ejecutar al cargar --- */
handleRedirect(); // si viene ?code=... lo procesa y luego llama a initApp
initApp();        // inicializa UI si ya hay token en localStorage
