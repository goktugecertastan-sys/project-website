const THEME_ORDER = ["neon", "earth", "citrus"];
const VIEW_IDS = ["overview", "projects", "network", "create", "focused-contact", "rooms", "profile"];
const VIEW_HEADINGS = {
  overview: "Where every profession builds better together.",
  projects: "Discover live projects that are ready for the right collaborator.",
  network: "Meet people across disciplines and find the right expertise.",
  create: "Turn a strong idea into a clear collaboration opportunity.",
  "focused-contact": "Open a focused project room with the right person.",
  rooms: "Follow the conversations where momentum, replies, and decisions come together.",
  profile: "Explore each member's strengths, readiness, and collaboration potential.",
};
const LEGACY_VIEW_MAP = {
  projectBoard: "projects",
  networkSection: "network",
  projectForm: "create",
  roomForm: "focused-contact",
  messageComposer: "rooms",
  profileSection: "profile",
};
const THEME_LABELS = {
  neon: "Neon Pulse",
  earth: "Earth Canvas",
  citrus: "Citrus Tide",
};
const PROFESSION_OPTIONS = [
  "Student",
  "Unemployed / Not Working",
  "Freelancer / Self-Employed",
  "Entrepreneur / Business Owner",
  "Manager / Executive",
  "Engineer",
  "Software Developer / Programmer",
  "Designer (Graphic, UI/UX, etc.)",
  "Information Technology / IT Specialist",
  "Data Analyst / Data Scientist",
  "Marketing / Advertising / PR",
  "Sales Specialist",
  "Finance / Accounting Specialist",
  "Banker",
  "Legal Professional (Lawyer, Judge, etc.)",
  "Healthcare Professional (Doctor, Nurse, etc.)",
  "Academic / Researcher",
  "Teacher / Instructor",
  "Artist / Creative Professional",
  "Media / Journalist",
  "Human Resources Specialist",
  "Public Sector Employee / Civil Servant",
  "Military / Police / Security",
  "Architect",
  "Construction / Technical Operations",
  "Logistics / Transportation",
  "Tourism / Hospitality",
  "Retail / Store Employee",
  "Manufacturing / Factory Worker",
  "Agriculture / Livestock",
  "Homemaker / Home-Based",
  "Retired",
  "Other",
];
const DEFAULT_THEME = "neon";
const AUTH_SESSION_KEY = "project-bridge-session";
const APP_SERVER_HINT = "Project Bridge needs the app server to sign in. Start the server and open http://localhost:3000.";
const APP_SERVER_UNREACHABLE_MESSAGE =
  "Project Bridge could not reach the server. Open the app from http://localhost:3000 and try again.";
const APP_SERVER_INVALID_RESPONSE_MESSAGE =
  "Project Bridge received an unexpected response from the server. Open the app from http://localhost:3000 and try again.";

const state = {
  users: [],
  projects: [],
  conversations: [],
  stats: {},
  activeUserId: null,
  sessionUserId: null,
  sessionEmail: "",
  profileUserId: null,
  activeConversationId: null,
  peopleFilter: "all",
  peopleSearch: "",
  theme: DEFAULT_THEME,
  currentView: "overview",
  authView: "login",
};

const elements = {
  authScreen: document.querySelector("#authScreen"),
  appShell: document.querySelector("#appShell"),
  loginAuthPage: document.querySelector("#loginAuthPage"),
  registerAuthPage: document.querySelector("#registerAuthPage"),
  authNoticeLogin: document.querySelector("#authNoticeLogin"),
  authNoticeRegister: document.querySelector("#authNoticeRegister"),
  loginForm: document.querySelector("#loginForm"),
  registerForm: document.querySelector("#registerForm"),
  professionOptions: document.querySelector("#professionOptions"),
  pageHeading: document.querySelector("#pageHeading"),
  profileUserSelect: document.querySelector("#activeUserSelect"),
  peopleSearch: document.querySelector("#peopleSearch"),
  themeToggle: document.querySelector("#themeToggle"),
  footerThemeToggle: document.querySelector("#footerThemeToggle"),
  logoutButton: document.querySelector("#logoutButton"),
  footerLogoutButton: document.querySelector("#footerLogoutButton"),
  statsGrid: document.querySelector("#statsGrid"),
  projectsList: document.querySelector("#projectsList"),
  peopleList: document.querySelector("#peopleList"),
  projectForm: document.querySelector("#projectForm"),
  roomForm: document.querySelector("#roomForm"),
  roomProjectSelect: document.querySelector("#roomProjectSelect"),
  roomCollaboratorSelect: document.querySelector("#roomCollaboratorSelect"),
  friendshipList: document.querySelector("#friendshipList"),
  conversationList: document.querySelector("#conversationList"),
  threadHeader: document.querySelector("#threadHeader"),
  messageThread: document.querySelector("#messageThread"),
  messageForm: document.querySelector("#messageForm"),
  roomsOverview: document.querySelector("#roomsOverview"),
  profileHighlights: document.querySelector("#profileHighlights"),
  profileSummary: document.querySelector("#profileSummary"),
  notice: document.querySelector("#notice"),
  filterButtons: [...document.querySelectorAll(".filter-chip")],
  pageViews: [...document.querySelectorAll("[data-view]")],
  viewLinks: [...document.querySelectorAll("[data-view-link]")],
};

