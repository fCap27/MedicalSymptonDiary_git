// URL API backend
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8000`;


// Storage keys
const STORAGE_TOKEN_KEY = "msd_token";
const STORAGE_USER_KEY = "msd_user";

let authToken = null;

// UTIL: STORAGE & AUTH

function saveAuth(token, user) {
  authToken = token;
  currentUser = user;
  sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
  sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
}

function loadAuthFromStorage() {
  const token = sessionStorage.getItem(STORAGE_TOKEN_KEY);
  const userJson = sessionStorage.getItem(STORAGE_USER_KEY);
  if (!token || !userJson) {
    authToken = null;
    currentUser = null;
    return;
  }
  try {
    authToken = token;
    currentUser = JSON.parse(userJson);
  } catch {
    authToken = null;
    currentUser = null;
  }
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem(STORAGE_TOKEN_KEY);
  sessionStorage.removeItem(STORAGE_USER_KEY);
}

function redirectTo(path) {
  window.location.href = path;
}

// POPUP 
let toastTimeout = null;

function showToast(message, options = {}) {
  const toast = document.getElementById("toast");
  if (!toast) {
    console.warn("Toast element not found in DOM");
    return;
  }

  const { type = "success" } = options;

  toast.className = "toast"; // reset
  if (type === "error") {
    toast.classList.add("error");
  }

  toast.innerHTML = `
    <span class="toast-icon">
      <i class = "fa-solid ${type === "error" ? "fa-triangle-exclamation" : "fa-circle-check"}"></i>
    </span>
    <div class = "toast-text">${message}</div>
    <button class = "toast-close" aria-label = "Chiudi">
      <i class = "fa-solid fa-xmark"></i>
    </button>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  if (closeBtn) {
    closeBtn.onclick = () => hideToast();
  }

  toast.classList.add("show");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(hideToast, 3000);
}

function hideToast() {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.classList.remove("show");
}

// API 

async function fetchCurrentUser() {
  if (!authToken) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      console.warn("fetchCurrentUser non ok:", res.status);
      return null;
    }
    const user = await res.json();
    currentUser = user;
    sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    console.error("Errore fetchCurrentUser:", err);
    return null;
  }
}

// SETUP AUTH (index.html) 

function setupAuthPage() {
  console.log("Init pagina: AUTH");

  const registerForm =        document.getElementById("register-form");
  const loginForm =           document.getElementById("login-form");
  const loginStatus =         document.getElementById("login-status");
  const registerCard =        document.getElementById("register-card");
  const loginCard =           document.getElementById("login-card");
  const showRegisterLink =    document.getElementById("show-register-link");
  const showLoginLink =       document.getElementById("show-login-link");

  const loginEmailInput =     loginForm.querySelector("input[name='email']");
  const registerEmailInput =  registerForm.querySelector("input[name='email']");

  function showRegister() {
    if (loginCard) loginCard.classList.add("hidden");
    if (registerCard) registerCard.classList.remove("hidden");
  }

  function showLogin(prefillEmail = "") {
    if (registerCard) registerCard.classList.add("hidden");
    if (loginCard) loginCard.classList.remove("hidden");
    if (prefillEmail && loginEmailInput) {
      loginEmailInput.value = prefillEmail;
    }
  }

    if (showRegisterLink) {
    showRegisterLink.addEventListener("click", (e) => {
      e.preventDefault();
      showRegister();
    });
  }

  if (showLoginLink) {
    showLoginLink.addEventListener("click", (e) => {
      e.preventDefault();
      showLogin(registerEmailInput ? registerEmailInput.value : "");
    });
  }

  if (!registerForm || !loginForm) {
    console.warn("Form di auth non trovati in DOM");
    return;
  }

  // Già loggato 
  loadAuthFromStorage();
  if (authToken && currentUser) {
    console.log("Già loggato, redirect a home.html");
    redirectTo("home.html");
    return;
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");

    const payload = { name, email, password };

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast("Effettua il login: " + (err?.detail || res.status), { type: "error" });
        return;
      }

      const registeredEmail = registerEmailInput ? registerEmailInput.value : "";
      registerForm.reset();
      showToast("Registrazione completata! Ora effettua il login.", { type: "success" });

      // torna al login e precompila email
      showLogin(registeredEmail);

    } catch (error) {
      console.error("Errore rete registrazione:", error);
      showToast("Errore di rete in registrazione.", { type: "error" });
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get("email");
    const password = formData.get("password");

    const body = new URLSearchParams();
    body.append("username", email);
    body.append("password", password);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        if (loginStatus) {
          loginStatus.textContent = "Login fallito: " + (err?.detail || res.status);
          loginStatus.style.color = "red";
        }
        showToast("Login non riuscito.", { type: "error" });
        return;
      }

      const data = await res.json();
      authToken = data.access_token;
      sessionStorage.setItem(STORAGE_TOKEN_KEY, authToken);

      const user = await fetchCurrentUser();
      if (user && loginStatus) {
        loginStatus.textContent = "Login effettuato.";
        loginStatus.style.color = "green";
      }

      showToast("Login effettuato. Reindirizzamento al diario…", { type: "success" });

      setTimeout(() => {
        redirectTo("home.html");
      }, 600);
    } catch (error) {
      console.error("Errore rete login:", error);
      if (loginStatus) {
        loginStatus.textContent = "Errore di rete in login";
        loginStatus.style.color = "red";
      }
      showToast("Errore di rete in login.", { type: "error" });
    }
  });
}

