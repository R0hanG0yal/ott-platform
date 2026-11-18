/* ==========================================================================
   NETFLIX OTT FRONTEND — 100% COMPATIBLE WITH schema.sql, data.sql & main.py
   Mobile-First Native Netflix Experience + Responsive Desktop
   ========================================================================== */

const API_BASE = "";

// Poster metadata & dynamic ambient glow colors mapped to seeded Content titles
const TITLE_ARTWORK = {
  "money heist": {
    poster: "/posters/money-heist.jpg",
    fallback: "/posters/money-heist.svg",
    glow: "rgba(185, 14, 24, 0.62)",
    tagline: "The biggest heist in history.",
  },
  "3 idiots": {
    poster: "/posters/3-idiots.svg",
    fallback: "/posters/3-idiots.svg",
    glow: "rgba(218, 126, 28, 0.56)",
    tagline: "Chase excellence, success will follow.",
  },
  "stranger things": {
    poster: "/posters/stranger-things.svg",
    fallback: "/posters/stranger-things.svg",
    glow: "rgba(168, 14, 48, 0.58)",
    tagline: "Every ending has a beginning.",
  },
  jawan: {
    poster: "/posters/jawan.jpg",
    fallback: "/posters/jawan.svg",
    glow: "rgba(204, 58, 14, 0.58)",
    tagline: "Ready to ignite justice.",
  },
  "kota factory": {
    poster: "/posters/kota-factory.svg",
    fallback: "/posters/kota-factory.svg",
    glow: "rgba(115, 115, 125, 0.48)",
    tagline: "Black, white, and every dream in between.",
  },
};

const AVATAR_PALETTES = [
  { bg: "linear-gradient(135deg, #e50914, #8f040b)", eye: "#fff" },
  { bg: "linear-gradient(135deg, #0071eb, #003c8f)", eye: "#fff" },
  { bg: "linear-gradient(135deg, #00b894, #006652)", eye: "#fff" },
  { bg: "linear-gradient(135deg, #f39c12, #b96400)", eye: "#fff" },
  { bg: "linear-gradient(135deg, #8e44ad, #4a148c)", eye: "#fff" },
];

const KIDS_AVATAR_BG = "linear-gradient(135deg, #ff512f 0%, #f09819 48%, #00c6ff 100%)";

// Application State
const state = {
  health: null,
  screen: "auth", // 'auth' | 'profiles' | 'app'
  authTab: "signin", // 'signin' | 'signup'
  authError: "",
  authLoading: false,
  editProfilesMode: false,

  user: null,
  profiles: [],
  activeProfile: null,
  subscription: null,
  dashboard: null,

  activeTab: "home", // 'home' | 'search' | 'plans' | 'my-netflix'
  homeTypeFilter: "", // '' | 'Series' | 'Movie'
  homeGenreFilter: "",
  heroIndex: 0,

  content: [],
  filterMeta: { genres: [], languages: [], years: [], maturity_ratings: [], types: [] },

  // Search tab state
  searchQuery: "",
  searchFilters: { type: "", language: "", genre: "", year: "", maturity: "" },
  searchResults: [],

  // Plans tab state
  plans: [],
  selectedPlanId: null,
  paymentMethod: "UPI",
  subscribing: false,

  // Active modals & player
  modal: null, // { type: 'detail' | 'categories' | 'add-profile' | 'admin', data?: any }
  player: null, // { item, progress, playing, speed, timerId }
  scrolled: false,
};