let noticeTimer = null;
let authNoticeTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getLastMessage(messages) {
  return Array.isArray(messages) && messages.length ? messages[messages.length - 1] : null;
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  let response;

  try {
    response = await fetch(resolveRequestUrl(path), {
      ...options,
      headers,
    });
  } catch (error) {
    throw normalizeRequestError(error);
  }

  const contentType = response.headers.get("content-type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch (error) {
      throw normalizeRequestError(error);
    }
  } else {
    const fallbackText = await response.text().catch(() => "");
    if (!response.ok || fallbackText.trim().startsWith("<")) {
      throw new Error(APP_SERVER_INVALID_RESPONSE_MESSAGE);
    }
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function resolveRequestUrl(path) {
  const rawPath = String(path || "").trim();

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return new URL(rawPath, window.location.href).toString();
  }

  throw new Error(APP_SERVER_HINT);
}

function normalizeRequestError(error) {
  const message = String(error?.message || "").trim();
  const lowerMessage = message.toLowerCase();

  if (window.location.protocol === "file:") {
    return new Error(APP_SERVER_HINT);
  }

  if (
    lowerMessage.includes("the string did not match the expected pattern") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("load failed") ||
    lowerMessage.includes("networkerror")
  ) {
    return new Error(APP_SERVER_UNREACHABLE_MESSAGE);
  }

  if (
    lowerMessage.includes("unexpected token") ||
    lowerMessage.includes("invalid json") ||
    lowerMessage.includes("json")
  ) {
    return new Error(APP_SERVER_INVALID_RESPONSE_MESSAGE);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(APP_SERVER_UNREACHABLE_MESSAGE);
}

function getStoredSession() {
  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.userId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    return null;
  }

  return session;
}

function clearStoredSession() {
  try {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    return null;
  }

  return null;
}

function applySession(session) {
  state.sessionUserId = session?.userId || null;
  state.sessionEmail = session?.email || "";
  state.activeUserId = state.sessionUserId;
}

function clearSessionState() {
  state.users = [];
  state.projects = [];
  state.conversations = [];
  state.stats = {};
  state.activeUserId = null;
  state.sessionUserId = null;
  state.sessionEmail = "";
  state.profileUserId = null;
  state.activeConversationId = null;
  state.peopleSearch = "";
}

function getUserById(userId) {
  return state.users.find((user) => user.id === userId);
}

function getProjectById(projectId) {
  return state.projects.find((project) => project.id === projectId);
}

function getActiveUser() {
  return getUserById(state.activeUserId);
}

function getProfileUser() {
  return getUserById(state.profileUserId) || getActiveUser();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stringToNumber(value) {
  return String(value || "").split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}

function getVisualStyle(seed) {
  const base = stringToNumber(seed);
  const hueA = base % 360;
  const hueB = (hueA + 48 + (base % 90)) % 360;
  return `--visual-a:${hueA}; --visual-b:${hueB};`;
}

function getInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getAvailabilityBadge(user) {
  const source = `${user?.status || ""} ${user?.availability || ""}`.toLowerCase();

  if (source.includes("open") || source.includes("available")) {
    return "Available now";
  }

  if (source.includes("mentor")) {
    return "Advising";
  }

  if (source.includes("pilot")) {
    return "Pilot ready";
  }

  return "In network";
}

function renderProfessionOptions() {
  if (!elements.professionOptions) {
    return;
  }

  elements.professionOptions.innerHTML = PROFESSION_OPTIONS
    .map(
      (profession) => `
        <label class="auth-profession-option">
          <input type="radio" name="profession" value="${escapeHtml(profession)}" />
          <span>${escapeHtml(profession)}</span>
        </label>
      `
    )
    .join("");
}

function showNotice(message) {
  if (!elements.notice) {
    return;
  }

  elements.notice.textContent = message;
  elements.notice.classList.add("is-visible");

  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    elements.notice.classList.remove("is-visible");
  }, 2600);
}

function clearAuthNotice() {
  window.clearTimeout(authNoticeTimer);

  [elements.authNoticeLogin, elements.authNoticeRegister].forEach((noticeElement) => {
    if (!noticeElement) {
      return;
    }

    noticeElement.textContent = "";
    noticeElement.classList.remove("is-visible", "is-error", "is-success");
  });
}

function getActiveAuthNoticeElement() {
  return state.authView === "register" ? elements.authNoticeRegister : elements.authNoticeLogin;
}

function showAuthNotice(message, tone = "error") {
  const noticeElement = getActiveAuthNoticeElement();

  if (!noticeElement) {
    return;
  }

  clearAuthNotice();
  noticeElement.textContent = message;
  noticeElement.classList.add("is-visible", tone === "success" ? "is-success" : "is-error");

  authNoticeTimer = window.setTimeout(() => {
    noticeElement.classList.remove("is-visible");
  }, 3600);
}

function focusAuthField(view) {
  const form = view === "register" ? elements.registerForm : elements.loginForm;
  const field = form?.querySelector("input");

  if (!field) {
    return;
  }

  window.requestAnimationFrame(() => {
    field.focus({ preventScroll: true });
  });
}

function setAuthView(view, { emailPrefill = "" } = {}) {
  const resolvedView = view === "register" ? "register" : "login";

  state.authView = resolvedView;
  elements.loginAuthPage.hidden = resolvedView !== "login";
  elements.registerAuthPage.hidden = resolvedView !== "register";
  elements.loginAuthPage.classList.toggle("is-active", resolvedView === "login");
  elements.registerAuthPage.classList.toggle("is-active", resolvedView === "register");

  if (resolvedView === "login" && emailPrefill) {
    elements.loginForm.elements.email.value = emailPrefill;
    elements.loginForm.elements.password.value = "";
  }

  clearAuthNotice();
  focusAuthField(resolvedView);
}