//home.html

async function setupHomePage() {
  loadAuthFromStorage();
  if (!authToken) {
    redirectTo("index.html");
    return;
  }

  await fetchCurrentUser();
  setupHeaderUserArea();

  const isAdmin = !!currentUser?.is_admin;

  const tileNewSymptom = document.getElementById("tile-new-symptom");
  const tileMyDiary = document.getElementById("tile-my-diary");
  const tileBookVisit = document.getElementById("tile-book-visit");
  const tileMyVisits = document.getElementById("tile-my-visits");

  const tileAdminSymptoms = document.getElementById("tile-admin-symptoms");
  const tileAdminAppointments = document.getElementById("tile-admin-appointments");
  const helpBtn1 = document.getElementById("help-button");
  const HelpBtnAdmin = document.getElementById("help-button-admin");
  const helpModalAdmin = document.getElementById("help-modal-admin");
  const closeHelpBtnAdmin = document.getElementById("close-help-modal-admin");
  const helpOverlayAdmin = helpModal?.querySelector(".modal-overlay-admin");

  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");

  if (isAdmin) {
    // visuale admin
    hide(tileNewSymptom);
    hide(tileMyDiary);
    hide(tileBookVisit);
    hide(tileMyVisits);
    hide(helpBtn1);

    show(tileAdminSymptoms);
    show(tileAdminAppointments);
    show(HelpBtnAdmin);

    if (HelpBtnAdmin && helpModalAdmin) {
      HelpBtnAdmin.addEventListener("click", () => {
        helpModalAdmin.classList.remove("hidden");
      });
    }

    if (closeHelpBtnAdmin) {
      closeHelpBtnAdmin.addEventListener("click", () => {
        helpModalAdmin.classList.add("hidden");
      });
    }

    if (helpOverlayAdmin) {
      helpOverlayAdmin.addEventListener("click", () => {
        helpModalAdmin.classList.add("hidden");
      });
    }

  } else {
    // visuale utente
    show(tileNewSymptom);
    show(tileMyDiary);
    show(tileBookVisit);
    show(tileMyVisits);
    show(helpBtn1);

    hide(tileAdminSymptoms);
    hide(tileAdminAppointments);
  }
}