// -------------------- Utilities --------------------
function esc(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuration(mins, type) {
  const m = Number(mins) || 0;
  if (!m) return "";
  if (String(type).toLowerCase() === "series") return `${m}m / ep`;
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function generateFallbackPosterDataUri(title, type) {
  const safeTitle = String(title || "NETFLIX").replace(/[<>&"]/g, "");
  const isSeries = String(type).toLowerCase() === "series";
  const hue = (safeTitle.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue}, 62%, 22%)"/>
        <stop offset="100%" stop-color="#070709"/>
      </linearGradient>
    </defs>
    <rect width="400" height="600" fill="url(#g)"/>
    <circle cx="200" cy="240" r="130" fill="hsl(${hue}, 80%, 45%)" opacity="0.22"/>
    <text x="200" y="290" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="34" text-anchor="middle">${safeTitle.slice(0, 18)}</text>
    <text x="200" y="330" fill="#e50914" font-family="sans-serif" font-weight="800" font-size="14" letter-spacing="4" text-anchor="middle">${isSeries ? "N SERIES" : "N FILM"}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getArtwork(item) {
  const key = String(item?.Title || "").trim().toLowerCase();
  if (TITLE_ARTWORK[key]) return TITLE_ARTWORK[key];
  const fallback = generateFallbackPosterDataUri(item?.Title, item?.Type);
  return { poster: fallback, fallback, glow: "rgba(180, 16, 28, 0.5)", tagline: item?.Description || "" };
}

function showToast(message, variant = "default") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `nf-toast ${variant}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.25s";
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function saveSession() {
  if (!state.user) {
    localStorage.removeItem("nf_ott_session");
    return;
  }
  localStorage.setItem(
    "nf_ott_session",
    JSON.stringify({
      user_id: state.user.User_id,
      profile_id: state.activeProfile?.Profile_id || null,
    })
  );
}

// -------------------- Authentic Netflix SVG Graphics --------------------
function svgNetflixWordmark(height = 28) {
  return `<svg class="nf-wordmark" style="height:${height}px" viewBox="0 0 111 30" fill="#E50914" aria-label="NETFLIX">
    <path d="M105.062 14.28L111 30c-1.75-.25-3.499-.563-5.28-.845l-3.345-8.686-3.437 7.969c-1.687-.282-3.344-.376-5.031-.595l6.031-13.75L94.468 0h5.063l3.062 7.874L105.875 0h5.124l-5.937 14.28zM90.47 0h-4.594v27.25c1.5.094 3.062.156 4.594.343V0zm-8.563 26.937c-4.187-.281-8.375-.53-12.656-.625V0h4.687v21.875c2.688.062 5.375.28 7.969.405v4.657zM64.25 10.657v4.687h-6.406V26H53.22V0h13.125v4.687h-8.5v5.97h6.406zm-18.906-5.97V26.25c-1.563 0-3.156 0-4.688.062V4.687h-4.844V0h14.406v4.687h-4.874zM30.75 15.593c-2.062 0-4.5 0-6.25.095v6.968c2.75-.188 5.5-.406 8.281-.5v4.5l-12.968 1.032V0H32.78v4.687H24.5V11c1.813 0 4.594-.094 6.25-.094v4.688zM4.78 12.968v16.375C3.094 29.531 1.593 29.75 0 30V0h4.469l6.093 17.032V0h4.688v28.062c-1.656.282-3.344.376-5.125.625L4.78 12.968z"/>
  </svg>`;
}

function svgNetflixRibbon(height = 28) {
  return `<svg class="nf-ribbon" style="height:${height}px" viewBox="0 0 24 44" aria-label="N">
    <path d="M2 0h7.2v44H2z" fill="#B1060F"/>
    <path d="M14.8 0H22v44h-7.2z" fill="#B1060F"/>
    <path d="M2 0h7.4L22 44h-7.4z" fill="#E50914"/>
  </svg>`;
}

function svgSmileyAvatar(profile, index = 0) {
  const isKids = Boolean(profile?.Is_Kids);
  const bg = isKids ? KIDS_AVATAR_BG : AVATAR_PALETTES[index % AVATAR_PALETTES.length].bg;
  return `<div style="width:100%;height:100%;background:${bg};display:flex;align-items:center;justify-content:center;position:relative;">
    <svg viewBox="0 0 100 100" style="width:74%;height:74%">
      <circle cx="32" cy="38" r="7.5" fill="#fff"/>
      <circle cx="68" cy="38" r="7.5" fill="#fff"/>
      <path d="M26 60 Q52 78 76 57" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>
    </svg>
    ${isKids ? `<span class="profile-kids-pill">KIDS</span>` : ""}
  </div>`;
}

const ICONS = {
  home: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8z"/></svg>`,
  search: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>`,
  plans: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
  play: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>`,
  pause: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>`,
  chevronDown: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  db: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  plus: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  logout: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

// -------------------- Data Fetching --------------------
async function loadHealth() {
  try {
    state.health = await api("/api/health");
  } catch {
    state.health = { status: "error", db_mode: "offline" };
  }
}

async function loadAppData() {
  if (!state.user) return;
  const kidsOnly = Boolean(state.activeProfile?.Is_Kids);
  const [content, meta, plans, dashboard] = await Promise.all([
    api(`/api/content?user_id=${state.user.User_id}&kids_only=${kidsOnly}`),
    api("/api/filters/meta"),
    api("/api/plans"),
    api(`/api/users/${state.user.User_id}/dashboard`),
  ]);
  state.content = content;
  state.filterMeta = meta;
  state.plans = plans;
  state.dashboard = dashboard;
  state.profiles = dashboard.profiles || state.profiles;
  state.subscription = dashboard.active_subscription;
  if (!state.selectedPlanId && plans.length) {
    state.selectedPlanId = plans[plans.length - 1].Plan_id;
  }
  await runSearchQuery(false);
}

async function runSearchQuery(shouldRender = true) {
  if (!state.user) return;
  const params = new URLSearchParams();
  params.set("user_id", String(state.user.User_id));
  if (state.activeProfile?.Is_Kids) params.set("kids_only", "true");
  if (state.searchQuery.trim()) params.set("q", state.searchQuery.trim());
  Object.entries(state.searchFilters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  state.searchResults = await api(`/api/content?${params.toString()}`);
  if (shouldRender) render();
}

// -------------------- Auth & Profile Actions --------------------
async function handleSignIn(email, password) {
  state.authError = "";
  state.authLoading = true;
  render();
  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.user = res.user;
    state.profiles = res.profiles || [];
    state.subscription = res.subscription;
    state.activeProfile = null;
    state.screen = "profiles";
    saveSession();
    showToast(`Welcome back, ${res.user.Name}!`, "success");
  } catch (err) {
    state.authError = err.message;
  } finally {
    state.authLoading = false;
    render();
  }
}

async function handleSignUp(formData) {
  state.authError = "";
  state.authLoading = true;
  render();
  try {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    state.user = res.user;
    state.profiles = res.profiles || [];
    state.subscription = res.subscription;
    state.activeProfile = res.profiles?.[0] || null;
    state.screen = "app";
    state.activeTab = "plans"; // Guide new users to pick a plan just like Netflix!
    saveSession();
    await loadAppData();
    showToast("Account created! Choose a plan to start streaming.", "success");
  } catch (err) {
    state.authError = err.message;
  } finally {
    state.authLoading = false;
    render();
  }
}

async function selectProfile(profile) {
  state.activeProfile = profile;
  state.screen = "app";
  state.heroIndex = 0;
  state.homeTypeFilter = "";
  state.homeGenreFilter = "";
  saveSession();
  await loadAppData();
  render();
  if (profile.Is_Kids) {
    showToast("Kids Mode enabled — showing family-friendly titles", "success");
  }
}

function signOut() {
  stopPlayer(false);
  state.user = null;
  state.profiles = [];
  state.activeProfile = null;
  state.dashboard = null;
  state.subscription = null;
  state.modal = null;
  state.screen = "auth";
  saveSession();
  render();
  showToast("Signed out of Netflix");
}

// -------------------- Content Detail & Player Actions --------------------
async function openTitleDetail(contentId) {
  try {
    const detail = await api(`/api/content/${contentId}?user_id=${state.user.User_id}`);
    state.modal = {
      type: "detail",
      data: detail,
      draftProgress: Math.round(detail.user_progress || 0),
      draftRating: detail.user_rating ? Math.round(detail.user_rating) : 5,
      draftReview: detail.user_review_text || "",
    };
    renderModal();
  } catch (err) {
    showToast(err.message);
  }
}

async function saveWatchProgress(contentId, progressPct, notify = true) {
  try {
    const res = await api("/api/watch", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.user.User_id,
        content_id: contentId,
        progress_percentage: Number(progressPct),
      }),
    });
    await loadAppData();
    if (state.modal?.type === "detail" && state.modal.data.Content_id === contentId) {
      state.modal.data = await api(`/api/content/${contentId}?user_id=${state.user.User_id}`);
      state.modal.draftProgress = Math.round(res.Progress_percentage);
      renderModal();
    }
    render();
    if (notify) {
      showToast(
        res.Completed ? "Marked as Completed (100%)" : `Saved progress: ${Math.round(res.Progress_percentage)}%`,
        "success"
      );
    }
  } catch (err) {
    showToast(err.message);
  }
}

async function submitTitleReview(contentId, rating, reviewText) {
  try {
    const res = await api("/api/reviews", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.user.User_id,
        content_id: contentId,
        rating: Number(rating),
        review_text: reviewText,
      }),
    });
    await loadAppData();
    state.modal.data = await api(`/api/content/${contentId}?user_id=${state.user.User_id}`);
    renderModal();
    render();
    showToast(res.message, "success");
  } catch (err) {
    showToast(err.message);
  }
}

function startPlayer(item) {
  state.modal = null;
  renderModal();
  const initialProgress = item.user_progress >= 99 ? 0 : Math.round(item.user_progress || 0);
  state.player = {
    item,
    progress: initialProgress,
    playing: true,
    speed: 1,
    timerId: null,
  };
  startPlayerTick();
  renderPlayer();
}

function startPlayerTick() {
  if (!state.player) return;
  if (state.player.timerId) clearInterval(state.player.timerId);
  state.player.timerId = setInterval(() => {
    if (!state.player || !state.player.playing) return;
    state.player.progress = Math.min(100, +(state.player.progress + 0.8 * state.player.speed).toFixed(1));
    const range = document.getElementById("player-scrubber");
    const pctEl = document.getElementById("player-pct-label");
    const elapsedEl = document.getElementById("player-elapsed-label");
    if (range) range.value = String(state.player.progress);
    if (pctEl) pctEl.textContent = `${Math.round(state.player.progress)}%`;
    if (elapsedEl) {
      const totalMins = Number(state.player.item.Duration) || 60;
      const curMins = Math.round((state.player.progress / 100) * totalMins);
      elapsedEl.textContent = `${curMins}m / ${totalMins}m`;
    }
    if (state.player.progress >= 100) {
      state.player.playing = false;
      clearInterval(state.player.timerId);
      saveWatchProgress(state.player.item.Content_id, 100, true);
      renderPlayer();
    }
  }, 1000);
}

async function stopPlayer(shouldSave = true) {
  if (!state.player) return;
  const { item, progress, timerId } = state.player;
  if (timerId) clearInterval(timerId);
  state.player = null;
  renderPlayer();
  if (shouldSave && state.user) {
    await saveWatchProgress(item.Content_id, Math.round(progress), true);
  }
}

// -------------------- Subscription Checkout Action --------------------
async function executeSubscription(methodOverride = null) {
  if (!state.selectedPlanId || !state.user) return;
  const method = methodOverride || state.paymentMethod;
  state.subscribing = true;
  render();
  try {
    const res = await api("/api/subscribe", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.user.User_id,
        plan_id: state.selectedPlanId,
        method,
      }),
    });
    await loadAppData();
    showToast(
      `${res.Plan_name} Plan activated! Valid till ${formatDateShort(res.End_date)}`,
      "success"
    );
  } catch (err) {
    showToast(err.message);
  } finally {
    state.subscribing = false;
    render();
  }
}

// -------------------- Render: Auth Screen --------------------
function renderAuthScreen() {
  const isMySql = state.health?.db_mode === "mysql";
  const dbLabel = isMySql ? "MySQL Live · Netflix_OTT" : "Local Mirror · schema.sql + data.sql";

  return `
    <div class="auth-screen">
      <div class="auth-backdrop">
        <img src="/posters/money-heist.jpg" onerror="this.src='/posters/money-heist.svg'" alt="" />
        <img src="/posters/jawan.jpg" onerror="this.src='/posters/jawan.svg'" alt="" />
        <img src="/posters/stranger-things.svg" alt="" />
        <img src="/posters/3-idiots.svg" alt="" />
        <img src="/posters/kota-factory.svg" alt="" />
        <img src="/posters/money-heist.svg" alt="" />
      </div>

      <header class="auth-header">
        ${svgNetflixWordmark(26)}
        <span class="auth-mode-pill" title="${esc(state.health?.mysql_error || "Connected")}">
          <span class="status-dot ${isMySql ? "" : "mirror"}"></span>
          ${esc(dbLabel)}
        </span>
      </header>

      <main class="auth-body">
        <div class="auth-card">
          <div class="auth-tabs">
            <button class="auth-tab ${state.authTab === "signin" ? "active" : ""}" data-auth-tab="signin">Sign In</button>
            <button class="auth-tab ${state.authTab === "signup" ? "active" : ""}" data-auth-tab="signup">Sign Up</button>
          </div>

          ${state.authError ? `<div class="form-error">${esc(state.authError)}</div>` : ""}

          ${
            state.authTab === "signin"
              ? `
                <h1>Sign In</h1>
                <p class="auth-subtitle">Stream unlimited movies & series synced with your Netflix_OTT database.</p>
                <form id="signin-form">
                  <div class="nf-field">
                    <label for="login-email">Email</label>
                    <input class="nf-input" id="login-email" type="email" required placeholder="aarav@gmail.com" autocomplete="email" />
                  </div>
                  <div class="nf-field">
                    <label for="login-password">Password</label>
                    <input class="nf-input" id="login-password" type="password" required placeholder="Enter your password" autocomplete="current-password" />
                  </div>
                  <button class="btn-nf-primary" type="submit" ${state.authLoading ? "disabled" : ""}>
                    ${state.authLoading ? "Signing In..." : "Sign In"}
                  </button>
                </form>

                <div class="demo-accounts">
                  <div class="demo-accounts-title">Quick Sign In (Seeded in data.sql · pass123)</div>
                  <div class="demo-chip-list">
                    <button class="demo-chip" data-demo-email="aarav@gmail.com" data-demo-pass="pass123">
                      <span class="demo-chip-main">
                        <span class="demo-chip-name">Aarav Sharma</span>
                        <span class="demo-chip-email">aarav@gmail.com · 2 Profiles (incl. Kids)</span>
                      </span>
                      <span class="plan-badge active">Premium 4K</span>
                    </button>
                    <button class="demo-chip" data-demo-email="priya@gmail.com" data-demo-pass="pass123">
                      <span class="demo-chip-main">
                        <span class="demo-chip-name">Priya Singh</span>
                        <span class="demo-chip-email">priya@gmail.com · Rated 2 titles</span>
                      </span>
                      <span class="plan-badge active">Standard 1080p</span>
                    </button>
                    <button class="demo-chip" data-demo-email="rohan@gmail.com" data-demo-pass="pass123">
                      <span class="demo-chip-main">
                        <span class="demo-chip-name">Rohan Verma</span>
                        <span class="demo-chip-email">rohan@gmail.com · Test renewal flow</span>
                      </span>
                      <span class="plan-badge expired">Basic · Expired</span>
                    </button>
                  </div>
                </div>
              `
              : `
                <h1>Create Account</h1>
                <p class="auth-subtitle">Creates your User & first Profile with pbkdf2_sha256 hashing matching main.py.</p>
                <form id="signup-form">
                  <div class="nf-field">
                    <label for="reg-name">Full Name</label>
                    <input class="nf-input" id="reg-name" required placeholder="e.g. Kabir Mehta" />
                  </div>
                  <div class="nf-field">
                    <label for="reg-email">Email</label>
                    <input class="nf-input" id="reg-email" type="email" required placeholder="kabir@gmail.com" />
                  </div>
                  <div class="nf-row-2">
                    <div class="nf-field">
                      <label for="reg-password">Password (8+ chars)</label>
                      <input class="nf-input" id="reg-password" type="password" minlength="8" required placeholder="Min 8 chars" />
                    </div>
                    <div class="nf-field">
                      <label for="reg-phone">Phone</label>
                      <input class="nf-input" id="reg-phone" type="tel" placeholder="9876543219" />
                    </div>
                  </div>
                  <div class="nf-row-2">
                    <div class="nf-field">
                      <label for="reg-profile">First Profile Name</label>
                      <input class="nf-input" id="reg-profile" required placeholder="Kabir" />
                    </div>
                    <div class="nf-field">
                      <label for="reg-age">Age (optional)</label>
                      <input class="nf-input" id="reg-age" type="number" min="0" max="120" placeholder="22" />
                    </div>
                  </div>
                  <label class="nf-checkbox-row">
                    <input type="checkbox" id="reg-kids" />
                    <span>Make this a <strong>Kids Profile</strong> (kid-safe U ratings)</span>
                  </label>
                  <button class="btn-nf-primary" type="submit" ${state.authLoading ? "disabled" : ""}>
                    ${state.authLoading ? "Creating Account..." : "Create Account & Continue"}
                  </button>
                </form>
              `
          }
        </div>
      </main>
    </div>
  `;
}

// -------------------- Render: Who's Watching? Profile Screen --------------------
function renderProfilesScreen() {
  return `
    <div class="profiles-screen">
      <div class="profiles-topbar">
        ${svgNetflixWordmark(24)}
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="profiles-topbar-btn" id="toggle-edit-profiles">
            ${state.editProfilesMode ? "Done" : "Edit"}
          </button>
          <button class="profiles-topbar-btn" id="profiles-signout">Sign Out</button>
        </div>
      </div>

      <div class="profiles-center">
        <h1>Who's watching?</h1>
        <div class="profiles-grid">
          ${state.profiles
            .map(
              (p, idx) => `
              <div class="profile-tile" data-select-profile="${p.Profile_id}">
                ${
                  state.editProfilesMode && state.profiles.length > 1
                    ? `<button class="profile-delete-badge" data-delete-profile="${p.Profile_id}" title="Delete Profile">✕</button>`
                    : ""
                }
                <div class="profile-avatar-box">
                  ${svgSmileyAvatar(p, idx)}
                </div>
                <span class="profile-tile-name">${esc(p.Profile_name)}${p.Age ? ` · ${p.Age}` : ""}</span>
              </div>
            `
            )
            .join("")}
          <button class="profile-tile" id="open-add-profile-btn">
            <div class="profile-avatar-box profile-avatar-add">${ICONS.plus}</div>
            <span class="profile-tile-name">Add Profile</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// -------------------- Render: Home Tab --------------------
function getFilteredHomeContent() {
  return state.content.filter((item) => {
    if (state.homeTypeFilter && String(item.Type).toLowerCase() !== state.homeTypeFilter.toLowerCase()) {
      return false;
    }
    if (state.homeGenreFilter && !(item.genres || []).includes(state.homeGenreFilter)) {
      return false;
    }
    return true;
  });
}

function renderPosterCard(item) {
  const art = getArtwork(item);
  return `
    <div class="poster-card" data-open-content="${item.Content_id}">
      <div class="poster-frame">
        <div class="poster-top-n">${svgNetflixRibbon(18)}</div>
        ${item.avg_rating ? `<span class="poster-rating-chip">★ ${item.avg_rating}</span>` : ""}
        <img src="${art.poster}" onerror="this.src='${art.fallback}'" alt="${esc(item.Title)}" loading="lazy" />
        <div class="poster-title-overlay">
          <div class="poster-title-text">${esc(item.Title)}</div>
          <div class="poster-sub-meta">${esc(item.Release_YEAR)} · ${esc(item.Maturity_rating || "")}</div>
        </div>
      </div>
    </div>
  `;
}

function renderHomeTab() {
  const filtered = getFilteredHomeContent();
  const heroPool = filtered.length ? filtered : state.content;
  const heroItem = heroPool[state.heroIndex % Math.max(1, heroPool.length)] || null;
  const heroArt = heroItem ? getArtwork(heroItem) : { glow: "rgba(180,14,24,0.5)" };
  document.documentElement.style.setProperty("--hero-glow", heroArt.glow);

  const sub = state.subscription;
  const isExpired = !sub || String(sub.Status).toLowerCase() !== "active";

  const continueWatching = (state.dashboard?.continue_watching || []).filter((cw) =>
    state.content.some((c) => c.Content_id === cw.Content_id)
  );
  const watchAgain = (state.dashboard?.completed_history || []).filter((wa) =>
    state.content.some((c) => c.Content_id === wa.Content_id)
  );

  // Top rated sorted by avg_rating desc
  const topRated = [...filtered]
    .sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0) || (b.review_count || 0) - (a.review_count || 0));

  const seriesList = filtered.filter((c) => String(c.Type).toLowerCase() === "series");
  const movieList = filtered.filter((c) => String(c.Type).toLowerCase() === "movie");

  // Genre shelves with at least 1 title
  const genreShelves = (state.filterMeta.genres || [])
    .map((genre) => ({
      genre,
      items: filtered.filter((c) => (c.genres || []).includes(genre)),
    }))
    .filter((s) => s.items.length > 0);

  return `
    <div class="home-ambient-wrap">
      <!-- Mobile Category Filter Chips -->
      <div class="mobile-filter-pills">
        <button class="filter-pill ${state.homeTypeFilter === "Series" ? "active" : ""}" data-home-type="Series">TV Shows</button>
        <button class="filter-pill ${state.homeTypeFilter === "Movie" ? "active" : ""}" data-home-type="Movie">Movies</button>
        <button class="filter-pill ${state.homeGenreFilter ? "active" : ""}" id="open-categories-btn">
          ${state.homeGenreFilter ? esc(state.homeGenreFilter) : "Categories"} ${ICONS.chevronDown}
        </button>
        ${
          state.homeTypeFilter || state.homeGenreFilter
            ? `<button class="filter-pill" id="clear-home-filters">✕ Clear</button>`
            : ""
        }
      </div>

      ${
        isExpired
          ? `
          <div class="sub-alert-banner">
            <div class="sub-alert-text">
              <strong>${sub ? `${esc(sub.Plan_name)} Plan Expired` : "No Active Subscription"}</strong>
              <span>${sub ? `Ended on ${formatDateShort(sub.End_date)}. Renew now for uninterrupted HD/4K.` : "Subscribe to unlock 4K UHD & multi-screen streaming."}</span>
            </div>
            <button class="sub-alert-cta" data-nav-tab="plans">Renew</button>
          </div>
          `
          : ""
      }

      <!-- Featured Mobile Hero Poster Card / Desktop Billboard -->
      ${
        heroItem
          ? `
          <section class="hero-section">
            <div class="hero-mobile-card">
              <img class="hero-poster-img" src="${heroArt.poster}" onerror="this.src='${heroArt.fallback}'" alt="${esc(heroItem.Title)}" />
              <div class="hero-scrim"></div>
              <div class="hero-overlay">
                <div class="hero-n-tag">
                  ${svgNetflixRibbon(16)}
                  <span>${String(heroItem.Type).toLowerCase() === "series" ? "SERIES" : "FILM"}</span>
                </div>
                <h1 class="hero-title">${esc(heroItem.Title)}</h1>
                <div class="hero-meta-dots">
                  ${(heroItem.genres || []).map((g) => `<span>${esc(g)}</span>`).join('<span class="hero-dot">•</span>')}
                  <span class="hero-dot">•</span>
                  <span>${esc(heroItem.Language)}</span>
                  <span class="hero-dot">•</span>
                  <span>${esc(heroItem.Release_YEAR)}</span>
                  <span class="hero-dot">•</span>
                  <span>${esc(heroItem.Maturity_rating)}</span>
                  ${heroItem.avg_rating ? `<span class="hero-dot">•</span><span style="color:#ffd54f">★ ${heroItem.avg_rating}</span>` : ""}
                </div>
                <p class="hero-desc-desktop">${esc(heroItem.Description)} — ${esc(heroArt.tagline)}</p>
                <div class="hero-actions">
                  <button class="btn-nf-white" data-play-content="${heroItem.Content_id}">
                    ${ICONS.play}
                    <span>${heroItem.user_progress > 0 && !heroItem.user_completed ? `Resume (${Math.round(heroItem.user_progress)}%)` : "Play"}</span>
                  </button>
                  <button class="btn-nf-glass" data-open-content="${heroItem.Content_id}">
                    ${ICONS.info}
                    <span>More Info</span>
                  </button>
                </div>
              </div>
            </div>
            ${
              heroPool.length > 1
                ? `<div class="hero-dots-nav">
                    ${heroPool
                      .map(
                        (_, i) =>
                          `<button class="hero-dot-btn ${i === state.heroIndex % heroPool.length ? "active" : ""}" data-hero-idx="${i}" aria-label="Featured ${i + 1}"></button>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
          </section>
          `
          : `<div class="tab-page"><div class="empty-state"><strong>No titles match this filter</strong>Try clearing your category filter.</div></div>`
      }
    </div>

    <div class="swimlanes-wrap">
      <!-- Continue Watching Row -->
      ${
        continueWatching.length
          ? `
          <section class="swimlane">
            <div class="swimlane-header">
              <h2 class="swimlane-title">Continue Watching for ${esc(state.activeProfile?.Profile_name || state.user?.Name)}</h2>
            </div>
            <div class="swimlane-row">
              ${continueWatching
                .map((cw) => {
                  const full = state.content.find((c) => c.Content_id === cw.Content_id) || cw;
                  const art = getArtwork(full);
                  const pct = Math.min(100, Math.max(0, Math.round(cw.Progress_percentage || 0)));
                  return `
                    <div class="cw-card">
                      <div class="cw-poster" data-play-content="${cw.Content_id}">
                        <img src="${art.poster}" onerror="this.src='${art.fallback}'" alt="${esc(cw.Title)}" />
                        <div class="cw-play-circle">${ICONS.play}</div>
                        <div class="cw-progress-track"><div class="cw-progress-fill" style="width:${pct}%"></div></div>
                      </div>
                      <div class="cw-footer">
                        <span class="cw-pct">${esc(cw.Title)} · ${pct}%</span>
                        <button class="cw-info-btn" data-open-content="${cw.Content_id}" title="Details">${ICONS.info}</button>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </section>
          `
          : ""
      }

      <!-- Top Rated on Netflix (Top 10 Style) -->
      ${
        topRated.length
          ? `
          <section class="swimlane">
            <div class="swimlane-header">
              <h2 class="swimlane-title">Top Rated on Netflix Today</h2>
            </div>
            <div class="swimlane-row">
              ${topRated
                .map((item, idx) => {
                  const art = getArtwork(item);
                  return `
                    <div class="top10-card" data-open-content="${item.Content_id}">
                      <span class="top10-rank">${idx + 1}</span>
                      <div class="poster-frame">
                        <div class="poster-top-n">${svgNetflixRibbon(16)}</div>
                        ${item.avg_rating ? `<span class="poster-rating-chip">★ ${item.avg_rating}</span>` : ""}
                        <img src="${art.poster}" onerror="this.src='${art.fallback}'" alt="${esc(item.Title)}" />
                        <div class="poster-title-overlay">
                          <div class="poster-title-text">${esc(item.Title)}</div>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </section>
          `
          : ""
      }

      <!-- Series Swimlane -->
      ${
        seriesList.length
          ? `
          <section class="swimlane">
            <div class="swimlane-header">
              <h2 class="swimlane-title">Binge-Worthy TV Series</h2>
              <button class="swimlane-link" data-nav-tab="search">Explore All ›</button>
            </div>
            <div class="swimlane-row">${seriesList.map(renderPosterCard).join("")}</div>
          </section>
          `
          : ""
      }

      <!-- Movies Swimlane -->
      ${
        movieList.length
          ? `
          <section class="swimlane">
            <div class="swimlane-header">
              <h2 class="swimlane-title">Blockbuster Movies</h2>
              <button class="swimlane-link" data-nav-tab="search">Explore All ›</button>
            </div>
            <div class="swimlane-row">${movieList.map(renderPosterCard).join("")}</div>
          </section>
          `
          : ""
      }

      <!-- Watch It Again (Completed Watch_history) -->
      ${
        watchAgain.length
          ? `
          <section class="swimlane">
            <div class="swimlane-header">
              <h2 class="swimlane-title">Watch It Again</h2>
            </div>
            <div class="swimlane-row">
              ${watchAgain
                .map((wa) => {
                  const full = state.content.find((c) => c.Content_id === wa.Content_id) || wa;
                  return renderPosterCard(full);
                })
                .join("")}
            </div>
          </section>
          `
          : ""
      }

      <!-- Dynamic Genre Rows -->
      ${genreShelves
        .map(
          (shelf) => `
          <section class="swimlane">
            <div class="swimlane-header">
              <h2 class="swimlane-title">${esc(shelf.genre)}</h2>
            </div>
            <div class="swimlane-row">${shelf.items.map(renderPosterCard).join("")}</div>
          </section>
        `
        )
        .join("")}
    </div>
  `;
}

// -------------------- Render: Search & Multi-Filter Tab --------------------
function renderSearchTab() {
  const f = state.searchFilters;
  const meta = state.filterMeta;
  const hasFilters = state.searchQuery || Object.values(f).some(Boolean);

  return `
    <div class="tab-page">
      <div class="search-bar-box">
        ${ICONS.search}
        <input
          id="search-query-input"
          class="search-input"
          type="search"
          placeholder="Search titles, actors, directors, genres..."
          value="${esc(state.searchQuery)}"
        />
        ${
          state.searchQuery
            ? `<button class="search-clear-btn" id="clear-search-text" aria-label="Clear">✕</button>`
            : ""
        }
      </div>

      <div class="filter-grid">
        <select class="filter-select" data-search-filter="type">
          <option value="">All Types</option>
          ${(meta.types || ["Movie", "Series"])
            .map((t) => `<option value="${esc(t)}" ${f.type === t ? "selected" : ""}>${esc(t)}</option>`)
            .join("")}
        </select>

        <select class="filter-select" data-search-filter="language">
          <option value="">All Languages</option>
          ${(meta.languages || [])
            .map((l) => `<option value="${esc(l)}" ${f.language === l ? "selected" : ""}>${esc(l)}</option>`)
            .join("")}
        </select>

        <select class="filter-select" data-search-filter="genre">
          <option value="">All Genres</option>
          ${(meta.genres || [])
            .map((g) => `<option value="${esc(g)}" ${f.genre === g ? "selected" : ""}>${esc(g)}</option>`)
            .join("")}
        </select>

        <select class="filter-select" data-search-filter="year">
          <option value="">Any Year</option>
          ${(meta.years || [])
            .map((y) => `<option value="${esc(y)}" ${String(f.year) === String(y) ? "selected" : ""}>${esc(y)}</option>`)
            .join("")}
        </select>

        <select class="filter-select" data-search-filter="maturity">
          <option value="">Maturity</option>
          ${(meta.maturity_ratings || [])
            .map((m) => `<option value="${esc(m)}" ${f.maturity === m ? "selected" : ""}>${esc(m)}</option>`)
            .join("")}
        </select>
      </div>

      <div class="search-results-meta">
        <span><strong>${state.searchResults.length}</strong> title(s) found${state.activeProfile?.Is_Kids ? " (Kids safe)" : ""}</span>
        ${hasFilters ? `<button class="swimlane-link" id="reset-all-search">Reset Filters</button>` : ""}
      </div>

      ${
        state.searchResults.length
          ? `
          <div class="search-list">
            ${state.searchResults
              .map((item) => {
                const art = getArtwork(item);
                return `
                  <div class="search-row-card" data-open-content="${item.Content_id}">
                    <div class="search-thumb">
                      <img src="${art.poster}" onerror="this.src='${art.fallback}'" alt="${esc(item.Title)}" />
                    </div>
                    <div class="search-row-info">
                      <div class="search-row-title">${esc(item.Title)}</div>
                      <div class="search-row-sub">
                        <span>${esc(item.Type)}</span>
                        <span>·</span>
                        <span>${esc(item.Release_YEAR)}</span>
                        <span>·</span>
                        <span>${esc(item.Language)}</span>
                        <span class="maturity-box">${esc(item.Maturity_rating)}</span>
                        ${item.avg_rating ? `<span style="color:#ffd54f">★ ${item.avg_rating}</span>` : ""}
                      </div>
                      ${
                        item.genres?.length
                          ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;">${esc(item.genres.join(" • "))}</div>`
                          : ""
                      }
                    </div>
                    <button class="search-play-btn" data-play-content="${item.Content_id}" title="Play">${ICONS.play}</button>
                  </div>
                `;
              })
              .join("")}
          </div>
          `
          : `<div class="empty-state"><strong>No content found</strong>Try adjusting your search or filters.</div>`
      }
    </div>
  `;
}

// -------------------- Render: Plans & Checkout Tab --------------------
function renderPlansTab() {
  const sub = state.subscription;
  const isActive = sub && String(sub.Status).toLowerCase() === "active";
  const selectedPlan = state.plans.find((p) => p.Plan_id === state.selectedPlanId) || state.plans[0];

  return `
    <div class="tab-page">
      <h1 class="page-heading">Choose your Netflix plan</h1>
      <p class="page-subheading">Upgrade or renew anytime. Every transaction syncs directly with Subscriptions & Payments.</p>

      <div class="current-sub-card">
        <div>
          <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:4px;">Current Membership</div>
          ${
            sub
              ? `
              <div style="font-size:18px;font-weight:800;">${esc(sub.Plan_name)} · ${esc(sub.Video_quality)}</div>
              <div style="font-size:13px;color:var(--text-secondary);margin-top:3px;">
                ${formatDateShort(sub.Start_date)} → ${formatDateShort(sub.End_date)} · Up to ${sub.Max_screens} screen(s)
              </div>
              `
              : `<div style="font-size:16px;font-weight:700;">No subscription yet</div>`
          }
        </div>
        <span class="plan-badge ${isActive ? "active" : sub ? "expired" : "none"}">
          ${isActive ? "Active" : sub ? "Expired" : "Inactive"}
        </span>
      </div>

      <div class="plans-grid">
        ${state.plans
          .map((plan, idx) => {
            const isSelected = selectedPlan?.Plan_id === plan.Plan_id;
            const tier = Math.min(3, idx + 1);
            return `
              <div class="plan-card ${isSelected ? "selected" : ""}" data-select-plan="${plan.Plan_id}">
                <div class="plan-card-header tier-${tier}">
                  ${tier === 3 ? `<span class="plan-popular-tag">Best Value</span>` : ""}
                  <div class="plan-card-name">${esc(plan.Plan_name)}</div>
                  <div class="plan-card-quality">${esc(plan.Video_quality)}</div>
                </div>
                <div class="plan-card-body">
                  <div class="plan-price-row">
                    <span class="plan-price">₹${Number(plan.Price).toFixed(0)}</span>
                    <span class="plan-period">/ ${plan.Duration_months} month${plan.Duration_months > 1 ? "s" : ""}</span>
                  </div>
                  <ul class="plan-specs">
                    <li><span>Video quality</span><strong>${esc(plan.Video_quality)}</strong></li>
                    <li><span>Supported screens</span><strong>${plan.Max_screens} device${plan.Max_screens > 1 ? "s" : ""}</strong></li>
                    <li><span>Billing cycle</span><strong>${plan.Duration_months} month(s)</strong></li>
                    <li><span>Ad-free streaming</span><strong>Included</strong></li>
                  </ul>
                  <button class="${isSelected ? "btn-nf-primary" : "btn-nf-glass"}" style="margin-top:auto;" data-select-plan="${plan.Plan_id}">
                    ${isSelected ? "✓ Selected" : `Select ${esc(plan.Plan_name)}`}
                  </button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>

      ${
        selectedPlan
          ? `
          <div class="checkout-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
              <div>
                <div style="font-size:16px;font-weight:800;">Complete Payment</div>
                <div style="font-size:13px;color:var(--text-secondary);">
                  ${esc(selectedPlan.Plan_name)} (${esc(selectedPlan.Video_quality)}) · ₹${Number(selectedPlan.Price).toFixed(2)}
                </div>
              </div>
              <span style="font-size:20px;font-weight:900;">₹${Number(selectedPlan.Price).toFixed(0)}</span>
            </div>

            <div class="payment-methods">
              <button class="pay-method-btn ${state.paymentMethod === "UPI" ? "active" : ""}" data-pay-method="UPI">
                ⚡ UPI
              </button>
              <button class="pay-method-btn ${state.paymentMethod === "Card" ? "active" : ""}" data-pay-method="Card">
                💳 Card
              </button>
            </div>

            <button class="btn-nf-primary" id="confirm-subscribe-btn" ${state.subscribing ? "disabled" : ""}>
              ${state.subscribing ? "Processing Transaction..." : `Pay ₹${Number(selectedPlan.Price).toFixed(0)} via ${state.paymentMethod}`}
            </button>

            <div class="failtest-row">
              <span>Want to verify ACID transaction rollback (from <code>main.py</code>)?</span>
              <button class="btn-failtest" id="failtest-subscribe-btn" ${state.subscribing ? "disabled" : ""}>
                Simulate FailTest
              </button>
            </div>
          </div>
          `
          : ""
      }
    </div>
  `;
}

// -------------------- Render: My Netflix Dashboard Tab --------------------
function renderMyNetflixTab() {
  const dash = state.dashboard || {};
  const sub = state.subscription;
  const isActive = sub && String(sub.Status).toLowerCase() === "active";
  const activeIdx = Math.max(
    0,
    state.profiles.findIndex((p) => p.Profile_id === state.activeProfile?.Profile_id)
  );

  return `
    <div class="tab-page">
      <div class="my-nf-hero">
        <div class="my-nf-avatar">${svgSmileyAvatar(state.activeProfile, activeIdx)}</div>
        <button class="my-nf-profile-btn" id="switch-profile-btn">
          <span>${esc(state.activeProfile?.Profile_name || state.user?.Name)}</span>
          ${ICONS.chevronDown}
        </button>
        <div class="my-nf-email">${esc(state.user?.Name)} · ${esc(state.user?.Email)}</div>
        <div class="my-nf-quick-actions">
          <button class="pill-action-btn" id="open-admin-drawer-btn">${ICONS.db} DB & Scheduler</button>
          <button class="pill-action-btn" id="my-nf-add-profile">+ Add Profile</button>
          <button class="pill-action-btn" id="my-nf-signout">${ICONS.logout} Sign Out</button>
        </div>
      </div>

      <!-- Ongoing Subscription -->
      <section class="dash-section">
        <div class="dash-section-title">
          <span>Ongoing Subscription</span>
          <button class="swimlane-link" data-nav-tab="plans">Change Plan ›</button>
        </div>
        <div class="dash-list">
          ${
            (dash.subscriptions || []).length
              ? dash.subscriptions
                  .slice(0, 3)
                  .map(
                    (s) => `
                  <div class="dash-card">
                    <div class="dash-card-col">
                      <span class="dash-card-title">${esc(s.Plan_name)} · ${esc(s.Video_quality)} (${s.Max_screens} screen${s.Max_screens > 1 ? "s" : ""})</span>
                      <span class="dash-card-meta">Sub #${s.Subscription_id} · ${formatDateShort(s.Start_date)} to ${formatDateShort(s.End_date)}</span>
                    </div>
                    <span class="plan-badge ${String(s.Status).toLowerCase() === "active" ? "active" : "expired"}">${esc(s.Status)}</span>
                  </div>
                `
                  )
                  .join("")
              : `<div class="dash-card"><span>No subscription history found.</span><button class="sub-alert-cta" data-nav-tab="plans">Subscribe</button></div>`
          }
        </div>
      </section>

      <!-- Continue Watching -->
      <section class="dash-section">
        <div class="dash-section-title">
          <span>Continue Watching (${(dash.continue_watching || []).length})</span>
        </div>
        ${
          (dash.continue_watching || []).length
            ? `<div class="dash-list">
                ${dash.continue_watching
                  .map(
                    (cw) => `
                    <div class="dash-card" style="cursor:pointer" data-open-content="${cw.Content_id}">
                      <div class="dash-card-col" style="flex:1">
                        <span class="dash-card-title">${esc(cw.Title)}</span>
                        <span class="dash-card-meta">${Math.round(cw.Progress_percentage)}% watched · ${esc(cw.Type)} · ${esc(cw.Language)}</span>
                        <div style="height:4px;background:rgba(255,255,255,0.14);border-radius:99px;margin-top:6px;overflow:hidden;">
                          <div style="height:100%;width:${Math.round(cw.Progress_percentage)}%;background:var(--nf-red);"></div>
                        </div>
                      </div>
                      <button class="search-play-btn" data-play-content="${cw.Content_id}">${ICONS.play}</button>
                    </div>
                  `
                  )
                  .join("")}
              </div>`
            : `<div class="empty-state"><strong>All caught up!</strong>No in-progress titles right now.</div>`
        }
      </section>

      <!-- My Ratings & Reviews -->
      <section class="dash-section">
        <div class="dash-section-title">
          <span>My Ratings & Reviews (${(dash.ratings || []).length})</span>
        </div>
        ${
          (dash.ratings || []).length
            ? `<div class="dash-list">
                ${dash.ratings
                  .map(
                    (r) => `
                    <div class="dash-card" style="cursor:pointer" data-open-content="${r.Content_id}">
                      <div class="dash-card-col">
                        <span class="dash-card-title">${esc(r.Title)}</span>
                        <span class="dash-card-meta">${r.Review_text ? `"${esc(r.Review_text)}"` : "No written review"}</span>
                      </div>
                      <span class="stars-inline">★ ${Number(r.Rating).toFixed(1)} / 5</span>
                    </div>
                  `
                  )
                  .join("")}
              </div>`
            : `<div class="empty-state"><strong>No ratings yet</strong>Open any movie or series to rate & review it.</div>`
        }
      </section>

      <!-- Payment History -->
      <section class="dash-section">
        <div class="dash-section-title">
          <span>Payment History (${(dash.payments || []).length})</span>
        </div>
        ${
          (dash.payments || []).length
            ? `<div class="dash-list">
                ${dash.payments
                  .map(
                    (p) => `
                    <div class="dash-card">
                      <div class="dash-card-col">
                        <span class="dash-card-title">₹${Number(p.Amount).toFixed(2)} · ${esc(p.Plan_name || `Sub #${p.Subscription_id}`)}</span>
                        <span class="dash-card-meta">Pay #${p.Payment_id} · ${esc(p.Method_of_Payment)} · ${formatDateShort(p.Payment_date)}</span>
                      </div>
                      <span class="plan-badge ${String(p.Status).toLowerCase() === "success" ? "active" : "expired"}">${esc(p.Status)}</span>
                    </div>
                  `
                  )
                  .join("")}
              </div>`
            : `<div class="empty-state"><strong>No payments recorded</strong>Subscribe to a plan to see invoices here.</div>`
        }
      </section>
    </div>
  `;
}

// -------------------- Render: Main App Shell --------------------
function renderAppShell() {
  const sub = state.subscription;
  const isActive = sub && String(sub.Status).toLowerCase() === "active";
  const activeIdx = Math.max(
    0,
    state.profiles.findIndex((p) => p.Profile_id === state.activeProfile?.Profile_id)
  );

  let tabTitle = `For ${state.activeProfile?.Profile_name || state.user?.Name}`;
  if (state.activeTab === "search") tabTitle = "Search & Browse";
  if (state.activeTab === "plans") tabTitle = "Plans";
  if (state.activeTab === "my-netflix") tabTitle = "My Netflix";

  let tabHtml = "";
  if (state.activeTab === "home") tabHtml = renderHomeTab();
  else if (state.activeTab === "search") tabHtml = renderSearchTab();
  else if (state.activeTab === "plans") tabHtml = renderPlansTab();
  else tabHtml = renderMyNetflixTab();

  return `
    <div class="app-shell">
      <header class="top-header ${state.scrolled || state.activeTab !== "home" ? "scrolled" : ""}">
        <div class="top-header-inner">
          <div class="header-left">
            <button data-nav-tab="home" aria-label="Netflix Home">
              <span class="mobile-logo-only">${svgNetflixRibbon(28)}</span>
            </button>
            <div class="header-title-mobile">
              <span>${esc(tabTitle)}</span>
              ${state.activeProfile?.Is_Kids ? `<span class="profile-kids-pill" style="position:static">KIDS</span>` : ""}
            </div>
            <nav class="desktop-nav">
              <button class="desktop-nav-btn ${state.activeTab === "home" && !state.homeTypeFilter ? "active" : ""}" data-desktop-home="">Home</button>
              <button class="desktop-nav-btn ${state.activeTab === "home" && state.homeTypeFilter === "Series" ? "active" : ""}" data-desktop-home="Series">TV Shows</button>
              <button class="desktop-nav-btn ${state.activeTab === "home" && state.homeTypeFilter === "Movie" ? "active" : ""}" data-desktop-home="Movie">Movies</button>
              <button class="desktop-nav-btn ${state.activeTab === "search" ? "active" : ""}" data-nav-tab="search">Search & Filter</button>
              <button class="desktop-nav-btn ${state.activeTab === "plans" ? "active" : ""}" data-nav-tab="plans">Plans</button>
              <button class="desktop-nav-btn ${state.activeTab === "my-netflix" ? "active" : ""}" data-nav-tab="my-netflix">My Netflix</button>
            </nav>
          </div>

          <div class="header-right">
            <button class="quality-pill ${isActive ? "" : "expired"}" data-nav-tab="plans" title="Subscription Status">
              ${isActive ? esc(sub.Video_quality) : "Renew"}
            </button>
            <button class="icon-btn" data-nav-tab="search" aria-label="Search">${ICONS.search}</button>
            <button class="mini-avatar-btn" id="header-avatar-btn" title="Switch Profile">
              ${svgSmileyAvatar(state.activeProfile, activeIdx)}
            </button>
          </div>
        </div>
      </header>

      <main>${tabHtml}</main>

      <!-- Mobile Bottom Navigation Bar -->
      <nav class="bottom-nav" aria-label="Main Navigation">
        <button class="bottom-nav-item ${state.activeTab === "home" ? "active" : ""}" data-nav-tab="home">
          ${ICONS.home}
          <span>Home</span>
        </button>
        <button class="bottom-nav-item ${state.activeTab === "search" ? "active" : ""}" data-nav-tab="search">
          ${ICONS.search}
          <span>Search</span>
        </button>
        <button class="bottom-nav-item ${state.activeTab === "plans" ? "active" : ""}" data-nav-tab="plans">
          ${ICONS.plans}
          <span>Plans</span>
        </button>
        <button class="bottom-nav-item ${state.activeTab === "my-netflix" ? "active" : ""}" data-nav-tab="my-netflix">
          <span class="bottom-nav-avatar">${svgSmileyAvatar(state.activeProfile, activeIdx)}</span>
          <span>My Netflix</span>
        </button>
      </nav>
    </div>
  `;
}

// -------------------- Render: Modals / Bottom Sheets --------------------
function renderModal() {
  const root = document.getElementById("modal-root");
  if (!root) return;
  if (!state.modal) {
    root.innerHTML = "";
    return;
  }

  let bodyHtml = "";

  if (state.modal.type === "detail") {
    const item = state.modal.data;
    const art = getArtwork(item);
    const subQuality = state.subscription?.Status === "Active" ? state.subscription.Video_quality : "Preview";
    const matchPct = item.avg_rating ? Math.min(99, Math.round(74 + item.avg_rating * 5)) : 92;

    bodyHtml = `
      <div class="detail-banner">
        <img src="${art.poster}" onerror="this.src='${art.fallback}'" alt="${esc(item.Title)}" />
      </div>
      <div class="detail-content">
        <div class="hero-n-tag" style="margin-bottom:4px;">
          ${svgNetflixRibbon(14)}
          <span>${String(item.Type).toLowerCase() === "series" ? "SERIES" : "FILM"}</span>
        </div>
        <h2 class="detail-title">${esc(item.Title)}</h2>
        <div class="detail-badges">
          <span class="match-score">${matchPct}% Match</span>
          <span>${esc(item.Release_YEAR)}</span>
          <span class="maturity-box">${esc(item.Maturity_rating || "U/A")}</span>
          <span>${formatDuration(item.Duration, item.Type)}</span>
          <span class="maturity-box">${esc(subQuality)}</span>
          <span>${esc(item.Language)}</span>
        </div>

        <div class="detail-action-stack">
          <button class="btn-nf-white" style="width:100%;padding:13px;" id="modal-play-btn">
            ${ICONS.play}
            <span>${item.user_progress > 0 && !item.user_completed ? `Resume (${Math.round(item.user_progress)}%)` : "Play"}</span>
          </button>
        </div>

        <p class="detail-desc">${esc(item.Description || "No description provided.")}</p>

        <div class="detail-credits">
          ${item.actors?.length ? `<div><strong>Cast:</strong> ${esc(item.actors.join(", "))}</div>` : ""}
          ${item.directors?.length ? `<div><strong>Director:</strong> ${esc(item.directors.join(", "))}</div>` : ""}
          ${item.genres?.length ? `<div><strong>Genres:</strong> ${esc(item.genres.join(", "))}</div>` : ""}
        </div>

        <!-- Watch History Progress Control -->
        <div class="progress-box">
          <div class="progress-box-head">
            <span>Watch Progress (Watch_history)</span>
            <span id="detail-progress-val" style="color:var(--nf-red)">${state.modal.draftProgress}%${state.modal.draftProgress >= 100 ? " · Completed" : ""}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value="${state.modal.draftProgress}"
            class="nf-range"
            id="detail-progress-slider"
          />
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn-nf-glass" style="flex:1;padding:9px;font-size:13px;" id="detail-save-progress">Save Progress</button>
            <button class="btn-nf-primary" style="flex:1;padding:9px;font-size:13px;" id="detail-mark-complete">Mark 100% Watched</button>
          </div>
        </div>

        <!-- Rating & Reviews -->
        <div class="reviews-box">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:16px;">Rate & Review</strong>
            <span class="stars-inline">${item.avg_rating ? `★ ${item.avg_rating} (${item.review_count})` : "No ratings yet"}</span>
          </div>
          <div class="star-picker" id="detail-star-picker">
            ${[1, 2, 3, 4, 5]
              .map(
                (n) => `<button type="button" class="star-btn ${n <= state.modal.draftRating ? "lit" : ""}" data-star="${n}">★</button>`
              )
              .join("")}
          </div>
          <textarea
            id="detail-review-text"
            class="nf-textarea"
            rows="2"
            placeholder="Write a quick review (optional)..."
          >${esc(state.modal.draftReview)}</textarea>
          <button class="btn-nf-primary" style="margin-top:10px;padding:11px;font-size:14px;" id="detail-submit-review">
            Submit Rating (${state.modal.draftRating} ★)
          </button>

          <div style="margin-top:16px;">
            <div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">
              Community Reviews (${(item.reviews || []).length})
            </div>
            ${
              (item.reviews || []).length
                ? item.reviews
                    .map(
                      (rev) => `
                    <div class="review-item">
                      <div class="review-item-head">
                        <strong>${esc(rev.Reviewer_name)}</strong>
                        <span class="stars-inline">★ ${Number(rev.Rating).toFixed(1)}</span>
                      </div>
                      <p class="review-item-text">${esc(rev.Review_text || "Rated without comment.")}</p>
                    </div>
                  `
                    )
                    .join("")
                : `<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">Be the first to review this title!</div>`
            }
          </div>
        </div>
      </div>
    `;
  } else if (state.modal.type === "categories") {
    bodyHtml = `
      <div style="padding:18px 20px 10px;">
        <h2 style="margin:0 0 14px;font-size:20px;font-weight:800;">Categories</h2>
        <div class="dash-list">
          <button class="dash-card" data-pick-genre="">
            <span class="dash-card-title">All Genres</span>
            ${!state.homeGenreFilter ? `<span style="color:var(--nf-red);font-weight:800;">✓</span>` : ""}
          </button>
          ${(state.filterMeta.genres || [])
            .map(
              (g) => `
              <button class="dash-card" data-pick-genre="${esc(g)}">
                <span class="dash-card-title">${esc(g)}</span>
                ${state.homeGenreFilter === g ? `<span style="color:var(--nf-red);font-weight:800;">✓</span>` : ""}
              </button>
            `
            )
            .join("")}
        </div>
      </div>
    `;
  } else if (state.modal.type === "add-profile") {
    bodyHtml = `
      <div style="padding:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;">Add Profile</h2>
        <p style="margin:0 0 16px;font-size:13.5px;color:var(--text-secondary);">Create a new profile saved directly to the <code>Profiles</code> table.</p>
        <form id="add-profile-form">
          <div class="nf-field">
            <label for="new-profile-name">Profile Name</label>
            <input class="nf-input" id="new-profile-name" required placeholder="e.g. Mom, Kids, Guest" />
          </div>
          <div class="nf-field">
            <label for="new-profile-age">Age (optional)</label>
            <input class="nf-input" id="new-profile-age" type="number" min="0" max="120" placeholder="e.g. 10" />
          </div>
          <label class="nf-checkbox-row">
            <input type="checkbox" id="new-profile-kids" />
            <span><strong>Kids Profile</strong> (filters to U / kid-friendly content)</span>
          </label>
          <button class="btn-nf-primary" type="submit">Create Profile</button>
        </form>
      </div>
    `;
  } else if (state.modal.type === "admin") {
    const admin = state.modal.data;
    const isMySql = state.health?.db_mode === "mysql";
    bodyHtml = `
      <div style="padding:18px 20px;">
        <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;">Database & Backend Tools</h2>
        <p style="margin:0 0 14px;font-size:13px;color:var(--text-secondary);">
          Direct web controls for <code>main.py</code> utilities: Scheduler, Filter Any Table & All Users.
        </p>

        <div class="dash-card" style="margin-bottom:14px;">
          <div class="dash-card-col">
            <span class="dash-card-title">Connection: ${isMySql ? "MySQL Live (Netflix_OTT)" : "Local SQLite Mirror"}</span>
            <span class="dash-card-meta">${esc(state.health?.mysql_error || "Connected live to MySQL Netflix_OTT via main.py DB_CONFIG.")}</span>
          </div>
          <span class="plan-badge ${isMySql ? "active" : "none"}">${isMySql ? "MySQL" : "Mirror"}</span>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
          <button class="btn-nf-primary" style="flex:1;padding:11px;font-size:13.5px;" id="admin-run-scheduler">
            ⏱ Run Expiry Scheduler
          </button>
          ${
            !isMySql
              ? `<button class="btn-nf-glass" style="padding:11px 14px;font-size:13px;" id="admin-reset-demo">↺ Reset Seed Data</button>`
              : ""
          }
        </div>

        <div style="border-top:1px solid var(--border-subtle);padding-top:14px;">
          <div style="font-size:14px;font-weight:800;margin-bottom:10px;">Filter Any Table (all 7 tables from main.py)</div>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <select class="nf-select" id="admin-table-select" style="flex:1;padding:10px;">
              ${["content", "users", "profiles", "subscription_plans", "subscriptions", "payments", "watch_history"]
                .map((t) => `<option value="${t}" ${admin.table === t ? "selected" : ""}>${t}</option>`)
                .join("")}
            </select>
            <input class="nf-input" id="admin-filter-val" style="flex:1;padding:10px;" placeholder="Optional status / user_id / type..." value="${esc(admin.filterText || "")}" />
            <button class="btn-nf-white" style="padding:10px 14px;font-size:13px;" id="admin-query-btn">Query</button>
          </div>

          <div style="font-size:12px;color:var(--text-secondary);">Showing <strong>${admin.rows.length}</strong> row(s) from <code>${esc(admin.table)}</code></div>

          ${
            admin.rows.length
              ? `
              <div class="table-scroll">
                <table class="db-table">
                  <thead>
                    <tr>${Object.keys(admin.rows[0]).map((col) => `<th>${esc(col)}</th>`).join("")}</tr>
                  </thead>
                  <tbody>
                    ${admin.rows
                      .map(
                        (r) =>
                          `<tr>${Object.values(r).map((v) => `<td>${esc(v === null ? "NULL" : v)}</td>`).join("")}</tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
              `
              : `<div class="empty-state" style="margin-top:10px;padding:18px;">No records matched.</div>`
          }
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="sheet-backdrop" id="sheet-backdrop">
      <div class="sheet-panel" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <button class="sheet-close-btn" id="sheet-close-btn" aria-label="Close">✕</button>
        ${bodyHtml}
      </div>
    </div>
  `;

  bindModalEvents();
}

function bindModalEvents() {
  document.getElementById("sheet-close-btn")?.addEventListener("click", () => {
    state.modal = null;
    renderModal();
  });
  document.getElementById("sheet-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "sheet-backdrop") {
      state.modal = null;
      renderModal();
    }
  });

  if (state.modal?.type === "detail") {
    const item = state.modal.data;
    document.getElementById("modal-play-btn")?.addEventListener("click", () => startPlayer(item));

    const slider = document.getElementById("detail-progress-slider");
    slider?.addEventListener("input", (e) => {
      state.modal.draftProgress = Number(e.target.value);
      const lbl = document.getElementById("detail-progress-val");
      if (lbl) lbl.textContent = `${state.modal.draftProgress}%${state.modal.draftProgress >= 100 ? " · Completed" : ""}`;
    });

    document.getElementById("detail-save-progress")?.addEventListener("click", () => {
      saveWatchProgress(item.Content_id, state.modal.draftProgress, true);
    });

    document.getElementById("detail-mark-complete")?.addEventListener("click", () => {
      state.modal.draftProgress = 100;
      saveWatchProgress(item.Content_id, 100, true);
    });

    document.querySelectorAll("[data-star]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.modal.draftRating = Number(btn.dataset.star);
        renderModal();
      });
    });

    const revInput = document.getElementById("detail-review-text");
    revInput?.addEventListener("input", (e) => {
      state.modal.draftReview = e.target.value;
    });

    document.getElementById("detail-submit-review")?.addEventListener("click", () => {
      submitTitleReview(item.Content_id, state.modal.draftRating, state.modal.draftReview);
    });
  } else if (state.modal?.type === "categories") {
    document.querySelectorAll("[data-pick-genre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.homeGenreFilter = btn.dataset.pickGenre;
        state.heroIndex = 0;
        state.modal = null;
        renderModal();
        render();
      });
    });
  } else if (state.modal?.type === "add-profile") {
    document.getElementById("add-profile-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const profile_name = document.getElementById("new-profile-name").value.trim();
      const ageRaw = document.getElementById("new-profile-age").value.trim();
      const is_kids = document.getElementById("new-profile-kids").checked;
      try {
        await api(`/api/users/${state.user.User_id}/profiles`, {
          method: "POST",
          body: JSON.stringify({
            profile_name,
            is_kids,
            age: ageRaw ? Number(ageRaw) : null,
          }),
        });
        state.profiles = await api(`/api/users/${state.user.User_id}/profiles`);
        if (state.screen === "app") await loadAppData();
        state.modal = null;
        renderModal();
        render();
        showToast(`Profile "${profile_name}" created!`, "success");
      } catch (err) {
        showToast(err.message);
      }
    });
  } else if (state.modal?.type === "admin") {
    document.getElementById("admin-run-scheduler")?.addEventListener("click", async () => {
      try {
        const res = await api("/api/admin/run-scheduler", { method: "POST" });
        await loadAppData();
        await queryAdminTable(state.modal.data.table, state.modal.data.filterText);
        showToast(res.message, "success");
      } catch (err) {
        showToast(err.message);
      }
    });

    document.getElementById("admin-reset-demo")?.addEventListener("click", async () => {
      try {
        const res = await api("/api/admin/reset-demo", { method: "POST" });
        await loadAppData();
        await queryAdminTable(state.modal.data.table, "");
        showToast(res.message, "success");
      } catch (err) {
        showToast(err.message);
      }
    });

    const runQuery = async () => {
      const table = document.getElementById("admin-table-select").value;
      const filterText = document.getElementById("admin-filter-val").value.trim();
      await queryAdminTable(table, filterText);
    };

    document.getElementById("admin-query-btn")?.addEventListener("click", runQuery);
    document.getElementById("admin-table-select")?.addEventListener("change", () => {
      const table = document.getElementById("admin-table-select").value;
      queryAdminTable(table, "");
    });
  }
}

async function openAdminDrawer() {
  state.modal = { type: "admin", data: { table: "content", filterText: "", rows: [] } };
  renderModal();
  await queryAdminTable("content", "");
}

async function queryAdminTable(table, filterText) {
  const params = new URLSearchParams();
  if (filterText) {
    if (/^\d+$/.test(filterText)) {
      if (["subscriptions", "payments", "watch_history"].includes(table)) params.set("user_id", filterText);
      else if (table === "content") params.set("year", filterText);
      else if (table === "profiles") params.set("age", filterText);
    } else if (["active", "expired", "pending", "success", "failed"].includes(filterText.toLowerCase())) {
      params.set("status", filterText);
    } else if (["movie", "series"].includes(filterText.toLowerCase())) {
      params.set("type", filterText);
    } else if (table === "users") {
      params.set("name", filterText);
    } else if (table === "profiles") {
      params.set("profile_name", filterText);
    } else if (table === "subscription_plans") {
      params.set("plan_name", filterText);
    } else if (table === "content") {
      params.set("language", filterText);
    }
  }
  try {
    const res = await api(`/api/admin/filter/${table}?${params.toString()}`);
    if (state.modal?.type === "admin") {
      state.modal.data = { table, filterText, rows: res.rows || [] };
      renderModal();
    }
  } catch (err) {
    showToast(err.message);
  }
}

// -------------------- Render: Fullscreen Video Player --------------------
function renderPlayer() {
  const root = document.getElementById("player-root");
  if (!root) return;
  if (!state.player) {
    root.innerHTML = "";
    return;
  }

  const { item, progress, playing, speed } = state.player;
  const art = getArtwork(item);
  const sub = state.subscription;
  const isActive = sub && String(sub.Status).toLowerCase() === "active";
  const quality = isActive ? sub.Video_quality : "Preview Mode";
  const totalMins = Number(item.Duration) || 60;
  const curMins = Math.round((progress / 100) * totalMins);

  root.innerHTML = `
    <div class="player-overlay ${playing ? "playing" : ""}">
      <div class="player-stage">
        <img class="player-stage-bg" src="${art.poster}" onerror="this.src='${art.fallback}'" alt="" />
        <div class="player-cinema-frame">
          <img src="${art.poster}" onerror="this.src='${art.fallback}'" alt="${esc(item.Title)}" />
          <div class="player-cinema-vignette">
            <span class="player-live-pill">
              <span class="pulse-dot" style="${playing ? "" : "animation:none;background:#888"}"></span>
              <span>${playing ? `Streaming · ${esc(quality)}` : "Paused"}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="player-top-hud">
        <div class="player-top-row">
          <button class="icon-btn" id="player-close-btn" aria-label="Back & Save">${ICONS.back}</button>
          <div style="text-align:center;flex:1;min-width:0;">
            <div style="font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.Title)}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${esc(item.Type)} · ${esc(item.Language)} · ${esc(item.Maturity_rating)}</div>
          </div>
          <span class="quality-pill ${isActive ? "" : "expired"}">${esc(quality)}</span>
        </div>
        ${
          !isActive
            ? `<div style="margin-top:10px;background:rgba(229,9,20,0.22);border:1px solid rgba(229,9,20,0.55);border-radius:8px;padding:8px 12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span>Subscription expired — previewing playback (progress still logs to Watch_history).</span>
                <button class="sub-alert-cta" id="player-renew-btn">Renew</button>
              </div>`
            : ""
        }
      </div>

      <div class="player-bottom-hud">
        <div class="player-controls-row">
          <button class="player-ctrl-btn" id="player-back-10">-10%</button>
          <button class="player-ctrl-btn big" id="player-toggle-btn">${playing ? ICONS.pause : ICONS.play}</button>
          <button class="player-ctrl-btn" id="player-fwd-10">+10%</button>
        </div>

        <input
          id="player-scrubber"
          type="range"
          min="0"
          max="100"
          step="1"
          value="${Math.round(progress)}"
          class="nf-range"
        />
        <div class="player-time-row">
          <span id="player-elapsed-label">${curMins}m / ${totalMins}m</span>
          <span id="player-pct-label" style="color:#fff">${Math.round(progress)}%</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:10px;">
          <button class="pill-action-btn" id="player-speed-btn">Speed: ${speed}x</button>
          <button class="pill-action-btn" id="player-save-exit-btn">Save & Exit</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("player-close-btn")?.addEventListener("click", () => stopPlayer(true));
  document.getElementById("player-save-exit-btn")?.addEventListener("click", () => stopPlayer(true));
  document.getElementById("player-renew-btn")?.addEventListener("click", async () => {
    await stopPlayer(true);
    state.activeTab = "plans";
    render();
  });

  document.getElementById("player-toggle-btn")?.addEventListener("click", () => {
    if (!state.player) return;
    state.player.playing = !state.player.playing;
    if (!state.player.playing) {
      saveWatchProgress(state.player.item.Content_id, Math.round(state.player.progress), false);
    }
    renderPlayer();
  });

  document.getElementById("player-back-10")?.addEventListener("click", () => {
    if (!state.player) return;
    state.player.progress = Math.max(0, state.player.progress - 10);
    renderPlayer();
  });

  document.getElementById("player-fwd-10")?.addEventListener("click", () => {
    if (!state.player) return;
    state.player.progress = Math.min(100, state.player.progress + 10);
    renderPlayer();
  });

  document.getElementById("player-scrubber")?.addEventListener("input", (e) => {
    if (!state.player) return;
    state.player.progress = Number(e.target.value);
    const pctEl = document.getElementById("player-pct-label");
    if (pctEl) pctEl.textContent = `${Math.round(state.player.progress)}%`;
  });

  document.getElementById("player-speed-btn")?.addEventListener("click", () => {
    if (!state.player) return;
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(state.player.speed) + 1) % speeds.length];
    state.player.speed = next;
    renderPlayer();
  });
}

// -------------------- Main Render & Event Wiring --------------------
function render() {
  const root = document.getElementById("app");
  if (!root) return;

  if (state.screen === "auth") {
    root.innerHTML = renderAuthScreen();
    bindAuthEvents();
  } else if (state.screen === "profiles") {
    root.innerHTML = renderProfilesScreen();
    bindProfilesEvents();
  } else {
    root.innerHTML = renderAppShell();
    bindAppEvents();
  }
}

function bindAuthEvents() {
  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.authTab = btn.dataset.authTab;
      state.authError = "";
      render();
    });
  });

  document.getElementById("signin-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    handleSignIn(email, password);
  });

  document.querySelectorAll("[data-demo-email]").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleSignIn(btn.dataset.demoEmail, btn.dataset.demoPass);
    });
  });

  document.getElementById("signup-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const ageRaw = document.getElementById("reg-age").value.trim();
    handleSignUp({
      name: document.getElementById("reg-name").value.trim(),
      email: document.getElementById("reg-email").value.trim(),
      password: document.getElementById("reg-password").value,
      phone: document.getElementById("reg-phone").value.trim(),
      profile_name: document.getElementById("reg-profile").value.trim(),
      is_kids: document.getElementById("reg-kids").checked,
      age: ageRaw ? Number(ageRaw) : null,
    });
  });
}

function bindProfilesEvents() {
  document.getElementById("toggle-edit-profiles")?.addEventListener("click", () => {
    state.editProfilesMode = !state.editProfilesMode;
    render();
  });

  document.getElementById("profiles-signout")?.addEventListener("click", signOut);

  document.getElementById("open-add-profile-btn")?.addEventListener("click", () => {
    state.modal = { type: "add-profile" };
    renderModal();
  });

  document.querySelectorAll("[data-delete-profile]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pid = Number(btn.dataset.deleteProfile);
      try {
        await api(`/api/users/${state.user.User_id}/profiles/${pid}`, { method: "DELETE" });
        state.profiles = await api(`/api/users/${state.user.User_id}/profiles`);
        render();
        showToast("Profile deleted");
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  document.querySelectorAll("[data-select-profile]").forEach((el) => {
    el.addEventListener("click", () => {
      if (state.editProfilesMode) return;
      const pid = Number(el.dataset.selectProfile);
      const prof = state.profiles.find((p) => p.Profile_id === pid);
      if (prof) selectProfile(prof);
    });
  });
}

function bindAppEvents() {
  // Navigation tabs
  document.querySelectorAll("[data-nav-tab]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.activeTab = btn.dataset.navTab;
      window.scrollTo({ top: 0, behavior: "instant" });
      if (state.activeTab === "search") await runSearchQuery(false);
      render();
    });
  });

  document.querySelectorAll("[data-desktop-home]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = "home";
      state.homeTypeFilter = btn.dataset.desktopHome;
      state.heroIndex = 0;
      window.scrollTo({ top: 0, behavior: "smooth" });
      render();
    });
  });

  document.getElementById("header-avatar-btn")?.addEventListener("click", () => {
    state.screen = "profiles";
    state.editProfilesMode = false;
    render();
  });

  // Home category pills
  document.querySelectorAll("[data-home-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.homeType;
      state.homeTypeFilter = state.homeTypeFilter === next ? "" : next;
      state.heroIndex = 0;
      render();
    });
  });

  document.getElementById("open-categories-btn")?.addEventListener("click", () => {
    state.modal = { type: "categories" };
    renderModal();
  });

  document.getElementById("clear-home-filters")?.addEventListener("click", () => {
    state.homeTypeFilter = "";
    state.homeGenreFilter = "";
    state.heroIndex = 0;
    render();
  });

  document.querySelectorAll("[data-hero-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.heroIndex = Number(btn.dataset.heroIdx);
      render();
    });
  });

  // Open detail / direct play buttons
  document.querySelectorAll("[data-open-content]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-play-content]")) return;
      openTitleDetail(Number(el.dataset.openContent));
    });
  });

  document.querySelectorAll("[data-play-content]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cid = Number(btn.dataset.playContent);
      const item = state.content.find((c) => c.Content_id === cid) || state.searchResults.find((c) => c.Content_id === cid);
      if (item) startPlayer(item);
      else openTitleDetail(cid);
    });
  });

  // Search tab events
  const searchInput = document.getElementById("search-query-input");
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runSearchQuery(true), 160);
    });
  }

  document.getElementById("clear-search-text")?.addEventListener("click", () => {
    state.searchQuery = "";
    runSearchQuery(true);
  });

  document.querySelectorAll("[data-search-filter]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      state.searchFilters[sel.dataset.searchFilter] = e.target.value;
      runSearchQuery(true);
    });
  });

  document.getElementById("reset-all-search")?.addEventListener("click", () => {
    state.searchQuery = "";
    state.searchFilters = { type: "", language: "", genre: "", year: "", maturity: "" };
    runSearchQuery(true);
  });

  // Plans tab events
  document.querySelectorAll("[data-select-plan]").forEach((el) => {
    el.addEventListener("click", () => {
      state.selectedPlanId = Number(el.dataset.selectPlan);
      render();
    });
  });

  document.querySelectorAll("[data-pay-method]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.paymentMethod = btn.dataset.payMethod;
      render();
    });
  });

  document.getElementById("confirm-subscribe-btn")?.addEventListener("click", () => executeSubscription());
  document.getElementById("failtest-subscribe-btn")?.addEventListener("click", () => executeSubscription("FailTest"));

  // My Netflix events
  document.getElementById("switch-profile-btn")?.addEventListener("click", () => {
    state.screen = "profiles";
    state.editProfilesMode = false;
    render();
  });

  document.getElementById("open-admin-drawer-btn")?.addEventListener("click", openAdminDrawer);
  document.getElementById("my-nf-add-profile")?.addEventListener("click", () => {
    state.modal = { type: "add-profile" };
    renderModal();
  });
  document.getElementById("my-nf-signout")?.addEventListener("click", signOut);
}

// Scroll header backdrop effect
window.addEventListener(
  "scroll",
  () => {
    const isScrolled = window.scrollY > 24;
    if (isScrolled !== state.scrolled) {
      state.scrolled = isScrolled;
      const hdr = document.querySelector(".top-header");
      if (hdr && state.activeTab === "home") {
        hdr.classList.toggle("scrolled", isScrolled);
      }
    }
  },
  { passive: true }
);

// -------------------- Bootstrap --------------------
async function init() {
  await loadHealth();

  // Restore saved session if present
  try {
    const saved = JSON.parse(localStorage.getItem("nf_ott_session") || "null");
    if (saved?.user_id) {
      const dash = await api(`/api/users/${saved.user_id}/dashboard`);
      state.user = dash.user;
      state.profiles = dash.profiles || [];
      state.subscription = dash.active_subscription;
      state.dashboard = dash;
      const matchedProfile = state.profiles.find((p) => p.Profile_id === saved.profile_id);
      if (matchedProfile) {
        state.activeProfile = matchedProfile;
        state.screen = "app";
        await loadAppData();
      } else {
        state.screen = "profiles";
      }
    }
  } catch {
    localStorage.removeItem("nf_ott_session");
  }

  render();
}

init();