function showAuthScreen() {
  setSectionMenuOpen(false);
  elements.appShell.hidden = true;
  elements.authScreen.hidden = false;
}

function showAppShell() {
  clearAuthNotice();
  elements.authScreen.hidden = true;
  elements.appShell.hidden = false;
}

function setFormPending(form, isPending, pendingLabel) {
  if (!form) {
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    if (!submitButton.dataset.defaultLabel) {
      submitButton.dataset.defaultLabel = submitButton.textContent;
    }

    submitButton.textContent = isPending ? pendingLabel : submitButton.dataset.defaultLabel;
  }

  [...form.elements].forEach((field) => {
    field.disabled = isPending;
  });
}

function getNextTheme(theme) {
  const currentIndex = THEME_ORDER.indexOf(theme);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  return THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
}

function setTheme(theme) {
  const resolvedTheme = THEME_ORDER.includes(theme) ? theme : DEFAULT_THEME;
  const nextTheme = getNextTheme(resolvedTheme);

  state.theme = resolvedTheme;
  document.body.dataset.theme = resolvedTheme;

  [elements.themeToggle, elements.footerThemeToggle].forEach((button) => {
    if (!button) {
      return;
    }

    button.textContent = `Theme: ${THEME_LABELS[resolvedTheme]}`;
    button.setAttribute("aria-label", `Current theme ${THEME_LABELS[resolvedTheme]}. Switch to ${THEME_LABELS[nextTheme]}.`);
    button.title = `Switch to ${THEME_LABELS[nextTheme]}`;
  });
}

function setSectionMenuOpen(isOpen) {
  document.body.classList.toggle("menu-open", Boolean(isOpen) && Boolean(elements.sectionMenu));

  if (!elements.sectionMenuToggle || !elements.sectionMenu) {
    return;
  }

  elements.sectionMenuToggle.setAttribute("aria-expanded", String(isOpen));
  elements.sectionMenuToggle.setAttribute("aria-label", isOpen ? "Close sections menu" : "Open sections menu");
  elements.sectionMenu.setAttribute("aria-hidden", String(!isOpen));

  if (isOpen) {
    updateSectionMenuScrollState();
  }
}

function updateSectionMenuScrollState() {
  if (!elements.sectionMenu) {
    return;
  }

  elements.sectionMenu.classList.toggle("is-scrolled", elements.sectionMenu.scrollTop > 14);
}

function resolveView(view) {
  return VIEW_IDS.includes(view) ? view : LEGACY_VIEW_MAP[view] || "overview";
}

function getViewFromHash() {
  return resolveView(window.location.hash.replace(/^#/, ""));
}

function renderPageHeading() {
  elements.pageHeading.textContent = VIEW_HEADINGS[state.currentView] || VIEW_HEADINGS.overview;
}

function renderCurrentView() {
  elements.pageViews.forEach((pageView) => {
    const isActive = pageView.dataset.view === state.currentView;
    pageView.classList.toggle("is-active", isActive);
    pageView.hidden = !isActive;
  });

  elements.viewLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.viewLink === state.currentView);
  });

  renderPageHeading();
}