//admin_appointments.html
async function setupAdminAppointmentsPage() {
  loadAuthFromStorage();
  if (!authToken) {
    redirectTo("index.html");
    return;
  }

  await fetchCurrentUser();
  setupHeaderUserArea();

  if (!currentUser?.is_admin) {
    showToast("Accesso riservato agli amministratori.", { type: "error" });
    redirectTo("home.html");
    return;
  }

  const listEl = document.getElementById("admin-appointments-list");
  if (!listEl) return;

  const formatDateIT = (d) => {
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  const statusLabel = (raw) => {
    const s = (raw || "PENDING").toUpperCase();
    if (s === "CONFIRMED") return { label: "Confermata", cls: "confirmed" };
    if (s === "REJECTED") return { label: "Rifiutata", cls: "rejected" };
    if (s === "PROPOSED") return { label: "Proposta inviata", cls: "pending" };
    return { label: "Da confermare", cls: "pending" };
  };

  const pad = (n) => String(n).padStart(2, "0");
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function addDays(base, days) {
    const d = new Date(base);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d;
  }
  function isWeekend(d) {
    const day = d.getDay();
    return day === 0 || day === 6;
  }
  function nextBusinessDay(d) {
    const out = new Date(d);
    while (isWeekend(out)) out.setDate(out.getDate() + 1);
    return out;
  }
  function getMinBookableDate() {
    return nextBusinessDay(addDays(new Date(), 7));
  }


  async function loadAppointments() {
    listEl.innerHTML = `<p class="hint">Caricamento...</p>`;

    const res = await fetch(`${API_BASE_URL}/api/appointments/admin/all`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!res.ok) {
      listEl.innerHTML = `<p class="hint">Errore caricando le prenotazioni.</p>`;
      return;
    }

    const data = await res.json();
    if (!data.length) {
      listEl.innerHTML = `<p class="hint">Nessuna prenotazione presente.</p>`;
      return;
    }

    listEl.innerHTML = "";

    data.forEach((a) => {
      const div = document.createElement("div");
      div.className = "entry-item";

      const timeStr = String(a.time).slice(0, 5);
      const when = `${formatDateIT(a.date)} ${timeStr}`;
      const st = statusLabel(a.status);

      div.innerHTML = `
        <div class="appt-row">
          <div>
            <strong>${a.user_email}</strong><br/>
            <span class="hint">${a.facility} - ${when}</span><br/>
            <button class="small-button warn" data-action="open-pdf" data-id="${a.id}">
              Scarica PDF allegato
            </a>
          </div>

          <div style="display:flex; align-items:center; gap:0.5rem;">
            <div class="appt-status ${st.cls}">${st.label}</div><br>
            <div id="admin-actions-${a.id}" style="display:flex; align-items:center; gap:0.5rem;">
              <button class="small-button-green" data-action="confirm" data-id="${a.id}" title="Conferma">
                <i class="fa-solid fa-check"></i>
              </button>

              <button class="small-button warn" data-action="propose" data-id="${a.id}" data-facility="${a.facility}" title="Proponi nuovo orario">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>

              <button class="small-button" data-action="reject" data-id="${a.id}" title="Rifiuta">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          
          <div class="hidden" id="propose-box-${a.id}" style="margin-top:0.7rem;">
            <div style="display:flex; gap:0.6rem; flex-wrap:wrap; align-items:flex-end;">
              <div style="min-width:160px;">
                <label class="hint">Data proposta</label>
                <input type="date" id="propose-date-${a.id}" />
              </div>

              <div style="min-width:160px;">
                <label class="hint">Orario proposto</label>
                <select id="propose-time-${a.id}">
                  <option value="">Seleziona...</option>
                </select>
              </div>
            </div>
            <div class="hint" id="propose-hint-${a.id}" style="margin-top:0.35rem;"></div>
            <button class="small-button" data-action="cancel-proposal" data-id="${a.id}">
              Annulla
            </button>
            <button class="small-button warn" data-action="send-proposal" data-id="${a.id}">
              Invia proposta
            </button>
            
          </div>

      `;

      listEl.appendChild(div);
    });

    listEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      
      if (action === "open-pdf") {
        try {
          const resPdf = await fetch(`${API_BASE_URL}/api/appointments/${id}/pdf`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (!resPdf.ok) {
            showToast("Impossibile aprire il PDF.", { type: "error" });
            return;
          }

          const blob = await resPdf.blob();
          const url = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = url;
          a.download = "diario_sintomi.pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          URL.revokeObjectURL(url);


          // opzionale: rilascia dopo un po'
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) {
          console.error(e);
          showToast("Errore di rete aprendo il PDF.", { type: "error" });
        }
        return;
      }


      // 1) Conferma / Rifiuta
      if (action === "confirm" || action === "reject") {
        const status = action === "confirm" ? "CONFIRMED" : "REJECTED";

        const res2 = await fetch(`${API_BASE_URL}/api/appointments/${id}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ status }),
        });

        if (!res2.ok) {
          showToast("Errore aggiornando lo stato.", { type: "error" });
          return;
        }

        showToast("Stato aggiornato.", { type: "success" });
        await loadAppointments();
        return;
      }

      // 2) Apri form proposta
      if (action === "propose") {
        const box = document.getElementById(`propose-box-${id}`);
        const dateEl = document.getElementById(`propose-date-${id}`);
        const timeEl = document.getElementById(`propose-time-${id}`);
        const hintEl = document.getElementById(`propose-hint-${id}`);

        if (!box || !dateEl || !timeEl) return;

        // Mostra box
        box.classList.remove("hidden");
        const actionsBar = document.getElementById(`admin-actions-${id}`);
        if (actionsBar) actionsBar.classList.add("hidden");

        // vincoli data (+7, no weekend)
        const minObj = getMinBookableDate();
        const minStr = toDateStr(minObj);

        dateEl.min = minStr;
        dateEl.value = minStr;

        hintEl.textContent = "Seleziona una data e carica gli slot disponibili...";

        // Funzione per caricare slot disponibili dalla API availability
        async function loadSlotsFor(dateStr) {
          timeEl.innerHTML = `<option value="">Caricamento...</option>`;

          // Prendo stessa struttura
        }

        // Per evitare qualsiasi ambiguità, carichiamo slots usando facility dal dataset del bottone propose:
        // quindi dobbiamo aggiungere data-facility al bottone propose. Lo facciamo nel punto 2B.2 con 1 modifica.
        // (vedi sotto: "Piccola correzione data-facility")
        const facility = btn.getAttribute("data-facility");

        async function refreshAvailabilityFor(dateStr) {
          try {
            const qs = new URLSearchParams({ facility, date: dateStr });
            const res = await fetch(`${API_BASE_URL}/api/appointments/availability?${qs.toString()}`);

            if (!res.ok) {
              timeEl.innerHTML = `<option value="">Errore</option>`;
              hintEl.textContent = "Errore caricando gli orari.";
              return;
            }

            const booked = await res.json(); // ["09:00", ...]
            const bookedSet = new Set(booked);

            const ALL_SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
            timeEl.innerHTML = `<option value="">Seleziona...</option>`;

            ALL_SLOTS.forEach((t) => {
              const opt = document.createElement("option");
              opt.value = t;
              opt.textContent = bookedSet.has(t) ? `${t} (non disponibile)` : t;
              opt.disabled = bookedSet.has(t);
              timeEl.appendChild(opt);
            });

            hintEl.textContent = "Seleziona un orario libero e invia la proposta.";
          } catch (e) {
            console.error(e);
            timeEl.innerHTML = `<option value="">Errore rete</option>`;
            hintEl.textContent = "Errore di rete caricando gli orari.";
          }
        }

        // se weekend sposta a prossimo lavorativo e ricarica
        dateEl.addEventListener("change", async () => {
          let chosen = new Date(dateEl.value + "T12:00:00");
          const minObj2 = getMinBookableDate();
          const minStr2 = toDateStr(minObj2);

          if (toDateStr(chosen) < minStr2) {
            dateEl.value = minStr2;
            showToast("Data non valida: minimo 7 giorni da oggi (no weekend).", { type: "error" });
            await refreshAvailabilityFor(dateEl.value);
            return;
          }

          if (isWeekend(chosen)) {
            chosen = nextBusinessDay(chosen);
            if (toDateStr(chosen) < minStr2) chosen = minObj2;
            dateEl.value = toDateStr(chosen);
            showToast("Weekend non disponibile. Selezionata la prima data utile.", { type: "error" });
          }

          await refreshAvailabilityFor(dateEl.value);
        });

        // slot per la data iniziale
        await refreshAvailabilityFor(dateEl.value);
        return;
      }

        // 3) Annulla form proposta
        if (action === "cancel-proposal") {
          const box = document.getElementById(`propose-box-${id}`);
          if (box) box.classList.add("hidden");
          const actionsBar = document.getElementById(`admin-actions-${id}`);
          if (actionsBar) actionsBar.classList.remove("hidden");
          return;
        }

        // 4) Invia proposta 
        if (action === "send-proposal") {
          const box = document.getElementById(`propose-box-${id}`);
          const dateEl = document.getElementById(`propose-date-${id}`);
          const timeEl = document.getElementById(`propose-time-${id}`);

          if (!dateEl || !timeEl) return;

          const proposed_date = dateEl.value;
          const proposed_time = timeEl.value;

          if (!proposed_date || !proposed_time) {
            showToast("Seleziona data e orario per la proposta.", { type: "error" });
            return;
          }

          const res3 = await fetch(`${API_BASE_URL}/api/appointments/${id}/propose`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ proposed_date, proposed_time }),
          });

          if (!res3.ok) {
            showToast("Errore inviando la proposta.", { type: "error" });
            return;
          }

          showToast("Proposta inviata.", { type: "success" });
          if (box) box.classList.add("hidden");
          const actionsBar = document.getElementById(`admin-actions-${id}`);
          if (actionsBar) actionsBar.classList.remove("hidden");
          await loadAppointments();
          return;
        }
      });
    });

  }

  await loadAppointments();
}

//admin_symptoms.html
async function setupAdminSymptomsPage() {
  loadAuthFromStorage();
  if (!authToken) {
    redirectTo("index.html");
    return;
  }

  await fetchCurrentUser();
  setupHeaderUserArea();

  if (!currentUser?.is_admin) {
    showToast("Accesso riservato agli amministratori.", { type: "error" });
    redirectTo("home.html");
    return;
  }

  const listEl = document.getElementById("admin-symptoms-list");
  if (!listEl) return;

  const formatDateTimeIT = (iso) => {
    try {
      return new Date(iso).toLocaleString("it-IT");
    } catch {
      return iso;
    }
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/entries/admin/all`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!res.ok) {
      listEl.innerHTML = `<p class="hint">Errore caricando i sintomi.</p>`;
      return;
    }

    const entries = await res.json();
    if (!entries.length) {
      listEl.innerHTML = `<p class="hint">Nessun sintomo registrato.</p>`;
      return;
    }

    const groups = {};
    entries.forEach((e) => {
      const key = String(e.user_email || e.user_id);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });

    Object.keys(groups).sort().forEach((email) => {
      const wrap = document.createElement("div");
      wrap.className = "entry-item";

      const items = groups[email];

      wrap.innerHTML = `
        <strong>${email}</strong>
        <div style="margin-top:0.6rem; display:flex; flex-direction:column; gap:0.6rem;">
            ${items.map((e) => `
              <div style="border:1px solid rgba(148,163,184,0.35); border-radius:14px; padding:0.6rem 0.7rem;">
                <div style="display:flex; justify-content:space-between; gap:0.6rem; align-items:flex-start;">
                  <div>
                    <strong>${e.title}</strong>
                    <div class="hint">${formatDateTimeIT(e.timestamp)}</div>
                  </div>
                  <div class="appt-status pending">Sev. ${e.severity}/10</div>
                </div>
                <div class="hint" style="margin-top:0.35rem;">${e.description || "-"}</div>
              </div>
            `).join("")}
          </div>
        `;

        listEl.appendChild(wrap);
      });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<p class="hint">Errore di rete caricando i sintomi.</p>`;
  }
}



// HEADER (diary/snapshots)

function setupHeaderUserArea() {
  const headerUserInfo =  document.getElementById("header-user-info");
  const logoutButton =    document.getElementById("header-logout-button");

  if (!headerUserInfo || !logoutButton) {
    console.warn("Elementi header utente non trovati");
    return;
  }

  if (!authToken || !currentUser) {
    console.log("Nessun auth, redirect a index.html");
    redirectTo("index.html");
    return;
  }

  headerUserInfo.textContent = `${currentUser.name} (${currentUser.email})`;

  logoutButton.addEventListener("click", () => {
    clearAuth();
    redirectTo("index.html");
  });
}

// Nuovo Sintomo (diary.html)

async function setupDiaryPage() {
  console.log("Init pagina: DIARY");

  loadAuthFromStorage();
  if (!authToken) {
    console.log("Nessun token, redirect a index.html");
    redirectTo("index.html");
    return;
  }

  await fetchCurrentUser();
  setupHeaderUserArea();

  const entriesList = document.getElementById("entries-list");
  const symptomForm = document.getElementById("symptom-form");
  const hasEntriesList = Boolean(entriesList);

  if (!symptomForm) {
    console.warn("Elemento symptom-form non trovato");
    return;
  }

  let editingEntryId = null;
  const editingInput = document.getElementById("editing-entry-id");
  const submitButton = symptomForm.querySelector("button[type='submit']");
  const cancelEditButton = document.getElementById("cancel-edit-btn");


  function exitEditMode() {
    symptomForm.reset();
    symptomForm.severity.value = 5;
    // esce dalla modalità modifica + aggiorna UI (bottone e hidden input)
    // se non vuoi richiamare setEditingId, lascia com'è, ma questa è più pulita:
    editingEntryId = null;
    if (editingInput) editingInput.value = "";
    if (submitButton) submitButton.textContent = "Salva sintomo";
    if (cancelEditButton) cancelEditButton.classList.add("hidden");
  }

  if (cancelEditButton) {
    cancelEditButton.addEventListener("click", () => {
      exitEditMode();
      if (document.body.dataset.page === "snapshots") {
        symptomForm.classList.add("hidden");
      }
      showToast("Modifica annullata.", { type: "success" });
    });
  }



  // Proponi oggi e blocco date future
  const tsInput = document.getElementById("timestamp");
  if (tsInput) {
    const now = new Date();
    // datetime-local vuole formato "YYYY-MM-DDTHH:MM"
    
    const pad = (n) => String(n).padStart(2, "0");
    const localValue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    tsInput.value = localValue;
    tsInput.max = localValue; // impedisce date future dal selettore
  } 


  if (!symptomForm) {
    console.warn("Elemento symptom-form non trovato");
    return;
  }

  // entriesList facolt in diary.html
  if (!entriesList) {
    console.warn("entries-list non trovato");
  }


  symptomForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!authToken) {
      showToast("Devi essere loggato.", { type: "error" });
      redirectTo("index.html");
      return;
    }

    const formData = new FormData(symptomForm);
    const title =       (formData.get("title") || "").trim();
    const description = (formData.get("description") || "").trim();
    const severity = parseInt(formData.get("severity"), 10);
    const timestampRaw = formData.get("timestamp");
    const tags =        (formData.get("tags") || "").trim();

    // blocco manuale
    if (timestampRaw) {
      const chosen = new Date(timestampRaw);
    if (chosen.getTime() > Date.now()) {
      showToast("La data non può essere nel futuro.", { type: "error" });
      return;
      }
    }


    if (!timestampRaw) {
      showToast("Seleziona data e ora.", { type: "error" });
      return;
    }

    const payload = {
      title,
      description,
      severity,
      timestamp: `${timestampRaw}:00`,
      tags: tags,
    };

    const isEditing = Boolean(editingEntryId);
    const url = isEditing ? `${API_BASE_URL}/api/entries/${editingEntryId}` : `${API_BASE_URL}/api/entries`;
    const method = isEditing ? "PUT" : "POST";


    try {
      const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });


      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast("Errore salvataggio sintomo: " + (err?.detail || res.status), {
          type: "error",
        });
        return;
      }

      symptomForm.reset();
      symptomForm.severity.value = 5;

      // esci dalla modalità modifica
      editingEntryId = null;
      if (editingInput) editingInput.value = "";
      if (submitButton) submitButton.textContent = "Salva sintomo";
      if (document.body.dataset.page === "snapshots") {
        symptomForm.classList.add("hidden");
      }

      showToast(isEditing ? "Sintomo aggiornato." : "Sintomo salvato. Visualizza Diario Sintomi", { type: "success" });

      if (hasEntriesList) {
        await loadEntries(entriesList, symptomForm, () => editingEntryId, (id) => {
          editingEntryId = id;
          if (editingInput) editingInput.value = id ? String(id) : "";
          if (submitButton) submitButton.textContent = id ? "Aggiorna sintomo" : "Salva sintomo";

          if (cancelEditButton) {
            if (id) cancelEditButton.classList.remove("hidden");
            else cancelEditButton.classList.add("hidden");
          }
        });
      }


    } catch (error) {
      console.error("Errore rete salvataggio sintomo:", error);
      showToast("Errore di rete nel salvataggio del sintomo.", { type: "error" });
    }
  });

  if (hasEntriesList) {
    await loadEntries(entriesList, symptomForm, () => editingEntryId, (id) => {
      editingEntryId = id;
      if (editingInput) editingInput.value = id ? String(id) : "";

      if (submitButton) submitButton.textContent = id ? "Aggiorna sintomo" : "Salva sintomo";

      // mostra/nasconde il bottone annulla
      if (cancelEditButton) {
        if (id) cancelEditButton.classList.remove("hidden");
        else cancelEditButton.classList.add("hidden");
      }
    });
  }

}

async function loadEntries(entriesList, symptomForm, getEditingId, setEditingId) {
  if (!entriesList) return;

  if (!authToken) {
    entriesList.innerHTML = `<p class = "hint">Devi fare login per vedere i sintomi.</p>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/entries`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!res.ok) {
      entriesList.innerHTML = `<p class = "hint">Errore caricando sintomi.</p>`;
      return;
    }

    const data = await res.json();
    if (data.length === 0) {
      entriesList.innerHTML = `<p class = "hint">Nessun sintomo ancora.</p>`;
      return;
    }

    entriesList.innerHTML = "";
    data.forEach((entry) => {
      const div = document.createElement("div");
      div.className = "entry-item";

      const dt = new Date(entry.timestamp);
      const dateStr = dt.toLocaleString("it-IT");

      div.innerHTML = `
        <strong>${entry.title}</strong> (${entry.severity}/10) - ${dateStr}<br/>
        <span>${entry.description || "Nessuna descrizione"}</span><br/>
        <span class="hint">Tag: ${entry.tags || "-"}</span>

        <div class="entry-actions">
          <button class="icon-btn edit-btn" data-id="${entry.id}" title="Modifica">
            <i class="fa-solid fa-pen"></i> 
          </button>
          <button class="icon-btn danger delete-btn" data-id="${entry.id}" title="Elimina">
            <i class="fa-solid fa-trash"></i> 
          </button>
        </div>
      `;

      // DELETE
      const delBtn = div.querySelector(".delete-btn");
      delBtn.addEventListener("click", async () => {
        if (!confirm("Vuoi eliminare questo sintomo?")) return;

        try {
          const res = await fetch(`${API_BASE_URL}/api/entries/${entry.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (!res.ok) {
            const err = await res.json().catch(() => null);
            showToast("Errore eliminazione: " + (err?.detail || res.status), { type: "error" });
            return;
          }

          showToast("Sintomo eliminato.", { type: "success" });
          await loadEntries(entriesList, symptomForm, getEditingId, setEditingId);
        } catch (e) {
          console.error(e);
          showToast("Errore di rete eliminando il sintomo.", { type: "error" });
        }
      });

      // Edit
      const editBtn = div.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          if (!symptomForm) return;

          symptomForm.title.value = entry.title;
          symptomForm.description.value = entry.description || "";
          symptomForm.severity.value = entry.severity;
          const dt = new Date(entry.timestamp);
          const pad = (n) => String(n).padStart(2, "0");
          const localValue =
            `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
            `T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
          symptomForm.timestamp.value = localValue;

          symptomForm.tags.value = entry.tags || "";

          setEditingId(entry.id);

          showToast("modifica attiva.", { type: "success" });
          // form visibiile
          if (document.body.dataset.page === "snapshots") {
            symptomForm.classList.remove("hidden");
          }

          symptomForm.scrollIntoView({ behavior: "smooth" });
        });
      }


      entriesList.appendChild(div);
    });
  } catch (error) {
    console.error("Errore rete caricando sintomi:", error);
    entriesList.innerHTML = `<p class="hint">Errore di rete caricando sintomi.</p>`;
  }
}

