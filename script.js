const CLIENT_ID = "23d1200b4f6e4d7fa2a0fcc8ae3de7c8";
const REDIRECT_URI = "https://vvggmm.github.io/spotify-playlist-app/";
const SCOPES = "playlist-modify-private playlist-modify-public";

function login() {
  const url =
    `https://accounts.spotify.com/authorize?response_type=token&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}`;
  window.location = url;
}

document.getElementById("loginBtn").onclick = login;

const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const token = params.get("access_token");

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