function setCurrentView(view, { updateHash = true } = {}) {
  const resolvedView = resolveView(view);
  const targetHash = `#${resolvedView}`;

  state.currentView = resolvedView;
  renderCurrentView();

  if (updateHash && window.location.hash !== targetHash) {
    window.history.pushState(null, "", targetHash);
  }

  if (!elements.appShell.hidden) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function navigateToView(view, options = {}) {
  const resolvedView = resolveView(view);

  if (options.closeMenu) {
    setSectionMenuOpen(false);
  }

  setCurrentView(resolvedView, { updateHash: true });
}

function getFriendIds(user) {
  return Array.isArray(user?.friendIds) ? user.friendIds : [];
}

function getProjectOwner(project) {
  return getUserById(project.ownerId);
}

function getConversationProject(conversation) {
  return getProjectById(conversation.projectId);
}

function buildStats() {
  const activeUser = getActiveUser();

  if (!activeUser) {
    return [];
  }

  const networkSize = getFriendIds(activeUser).length;
  const roomsForUser = state.conversations.filter((conversation) =>
    conversation.participantIds.includes(state.activeUserId)
  ).length;
  const crossDisciplineProjects = state.projects.filter((project) => {
    const owner = getProjectOwner(project);
    return owner && owner.role !== activeUser.role;
  }).length;

  return [
    {
      label: "Live projects",
      value: state.stats.projects ?? state.projects.length,
      detail: "Ideas waiting for their next collaborator.",
    },
    {
      label: "Focused rooms",
      value: roomsForUser,
      detail: "Project-specific contact spaces instead of generic DMs.",
    },
    {
      label: "Trusted contacts",
      value: networkSize,
      detail: "People already inside your network.",
    },
    {
      label: "Cross-discipline matches",
      value: crossDisciplineProjects,
      detail: "Projects owned by collaborators in a different field.",
    },
  ];
}

function renderStats() {
  const cards = buildStats();

  if (!cards.length) {
    elements.statsGrid.innerHTML = "";
    return;
  }

  elements.statsGrid.innerHTML = cards
    .map((card) => {
      const style = getVisualStyle(card.label);

      return `
        <article class="stat-card" style="${style}">
          <p class="eyebrow">${card.label}</p>
          <strong>${card.value}</strong>
          <p class="section-note">${card.detail}</p>
        </article>
      `;
    })
    .join("");
}

function renderInsightCards(items) {
  return items
    .map(
      (item) => `
        <article class="insight-card">
          <p class="eyebrow">${item.label}</p>
          <strong>${item.value}</strong>
          <p class="section-note">${item.detail}</p>
        </article>
      `
    )
    .join("");
}

function populateActiveUserSelect() {
  elements.profileUserSelect.innerHTML = state.users
    .map(
      (user) => `
        <option value="${user.id}" ${user.id === state.profileUserId ? "selected" : ""}>
          ${escapeHtml(user.name)} · ${escapeHtml(user.role)}
        </option>
      `
    )
    .join("");
}

function renderProfileHighlights() {
  const profileUser = getProfileUser();

  if (!profileUser) {
    elements.profileHighlights.innerHTML = '<div class="empty-state">Choose a profile to see member highlights.</div>';
    return;
  }

  const ownProjects = state.projects.filter((project) => project.ownerId === profileUser.id);
  const network = getFriendIds(profileUser)
    .map((friendId) => getUserById(friendId))
    .filter(Boolean);

  elements.profileHighlights.innerHTML = renderInsightCards([
    {
      label: "Best known for",
      value: profileUser.specialty,
      detail: `${profileUser.name} brings a clear specialty into new collaborations.`,
    },
    {
      label: "Availability",
      value: profileUser.availability,
      detail: "Use this to gauge how ready they are for a new conversation or sprint.",
    },
    {
      label: "Network reach",
      value: `${network.length} trusted connections`,
      detail: "Shows how much collaboration history already exists around this member.",
    },
    {
      label: "Projects led",
      value: `${ownProjects.length} active ideas`,
      detail: "A quick sense of how often this member is already initiating opportunities.",
    },
  ]);
}

function renderProfileSummary() {
  const profileUser = getProfileUser();

  if (!profileUser) {
    elements.profileSummary.innerHTML = '<div class="empty-state">Choose a profile to view its details.</div>';
    return;
  }

  const ownProjects = state.projects.filter((project) => project.ownerId === profileUser.id);
  const roomCount = state.conversations.filter((conversation) =>
    conversation.participantIds.includes(profileUser.id)
  ).length;
  const network = getFriendIds(profileUser)
    .map((friendId) => getUserById(friendId))
    .filter(Boolean);
  const isSignedInUser = profileUser.id === state.activeUserId;
  const style = getVisualStyle(`${profileUser.name}-${profileUser.specialty}`);

  elements.profileSummary.innerHTML = `
    <article class="profile-card" style="${style}">
      <div class="profile-hero-band">
        <div class="profile-avatar">${escapeHtml(getInitials(profileUser.name))}</div>
        <div class="profile-hero-copy">
          <p class="eyebrow">${isSignedInUser ? "Signed-in member" : "Selected member"}</p>
          <h4>${escapeHtml(profileUser.name)}</h4>
          <p class="project-meta">${escapeHtml(profileUser.specialty)} · ${escapeHtml(profileUser.city)}</p>
        </div>
        <span class="profile-role-pill">${escapeHtml(profileUser.role)}</span>
      </div>

      <div class="profile-head">
        <p class="person-bio">${escapeHtml(profileUser.bio)}</p>
      </div>

      <div class="profile-meta-grid">
        <div class="profile-meta-item">
          <strong>Status</strong>
          <span>${escapeHtml(profileUser.status)}</span>
        </div>
        <div class="profile-meta-item">
          <strong>Availability</strong>
          <span>${escapeHtml(profileUser.availability)}</span>
        </div>
      </div>

      <div class="profile-stat-grid">
        <div class="profile-stat-item">
          <strong>Network size</strong>
          <span>${network.length} connected people</span>
        </div>
        <div class="profile-stat-item">
          <strong>Open rooms</strong>
          <span>${roomCount} focused conversations</span>
        </div>
        <div class="profile-stat-item">
          <strong>Projects</strong>
          <span>${ownProjects.length} posted ideas</span>
        </div>
        <div class="profile-stat-item">
          <strong>Role snapshot</strong>
          <span>${escapeHtml(profileUser.role)} perspective is visible</span>
        </div>
      </div>

      <div>
        <p class="eyebrow">Interests</p>
        <div class="pill-row">
          ${(Array.isArray(profileUser.interests) ? profileUser.interests : [])
            .map((interest) => `<span class="pill">${escapeHtml(interest)}</span>`)
            .join("")}
        </div>
      </div>

      <div>
        <p class="eyebrow">Current network</p>
        <div class="pill-row">
          ${
            network.length
              ? network
                  .map((friend) => `<span class="friendship-tag">${escapeHtml(friend.name)} · ${escapeHtml(friend.role)}</span>`)
                  .join("")
              : '<div class="empty-state">No network connections yet for this member.</div>'
          }
        </div>
      </div>

      <div>
        <p class="eyebrow">Posted projects</p>
        <div class="profile-project-list">
          ${
            ownProjects.length
              ? ownProjects
                  .map(
                    (project) => `
                      <article class="profile-project-item">
                        <strong>${escapeHtml(project.title)}</strong>
                        <p class="project-meta">${escapeHtml(project.domain)} · ${escapeHtml(project.stage)}</p>
                      </article>
                    `
                  )
                  .join("")
              : '<div class="empty-state">This member has not posted a project yet.</div>'
          }
        </div>
      </div>
    </article>
  `;
}

function renderProjects() {
  if (!state.projects.length) {
    elements.projectsList.innerHTML = '<div class="empty-state">No projects yet. Post the first one.</div>';
    return;
  }

  const activeUser = getActiveUser();

  elements.projectsList.innerHTML = state.projects
    .map((project, index) => {
      const owner = getProjectOwner(project);
      const hasConversation = state.conversations.some(
        (conversation) =>
          conversation.projectId === project.id && conversation.participantIds.includes(state.activeUserId)
      );
      const style = getVisualStyle(`${project.title}-${project.domain}-${index}`);

      return `
        <article class="project-card" style="${style}">
          <div class="project-cover">
            <span class="project-cover-badge">${hasConversation ? "Room live" : "Seeking now"}</span>
            <div class="project-cover-art">
              <span>${escapeHtml(project.domain)}</span>
            </div>
          </div>

          <div class="project-header">
            <div>
              <p class="eyebrow">${escapeHtml(project.domain)}</p>
              <h4>${escapeHtml(project.title)}</h4>
            </div>
            <span class="stage-pill">${escapeHtml(project.stage)}</span>
          </div>

          <p class="project-meta">${escapeHtml(project.summary)}</p>
          <p class="project-goal"><strong>Goal:</strong> ${escapeHtml(project.collaborationGoal)}</p>
          <p class="project-meta">
            <strong>Owner:</strong> ${escapeHtml(owner?.name || "Unknown")} · ${escapeHtml(owner?.role || "Unassigned")} · ${escapeHtml(project.lookingFor)}
          </p>

          <div class="pill-row">
            ${(Array.isArray(project.tags) ? project.tags : []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
          </div>

          <div class="pill-row">
            <button class="mini-button" type="button" data-action="project-room" data-project-id="${project.id}">
              ${hasConversation ? "Open room" : activeUser?.id === project.ownerId ? "Plan room" : "Start room"}
            </button>
            <button class="mini-button is-ghost" type="button" data-action="prefill-room" data-project-id="${project.id}">
              Use in room builder
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPeople() {
  const activeUser = getActiveUser();
  const activeFriendIds = getFriendIds(activeUser);
  const searchTerm = state.peopleSearch.trim().toLowerCase();
  const visiblePeople = state.users.filter((user) => {
    const matchesFilter = state.peopleFilter === "all" ? true : user.role === state.peopleFilter;
    const searchableText = [
      user.name,
      user.role,
      user.specialty,
      user.city,
      user.status,
      user.bio,
      user.availability,
      ...(Array.isArray(user.interests) ? user.interests : []),
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = searchTerm ? searchableText.includes(searchTerm) : true;

    if (!matchesFilter) {
      return false;
    }

    return matchesSearch;
  });

  if (elements.peopleSearch && elements.peopleSearch.value !== state.peopleSearch) {
    elements.peopleSearch.value = state.peopleSearch;
  }

  if (!visiblePeople.length) {
    elements.peopleList.innerHTML = '<div class="empty-state">No people match this filter yet.</div>';
    return;
  }

  elements.peopleList.innerHTML = visiblePeople
    .map((user, index) => {
      const isSignedInUser = user.id === state.activeUserId;
      const isFriend = activeFriendIds.includes(user.id);
      const style = getVisualStyle(`${user.name}-${user.specialty}-${index}`);

      return `
        <article class="person-card" style="${style}">
          <div class="person-art">
            <span class="person-availability-badge">${escapeHtml(getAvailabilityBadge(user))}</span>
            <div class="person-portrait">
              <span class="person-initials">${escapeHtml(getInitials(user.name))}</span>
            </div>
          </div>

          <div class="person-header">
            <div>
              <h4>${escapeHtml(user.name)}</h4>
              <p class="project-meta">${escapeHtml(user.specialty)} · ${escapeHtml(user.city)}</p>
            </div>
            <span class="person-role">${escapeHtml(user.role)}</span>
          </div>

          <p class="person-bio">${escapeHtml(user.bio)}</p>
          <p class="project-meta"><strong>Status:</strong> ${escapeHtml(user.status)}</p>
          <p class="project-meta"><strong>Availability:</strong> ${escapeHtml(user.availability)}</p>

          <div class="pill-row">
            ${(Array.isArray(user.interests) ? user.interests : []).map((interest) => `<span class="pill">${escapeHtml(interest)}</span>`).join("")}
          </div>

          <div class="pill-row">
            <button
              class="mini-button"
              type="button"
              data-action="friend"
              data-user-id="${user.id}"
              ${isSignedInUser ? "disabled" : ""}
            >
              ${isSignedInUser ? "Signed in member" : isFriend ? "Already connected" : "Add to network"}
            </button>
            <button
              class="mini-button is-ghost"
              type="button"
              data-action="direct-room"
              data-user-id="${user.id}"
              ${isSignedInUser ? "disabled" : ""}
            >
              Start focused room
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderFriendships() {
  const activeUser = getActiveUser();
  const friends = getFriendIds(activeUser)
    .map((friendId) => getUserById(friendId))
    .filter(Boolean);

  if (!friends.length) {
    elements.friendshipList.innerHTML = '<div class="empty-state">Add collaborators to start building your network.</div>';
    return;
  }

  elements.friendshipList.innerHTML = friends
    .map((friend) => `<span class="friendship-tag">${escapeHtml(friend.name)} · ${escapeHtml(friend.role)}</span>`)
    .join("");
}

function getVisibleConversations() {
  if (!state.activeUserId) {
    return [];
  }

  return state.conversations.filter((conversation) =>
    conversation.participantIds.includes(state.activeUserId)
  );
}

function renderRoomsOverview() {
  const visibleConversations = getVisibleConversations();
  const latestMessage = visibleConversations
    .flatMap((conversation) => conversation.messages || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const collaboratorIds = new Set(
    visibleConversations.flatMap((conversation) =>
      conversation.participantIds.filter((participantId) => participantId !== state.activeUserId)
    )
  );
  const projectIds = new Set(
    visibleConversations.map((conversation) => conversation.projectId).filter(Boolean)
  );

  elements.roomsOverview.innerHTML = renderInsightCards([
    {
      label: "Active rooms",
      value: visibleConversations.length,
      detail: "These are the focused collaboration threads currently open for this member.",
    },
    {
      label: "Latest signal",
      value: latestMessage ? formatDate(latestMessage.createdAt) : "No updates yet",
      detail: latestMessage
        ? `${getUserById(latestMessage.senderId)?.name || "Someone"} posted the most recent update.`
        : "Once a room becomes active, the latest response will appear here.",
    },
    {
      label: "People in motion",
      value: `${collaboratorIds.size} collaborators`,
      detail: "A quick read on how many people are already moving with this member.",
    },
    {
      label: "Projects covered",
      value: `${projectIds.size} opportunities`,
      detail: "Each room stays attached to a shared project context instead of floating as a generic DM.",
    },
  ]);
}

function syncRoomBuilderOptions() {
  const activeUser = getActiveUser();

  elements.roomProjectSelect.innerHTML = state.projects
    .map((project) => {
      const owner = getProjectOwner(project);
      return `<option value="${project.id}">${escapeHtml(project.title)} · ${escapeHtml(owner?.name || "Unknown")}</option>`;
    })
    .join("");

  if (!activeUser) {
    elements.roomCollaboratorSelect.innerHTML = "";
    return;
  }

  elements.roomCollaboratorSelect.innerHTML = state.users
    .filter((user) => user.id !== state.activeUserId)
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(user.role)}</option>`)
    .join("");
}

function renderConversations() {
  const visibleConversations = getVisibleConversations();

  if (!visibleConversations.length) {
    state.activeConversationId = null;
    elements.conversationList.innerHTML =
      '<div class="empty-state">No focused rooms yet. Start one from a project card or the room builder.</div>';
    return;
  }

  if (!visibleConversations.some((conversation) => conversation.id === state.activeConversationId)) {
    state.activeConversationId = visibleConversations[0].id;
  }

  elements.conversationList.innerHTML = visibleConversations
    .map((conversation, index) => {
      const project = getConversationProject(conversation);
      const latest = getLastMessage(conversation.messages);
      const participantNames = conversation.participantIds
        .map((id) => getUserById(id)?.name)
        .filter(Boolean)
        .map((name) => escapeHtml(name))
        .join(" · ");
      const style = getVisualStyle(`${conversation.title}-${index}`);

      return `
        <article
          class="conversation-card ${conversation.id === state.activeConversationId ? "is-active" : ""}"
          data-action="select-conversation"
          data-conversation-id="${conversation.id}"
          style="${style}"
        >
          <div class="conversation-header">
            <div>
              <h4>${escapeHtml(conversation.title)}</h4>
              <p class="conversation-preview">${escapeHtml(project?.title || "Standalone room")}</p>
            </div>
            <span class="pill">${conversation.messages.length} updates</span>
          </div>

          <p class="conversation-preview">${escapeHtml(conversation.focus)}</p>
          <p class="conversation-preview">${participantNames}</p>
          <p class="conversation-preview">${latest ? `${escapeHtml(getUserById(latest.senderId)?.name || "Someone")} · ${formatDate(latest.createdAt)}` : "No messages yet"}</p>
        </article>
      `;
    })
    .join("");
}

function renderThread() {
  const conversation = state.conversations.find((entry) => entry.id === state.activeConversationId);

  if (!conversation) {
    elements.threadHeader.innerHTML = '<div class="empty-state">Choose a room to view its updates.</div>';
    elements.messageThread.innerHTML = "";
    elements.messageForm.hidden = true;
    return;
  }

  const project = getConversationProject(conversation);
  const participants = conversation.participantIds
    .map((id) => getUserById(id)?.name)
    .filter(Boolean)
    .map((name) => escapeHtml(name))
    .join(" · ");

  elements.threadHeader.innerHTML = `
    <p class="eyebrow">Focused room</p>
    <h3>${escapeHtml(conversation.title)}</h3>
    <p class="thread-subtitle">${escapeHtml(conversation.focus)}</p>
    <p class="thread-subtitle">
      <strong>Project:</strong> ${escapeHtml(project?.title || "Standalone")} · <strong>Participants:</strong> ${participants}
    </p>
  `;

  elements.messageThread.innerHTML = conversation.messages
    .map((message) => {
      const sender = getUserById(message.senderId);
      const isOwn = message.senderId === state.activeUserId;

      return `
        <article class="message-card ${isOwn ? "is-own" : ""}">
          <div class="message-meta">
            <span>${escapeHtml(sender?.name || "Unknown")}</span>
            <span>${formatDate(message.createdAt)}</span>
          </div>
          <p>${escapeHtml(message.body)}</p>
        </article>
      `;
    })
    .join("");

  elements.messageForm.hidden = false;
}

function renderAll() {
  renderCurrentView();

  if (!getActiveUser()) {
    return;
  }

  populateActiveUserSelect();
  renderStats();
  renderProjects();
  renderPeople();
  renderFriendships();
  renderRoomsOverview();
  renderProfileHighlights();
  renderProfileSummary();
  syncRoomBuilderOptions();
  renderConversations();
  renderThread();
}

async function loadBootstrap() {
  const payload = await request("/api/bootstrap");

  state.users = Array.isArray(payload.users) ? payload.users : [];
  state.projects = Array.isArray(payload.projects)
    ? [...payload.projects].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];
  state.conversations = Array.isArray(payload.conversations)
    ? [...payload.conversations].sort((a, b) => {
        const aDate = getLastMessage(a.messages)?.createdAt || 0;
        const bDate = getLastMessage(b.messages)?.createdAt || 0;
        return new Date(bDate) - new Date(aDate);
      })
    : [];
  state.stats = payload.stats || {};

  const sessionUser = getUserById(state.sessionUserId);
  if (!sessionUser) {
    return false;
  }

  state.activeUserId = sessionUser.id;

  if (!getUserById(state.profileUserId)) {
    state.profileUserId = sessionUser.id;
  }

  if (!getVisibleConversations().some((conversation) => conversation.id === state.activeConversationId)) {
    state.activeConversationId = getVisibleConversations()[0]?.id || null;
  }

  return true;
}

async function enterApp() {
  const hasSessionUser = await loadBootstrap();

  if (!hasSessionUser) {
    throw new Error("This session is no longer available. Please sign in again.");
  }

  state.currentView = getViewFromHash();
  renderAll();
  showAppShell();
}

function logout({ message = "You signed out successfully.", tone = "success" } = {}) {
  clearStoredSession();
  clearSessionState();
  elements.loginForm.reset();
  elements.registerForm.reset();
  setAuthView("login");
  showAuthScreen();
  showAuthNotice(message, tone);
}

async function addFriend(friendId) {
  const activeUser = getActiveUser();

  if (!activeUser || friendId === activeUser.id) {
    return;
  }

  await request("/api/friends", {
    method: "POST",
    body: JSON.stringify({
      userId: activeUser.id,
      friendId,
    }),
  });

  await loadBootstrap();
  renderAll();
  showNotice("Network updated.");
}

async function createConversation(projectId, collaboratorId, focus = "") {
  const activeUser = getActiveUser();

  if (!activeUser || collaboratorId === activeUser.id) {
    showNotice("Pick a different collaborator to open a room.");
    return;
  }

  const payload = await request("/api/conversations", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      initiatorId: activeUser.id,
      collaboratorId,
      focus,
    }),
  });

  await loadBootstrap();
  state.activeConversationId = payload.conversation.id;
  renderAll();
  navigateToView("rooms");
  showNotice("Focused room ready.");
}

async function sendMessage(body) {
  const conversationId = state.activeConversationId;
  const senderId = state.activeUserId;

  if (!conversationId || !senderId) {
    showNotice("Choose a room first.");
    return;
  }

  await request("/api/messages", {
    method: "POST",
    body: JSON.stringify({
      conversationId,
      senderId,
      body,
    }),
  });

  await loadBootstrap();
  state.activeConversationId = conversationId;
  renderAll();
}

function prefillRoomBuilder(projectId, collaboratorId = null) {
  const project = getProjectById(projectId);
  if (!project) {
    return;
  }

  elements.roomProjectSelect.value = projectId;

  const targetCollaboratorId =
    collaboratorId ||
    (project.ownerId === state.activeUserId
      ? state.users.find((user) => user.id !== state.activeUserId)?.id
      : project.ownerId);

  if (targetCollaboratorId) {
    elements.roomCollaboratorSelect.value = targetCollaboratorId;
  }

  navigateToView("focused-contact");
}

async function handleProjectAction(projectId) {
  const project = getProjectById(projectId);
  if (!project) {
    return;
  }

  const existing = state.conversations.find(
    (conversation) =>
      conversation.projectId === projectId && conversation.participantIds.includes(state.activeUserId)
  );

  if (existing) {
    state.activeConversationId = existing.id;
    renderAll();
    navigateToView("rooms");
    return;
  }

  if (project.ownerId === state.activeUserId) {
    prefillRoomBuilder(projectId);
    showNotice("Choose a collaborator to open a focused room for your project.");
    return;
  }

  await createConversation(projectId, project.ownerId, project.collaborationGoal);
  navigateToView("rooms");
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearAuthNotice();

  const formData = new FormData(elements.loginForm);
  const payload = {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || "").trim(),
  };

  if (!payload.email || !payload.password) {
    showAuthNotice("Enter your email and password to continue.");
    return;
  }

  setFormPending(elements.loginForm, true, "Entering workspace...");

  try {
    const response = await request("/api/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    saveSession(response.session);
    applySession(response.session);
    state.profileUserId = response.session.userId;
    elements.loginForm.reset();
    await enterApp();
    showNotice(`Welcome back, ${response.user.name}.`);
  } catch (error) {
    clearStoredSession();
    clearSessionState();
    showAuthScreen();
    setAuthView("login", { emailPrefill: payload.email });
    showAuthNotice(error.message);
  } finally {
    setFormPending(elements.loginForm, false, "Entering workspace...");
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  clearAuthNotice();

  const formData = new FormData(elements.registerForm);
  const payload = {
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    profession: String(formData.get("profession") || "").trim(),
    password: String(formData.get("password") || "").trim(),
    confirmPassword: String(formData.get("confirmPassword") || "").trim(),
  };

  if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone || !payload.profession || !payload.password) {
    showAuthNotice("Complete every field to create your membership.");
    return;
  }

  if (payload.password !== payload.confirmPassword) {
    showAuthNotice("The password confirmation does not match.");
    return;
  }

  setFormPending(elements.registerForm, true, "Creating membership...");

  try {
    await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone,
        profession: payload.profession,
        password: payload.password,
      }),
    });

    elements.registerForm.reset();
    setAuthView("login", { emailPrefill: payload.email });
    showAuthNotice("Membership created. Sign in with your email and password.", "success");
  } catch (error) {
    showAuthNotice(error.message);
  } finally {
    setFormPending(elements.registerForm, false, "Creating membership...");
  }
}

function bindEvents() {
  if (elements.sectionMenuToggle && elements.sectionMenu) {
    elements.sectionMenuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setSectionMenuOpen(!document.body.classList.contains("menu-open"));
    });
  }

  if (elements.sectionMenuBack) {
    elements.sectionMenuBack.addEventListener("click", () => {
      setSectionMenuOpen(false);
    });
  }

  if (elements.sectionMenu) {
    elements.sectionMenu.addEventListener("scroll", () => {
      updateSectionMenuScrollState();
    });
  }

  document.addEventListener("click", (event) => {
    const authTrigger = event.target.closest("[data-auth-view]");
    if (authTrigger) {
      event.preventDefault();
      setAuthView(authTrigger.dataset.authView);
      return;
    }

    const viewLink = event.target.closest("[data-view-link]");
    if (viewLink) {
      event.preventDefault();
      navigateToView(viewLink.dataset.viewLink);
      return;
    }

    if (
      elements.sectionMenu &&
      elements.sectionMenuToggle &&
      document.body.classList.contains("menu-open") &&
      !elements.sectionMenu.contains(event.target) &&
      !elements.sectionMenuToggle.contains(event.target)
    ) {
      setSectionMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSectionMenuOpen(false);
    }
  });

  window.addEventListener("hashchange", () => {
    if (elements.appShell.hidden) {
      state.currentView = getViewFromHash();
      return;
    }

    setCurrentView(getViewFromHash(), { updateHash: false });
  });

  window.addEventListener("popstate", () => {
    if (elements.appShell.hidden) {
      state.currentView = getViewFromHash();
      return;
    }

    setCurrentView(getViewFromHash(), { updateHash: false });
  });

  elements.profileUserSelect.addEventListener("change", (event) => {
    state.profileUserId = event.target.value;
    renderProfileHighlights();
    renderProfileSummary();
  });

  elements.themeToggle.addEventListener("click", () => {
    setTheme(getNextTheme(state.theme));
  });

  if (elements.footerThemeToggle) {
    elements.footerThemeToggle.addEventListener("click", () => {
      setTheme(getNextTheme(state.theme));
    });
  }

  elements.logoutButton.addEventListener("click", () => {
    logout();
  });

  if (elements.footerLogoutButton) {
    elements.footerLogoutButton.addEventListener("click", () => {
      logout();
    });
  }

  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.registerForm.addEventListener("submit", handleRegisterSubmit);

  if (elements.peopleSearch) {
    elements.peopleSearch.addEventListener("input", (event) => {
      state.peopleSearch = String(event.target.value || "");
      renderPeople();
    });
  }

  elements.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.peopleFilter = button.dataset.filter;
      elements.filterButtons.forEach((entry) => entry.classList.toggle("is-active", entry === button));
      renderPeople();
    });
  });

  elements.projectsList.addEventListener("click", async (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) {
      return;
    }

    const { action, projectId } = target.dataset;

    if (action === "project-room") {
      try {
        await handleProjectAction(projectId);
      } catch (error) {
        showNotice(error.message);
      }
    }

    if (action === "prefill-room") {
      prefillRoomBuilder(projectId);
    }
  });

  elements.peopleList.addEventListener("click", async (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) {
      return;
    }

    const { action, userId } = target.dataset;

    try {
      if (action === "friend") {
        await addFriend(userId);
      }

      if (action === "direct-room") {
        const projectId = elements.roomProjectSelect.value || state.projects[0]?.id;
        if (!projectId) {
          showNotice("Create a project first so the room has a shared context.");
          return;
        }

        prefillRoomBuilder(projectId, userId);
      }
    } catch (error) {
      showNotice(error.message);
    }
  });

  elements.roomForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(elements.roomForm);

    try {
      await createConversation(
        formData.get("projectId"),
        formData.get("collaboratorId"),
        formData.get("focus")
      );
      elements.roomForm.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  elements.projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(elements.projectForm);
    const payload = Object.fromEntries(formData.entries());
    payload.ownerId = state.activeUserId;

    try {
      await request("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await loadBootstrap();
      renderAll();
      elements.projectForm.reset();
      showNotice("Project published.");
    } catch (error) {
      showNotice(error.message);
    }
  });

  elements.conversationList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-conversation-id]");
    if (!card) {
      return;
    }

    state.activeConversationId = card.dataset.conversationId;
    renderConversations();
    renderThread();
  });

  elements.messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(elements.messageForm);
    const body = String(formData.get("body") || "").trim();

    if (!body) {
      return;
    }

    try {
      await sendMessage(body);
      elements.messageForm.reset();
      showNotice("Update sent.");
    } catch (error) {
      showNotice(error.message);
    }
  });
}

async function init() {
  setTheme(state.theme);
  setSectionMenuOpen(false);
  state.currentView = getViewFromHash();
  renderProfessionOptions();
  setAuthView("login");
  bindEvents();

  const storedSession = getStoredSession();
  if (!storedSession) {
    showAuthScreen();
    return;
  }

  applySession(storedSession);
  state.profileUserId = storedSession.userId;

  try {
    await enterApp();
  } catch (error) {
    clearStoredSession();
    clearSessionState();
    setAuthView("login");
    showAuthScreen();
    showAuthNotice(error.message);
  }
}

init().catch((error) => {
  console.error(error);
  showAuthScreen();
  showAuthNotice("Unable to load the app right now.");
});