// appuntamenti (appointments.html)

async function setupAppointmentsPage() {
  loadAuthFromStorage();
  if (!authToken) {
    redirectTo("index.html");
    return;
  }

  await fetchCurrentUser();
  setupHeaderUserArea();

  const form = document.getElementById("appointment-form");
  const facilitySel = document.getElementById("facility");
  const dateInput = document.getElementById("visit-date");
  const timeSel = document.getElementById("time-slot");
  const statusEl = document.getElementById("appointment-status");

  const pdfFilenameInput = document.getElementById("pdf-filename");
  const generatePdfBtn = document.getElementById("generate-pdf-btn");
  const downloadPdfLink = document.getElementById("download-pdf-link");

  if (!form || !facilitySel || !dateInput || !timeSel) return;

  // Data: prenotabile a 7 giorni no sabato/domenica
  const pad = (n) => String(n).padStart(2, "0");
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = toDateStr(new Date());

  function addDays(base, days) {
    const d = new Date(base);
    d.setHours(12, 0, 0, 0); 
    d.setDate(d.getDate() + days);
    return d;
  }

  function isWeekend(d) {
    const day = d.getDay(); 
    return day === 0 || day === 6;
  }

  function nextBusinessDay(d) {
    const out = new Date(d);
    while (isWeekend(out)) out.setDate(out.getDate() + 1);
    return out;
  }

  function getMinBookableDate() {
    const base = addDays(new Date(), 7); // +7 da oggi
    return nextBusinessDay(base);        // se weekend primo lavorativo
  }

  const minDateObj = getMinBookableDate();
  const minDateStr = toDateStr(minDateObj);

  dateInput.min = minDateStr;
  dateInput.value = minDateStr;

  // Slot fissi 08:00 - 17:00 (10 slot)
  const ALL_SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];

  // PDF in memoria
  let pdfBlobUrl = null;
  let pdfFileName = null;
  let pdfBase64 = null; // da inviare al backend (senza download)

  function setSlots(bookedSet) {
    timeSel.innerHTML = `<option value="">Seleziona...</option>`;
    ALL_SLOTS.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = bookedSet && bookedSet.has(t) ? `${t} (non disponibile)` : t;
      opt.disabled = bookedSet && bookedSet.has(t);
      timeSel.appendChild(opt);
    });
  }

  async function refreshAvailability() {
  const facility = facilitySel.value;
  const date = dateInput.value;

  if (!facility || !date) {
    timeSel.innerHTML = `<option value="">Seleziona data/struttura...</option>`;
    return;
  }

  try {
    const qs = new URLSearchParams({ facility, date });
    const res = await fetch(`${API_BASE_URL}/api/appointments/availability?${qs.toString()}`);

    if (!res.ok) {
      showToast("Errore caricando disponibilità orari.", { type: "error" });
      timeSel.innerHTML = `<option value="">Errore disponibilità</option>`;
      return;
    }

    const bookedTimes = await res.json(); // es. ["09:00","12:00"]
    const bookedSet = new Set(bookedTimes);
    setSlots(bookedSet);
  } catch (e) {
    console.error(e);
    showToast("Errore di rete caricando disponibilità.", { type: "error" });
    timeSel.innerHTML = `<option value="">Errore di rete</option>`;
  }
}


  facilitySel.addEventListener("change", refreshAvailability);
  dateInput.addEventListener("change", () => {
    const minObj = getMinBookableDate();
    const minStr = toDateStr(minObj);

    let chosen = new Date(dateInput.value + "T12:00:00");

    // Se prima della data minima forza la minima
    if (toDateStr(chosen) < minStr) {
      dateInput.value = minStr;
      showToast("Puoi prenotare solo a partire da 7 giorni da oggi (escluso weekend).", { type: "error" });
      refreshAvailability();
      return;
    }

    // Se weekend sposta al primo lavorativo successivo
    if (isWeekend(chosen)) {
      chosen = nextBusinessDay(chosen);

      // protezione extra: se per qualche motivo finisce prima del minimo
      if (toDateStr(chosen) < minStr) chosen = minObj;

      dateInput.value = toDateStr(chosen);
      showToast("Weekend non disponibile. Selezionata la prima data utile.", { type: "error" });
    }

    refreshAvailability();
  });

  await refreshAvailability();

  // Genera nome file: NomeUtente_DiarioSintomi_DataOdierna.pdf
  function buildPdfFileName() {
    const safeName = (currentUser?.name || "Utente").replace(/\s+/g, "_");
    return `${safeName}_DiarioSintomi_${todayStr}.pdf`;
  }

  // Generazione PDF: SOLO in memoria. Scarica solo se clicchi sul link.
  generatePdfBtn.addEventListener("click", async () => {
    try {
      // Prende i sintomi dal backend
      const res = await fetch(`${API_BASE_URL}/api/entries`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        showToast("Impossibile caricare i sintomi.", { type: "error" });
        return;
      }

      const entries = await res.json();
      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (!entries.length) {
        showToast("Nessun sintomo. Inserisci almeno un sintomo nel Diario.", { type: "error" });

        pdfBase64 = null;
        pdfFileName = null;
        pdfFilenameInput.value = "(non generato)";
        downloadPdfLink.classList.add("hidden");
        downloadPdfLink.href = "#";

        return;
      }


      // Usa jsPDF (CDN)
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      const fileName = buildPdfFileName();

      doc.setFontSize(14);
      doc.text("Medical Symptom Diary - Diario Sintomi", 14, 18);
      doc.setFontSize(10);
      doc.text(`Paziente: ${currentUser?.name || ""} (${currentUser?.email || ""})`, 14, 26);
      doc.text(`Data generazione: ${todayStr}`, 14, 32);

      let y = 42;
      doc.setFontSize(11);
      if (!entries.length) {
        doc.text("Nessun sintomo registrato.", 14, y);
      } else {
        entries.forEach((e, idx) => {
          const dt = new Date(e.timestamp).toLocaleString("it-IT");
          const line1 = `${idx + 1}. ${e.title} | Intensità ${e.severity}/10 | ${dt}`;
          const line2 = `Descrizione: ${e.description || "-"}`;
          const line3 = `Note: ${e.tags || "-"}`;

          // gestione “a mano” del salto pagina
          if (y > 270) { doc.addPage(); y = 20; }

          doc.text(line1, 14, y); y += 6;
          doc.text(line2, 14, y); y += 6;
          doc.text(line3, 14, y); y += 10;
        });
      }

      // 1) Blob URL per download (solo su click)
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const blob = doc.output("blob");
      pdfBlobUrl = URL.createObjectURL(blob);

      // 2) Base64 per allegare alla prenotazione (senza scaricare)
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      bytes.forEach((b) => binary += String.fromCharCode(b));
      pdfBase64 = btoa(binary);

      pdfFileName = fileName;
      pdfFilenameInput.value = fileName;

      downloadPdfLink.href = pdfBlobUrl;
      downloadPdfLink.download = fileName;
      downloadPdfLink.classList.remove("hidden");

      showToast("PDF generato. clicca su download per scaricare.", { type: "success" });
    } catch (e) {
      console.error(e);
      showToast("Errore generando il PDF.", { type: "error" });
    }
  });

  // Submit prenotazione (nel prossimo step lo colleghiamo al backend POST /api/appointments)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const facility = facilitySel.value;
    const date = dateInput.value;
    const time = timeSel.value;

    if (!facility || !date || !time) {
      showToast("Compila struttura, data e orario.", { type: "error" });
      return;
    }

    // Richiedi esplicitamente il PDF prima di inviare (così è coerente)
    if (!pdfBase64 || !pdfFileName) {
      showToast("Genera prima il PDF del diario sintomi.", { type: "error" });
      return;
    }

    try {
      const payload = {
        facility,
        date,          // "YYYY-MM-DD"
        time,          // "HH:MM" (Pydantic lo accetta)
        pdf_filename: pdfFileName,
        pdf_base64: pdfBase64
      };

      const res = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        // slot occupato
        showToast("Orario già prenotato. Scegli un altra fascia.", { type: "error" });
        await refreshAvailability(); // aggiorna slot disabilitati
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast("Errore prenotazione: " + (err?.detail || res.status), { type: "error" });
        return;
      }

      // ok
      showToast("Prenotazione inviata con successo. Visualizza Visite prenotate", { type: "success" });
      redirectTo("my_appointments.html");
      if (statusEl) {
        statusEl.textContent = "Prenotazione inviata correttamente.";
        statusEl.style.color = "green";
      }

      // aggiorna disponibilità per disabilitare lo slot appena prenotato
      await refreshAvailability();

    } catch (e2) {
      console.error(e2);
      showToast("Errore di rete inviando la prenotazione.", { type: "error" });
    }

      });
    }

// mie visite (myAppointments.html)

async function setupMyAppointmentsPage() {
  loadAuthFromStorage();
  if (!authToken) {
    redirectTo("index.html");
    return;
  }

  await fetchCurrentUser();
  setupHeaderUserArea();

  const listEl = document.getElementById("my-appointments-list");
  if (!listEl) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/appointments`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!res.ok) {
      listEl.innerHTML = `<p class="hint">Errore caricando le visite.</p>`;
      return;
    }

    const data = await res.json();

    if (!data.length) {
      listEl.innerHTML = `<p class="hint">Nessuna visita prenotata.</p>`;
      return;
    }

    function formatDateIT(dateStr) {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    }

    listEl.innerHTML = "";
    data.forEach((a) => {
      const div = document.createElement("div");
      div.className = "entry-item";

      const timeStr = String(a.time).slice(0, 5);
      const when = `${formatDateIT(a.date)} ${timeStr}`;


      const rawStatus = (a.status || "PENDING").toUpperCase();

      let label = "Da confermare";
      let cls = "pending";

      if (rawStatus === "CONFIRMED") {
        label = "Confermata";
        cls = "confirmed";
      } else if (rawStatus === "REJECTED") {
        label = "Rifiutata";
        cls = "rejected";
      } else if (rawStatus === "PROPOSED") {
        label = "Proposta ricevuta";
        cls = "pending"; // gialla
      }

      const proposedBlock = (rawStatus === "PROPOSED" && a.proposed_date && a.proposed_time)
        ? `
          <div style="margin-top:0.6rem; padding:0.65rem 0.75rem; border-radius:14px; border:1px solid rgba(250,204,21,0.45); background: rgba(250,204,21,0.10);">
            <div style="font-weight:800; margin-bottom:0.35rem;">Nuova proposta dalla struttura</div>
            <div class="hint">Data: <strong>${formatDateIT(a.proposed_date)}</strong> — Orario: <strong>${String(a.proposed_time).slice(0,5)}</strong></div>

            <div style="margin-top:0.55rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button class="small-button-green" data-action="accept-proposal" data-id="${a.id}">
                Accetta
              </button>
              <button class="small-button" data-action="reject-proposal" data-id="${a.id}">
                Rifiuta
              </button>
            </div>
          </div>
        `
        : "";

      div.innerHTML = `
        <div class="appt-row">
          <div>
            <strong>${a.facility}</strong> - ${when}<br/>
            <span class="hint">Allegato: ${a.pdf_filename}</span>
            ${proposedBlock}
          </div>
          <div class="appt-status ${cls}">${label}</div>
        </div>
      `;


      listEl.appendChild(div);
    });

    listEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action !== "accept-proposal" && action !== "reject-proposal") return;

      const endpoint = action === "accept-proposal" ? "accept" : "reject";

      try {
        const res = await fetch(`${API_BASE_URL}/api/appointments/${id}/${endpoint}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!res.ok) {
          showToast("Errore aggiornando la proposta.", { type: "error" });
          return;
        }

        if (endpoint === "accept") {
          showToast("Proposta accettata: visita confermata.", { type: "success" });
        } else {
          showToast("Proposta rifiutata. Prenota una nuova visita dalla pagina Prenotazione visita.", { type: "error" });
        }

        // ricarica la lista
        await setupMyAppointmentsPage();
      } catch (e) {
        console.error(e);
        showToast("Errore di rete.", { type: "error" });
      }
    });
  });

  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<p class="hint">Errore di rete caricando le visite.</p>`;
  }
}


const helpBtn = document.getElementById("help-button");
const helpModal = document.getElementById("help-modal");
const closeHelpBtn = document.getElementById("close-help-modal");
const helpOverlay = helpModal?.querySelector(".modal-overlay");

if (helpBtn && helpModal) {
  helpBtn.addEventListener("click", () => {
    helpModal.classList.remove("hidden");
  });
}

if (closeHelpBtn) {
  closeHelpBtn.addEventListener("click", () => {
    helpModal.classList.add("hidden");
  });
}

if (helpOverlay) {
  helpOverlay.addEventListener("click", () => {
    helpModal.classList.add("hidden");
  });
}


// INIT IN BASE ALLA PAGINA

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  console.log("Pagina rilevata:", page);

  if (page === "auth") {
    setupAuthPage();
  } else if (page === "diary") {
    setupDiaryPage();
  } else if (page === "snapshots") {
    setupDiaryPage();
  } else if (page === "appointments") {
    setupAppointmentsPage();
  } else if (page === "my-appointments") {
    setupMyAppointmentsPage();
  } else if (page === "home") {
    setupHomePage();
  } else if (page === "admin-appointments") {
    setupAdminAppointmentsPage();
  } else if (page === "admin-symptoms") {
    setupAdminSymptomsPage();
  } else {
    console.warn("data-page non riconosciuto o mancante");
  }
});
