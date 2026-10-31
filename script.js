// ==========================================
// 1. FIREBASE CONFIGURATION & API INITIALIZATION
// ==========================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase Initialize (Fallback to Offline if config missing)
let db = null;
let auth = null;
let currentUser = null;

try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase API initialized successfully.");
  } else {
    console.warn("Firebase Config not updated. Running in Offline Mode.");
  }
} catch (err) {
  console.error("Firebase init error:", err);
}

// ==========================================
// 2. STATE MANAGEMENT & DOM ELEMENTS
// ==========================================
let items = [];
let activeFilter = "all";
let isSignUpMode = false;

// DOM Elements
const authBar = document.getElementById("auth-bar");
const eventsContainer = document.getElementById("events-container");
const filtersContainer = document.getElementById("filters-container");

// Item Modal Elements
const itemModalOverlay = document.getElementById("item-modal-overlay");
const itemForm = document.getElementById("item-form");
const addCustomBtn = document.getElementById("add-custom-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const formError = document.getElementById("form-error");

// Auth Modal Elements
const authModalOverlay = document.getElementById("auth-modal-overlay");
const authForm = document.getElementById("auth-form");
const authModalTitle = document.getElementById("auth-modal-title");
const toggleAuthModeBtn = document.getElementById("toggle-auth-mode-btn");
const authCancelBtn = document.getElementById("auth-cancel-btn");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authError = document.getElementById("auth-error");

// Carousel Elements
const heroSlides = document.getElementById("hero-slides");
const heroDots = document.getElementById("hero-dots");

// ==========================================
// 3. FIREBASE AUTHENTICATION (API INTEGRATION)
// ==========================================
if (auth) {
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    renderAuthBar();
    fetchData(); // User badalne par data sync reload karein
  });
} else {
  renderAuthBar();
  fetchData();
}

function renderAuthBar() {
  if (currentUser) {
    authBar.innerHTML = `
      <span class="greeting">Hi, ${currentUser.email.split('@')[0]}</span>
      <button class="btn btn-ghost" onclick="handleLogout()">Logout</button>
    `;
  } else {
    authBar.innerHTML = `
      <button class="btn btn-primary" onclick="openAuthModal(false)">Login</button>
      <button class="btn btn-ghost" onclick="openAuthModal(true)">Sign Up</button>
    `;
  }
}

function openAuthModal(signUpMode = false) {
  isSignUpMode = signUpMode;
  authError.textContent = "";
  authForm.reset();

  if (isSignUpMode) {
    authModalTitle.textContent = "Create Account";
    authSubmitBtn.textContent = "Sign Up";
    toggleAuthModeBtn.textContent = "Already have an account? Login";
  } else {
    authModalTitle.textContent = "Login to MIT Tracker";
    authSubmitBtn.textContent = "Login";
    toggleAuthModeBtn.textContent = "Need an account? Sign up";
  }

  authModalOverlay.hidden = false;
}

authCancelBtn.addEventListener("click", () => {
  authModalOverlay.hidden = true;
});

toggleAuthModeBtn.addEventListener("click", () => {
  openAuthModal(!isSignUpMode);
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";

  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!auth) {
    authError.textContent = "Firebase credentials set nahi hain. Only offline mode available.";
    return;
  }

  try {
    if (isSignUpMode) {
      await auth.createUserWithEmailAndPassword(email, password);
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
    authModalOverlay.hidden = true;
  } catch (err) {
    authError.textContent = err.message;
  }
});

function handleLogout() {
  if (auth) {
    auth.signOut();
  }
}

// ==========================================
// 4. DATA FETCH & LIVE CLOUD API SYNC
// ==========================================
function fetchData() {
  if (db) {
    // Firebase Cloud Firestore se real-time fetch
    db.collection("campus_items").onSnapshot((snapshot) => {
      items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      renderItems();
    }, (error) => {
      console.error("Firestore Read Error:", error);
      fetchLocalData();
    });
  } else {
    fetchLocalData();
  }
}

function fetchLocalData() {
  const saved = localStorage.getItem("mit_items");
  if (saved) {
    items = JSON.parse(saved);
  } else {
    // Default initial mock items
    items = [
      { id: "1", title: "DBMS Assignment 1", type: "assignment", date: getFutureDate(2), desc: "Submit ER Diagram notes." },
      { id: "2", title: "Mid-Term Exams", type: "exam", date: getFutureDate(7), desc: "Syllabus: Unit 1 to 3." },
      { id: "3", title: "Tech Fest 2026", type: "event", date: getFutureDate(12), desc: "Annual Technical Event at Auditorium." }
    ];
    saveLocalData();
  }
  renderItems();
}

function saveLocalData() {
  localStorage.setItem("mit_items", JSON.stringify(items));
}

function getFutureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

// ==========================================
// 5. RENDER & FILTER LOGIC
// ==========================================
function renderItems() {
  eventsContainer.innerHTML = "";

  const filtered = items.filter(item => {
    if (activeFilter === "all") return true;
    return item.type === activeFilter;
  });

  if (filtered.length === 0) {
    eventsContainer.innerHTML = `<p class="empty">No items found for this category.</p>`;
    return;
  }

  // Sort by date (nearest first)
  filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

  filtered.forEach(item => {
    const card = document.createElement("div");

    // Urgent status border determination
    const daysLeft = Math.ceil((new Date(item.date) - new Date()) / (1000 * 60 * 60 * 24));
    let urgencyClass = "card-later";
    if (daysLeft < 0) urgencyClass = "card-done";
    else if (daysLeft <= 2) urgencyClass = "card-urgent";
    else if (daysLeft <= 7) urgencyClass = "card-soon";

    card.className = `card ${urgencyClass}`;
    card.innerHTML = `
      <div class="card-body">
        <span class="badge badge-${item.type}">${item.type}</span>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <div class="card-meta">
          <span>📅 Due: ${item.date}</span>
          ${daysLeft < 0 ? '<span class="overdue">(Overdue)</span>' : `<span>(${daysLeft} days left)</span>`}
        </div>
        ${item.desc ? `<p style="margin:4px 0; font-size:0.9rem; color:var(--muted);">${escapeHtml(item.desc)}</p>` : ''}
        
        <div class="card-actions">
          <button class="btn btn-ghost" onclick="editItem('${item.id}')">Edit</button>
          <button class="btn btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
        </div>
      </div>
    `;
    eventsContainer.appendChild(card);
  });
}

// Filter button clicks
filtersContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("chip")) {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    e.target.classList.add("active");
    activeFilter = e.target.getAttribute("data-filter");
    renderItems();
  }
});

// Helper XSS prevention
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ==========================================
// 6. ADD, EDIT & DELETE ACTIONS (API / DB)
// ==========================================
addCustomBtn.addEventListener("click", () => {
  document.getElementById("item-id").value = "";
  document.getElementById("modal-title").textContent = "Add Campus Item";
  itemForm.reset();
  formError.textContent = "";
  itemModalOverlay.hidden = false;
});

modalCancelBtn.addEventListener("click", () => {
  itemModalOverlay.hidden = true;
});

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("item-id").value;
  const title = document.getElementById("item-title-input").value.trim();
  const type = document.getElementById("item-type-select").value;
  const date = document.getElementById("item-date-input").value;
  const desc = document.getElementById("item-desc-input").value.trim();

  const itemData = { title, type, date, desc, updatedAt: new Date().toISOString() };

  try {
    if (db) {
      if (id) {
        await db.collection("campus_items").doc(id).update(itemData);
      } else {
        await db.collection("campus_items").add(itemData);
      }
    } else {
      if (id) {
        const index = items.findIndex(i => i.id === id);
        if (index !== -1) items[index] = { id, ...itemData };
      } else {
        items.push({ id: Date.now().toString(), ...itemData });
      }
      saveLocalData();
      renderItems();
    }
    itemModalOverlay.hidden = true;
  } catch (err) {
    formError.textContent = "Error saving item: " + err.message;
  }
});

function editItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById("item-id").value = item.id;
  document.getElementById("item-title-input").value = item.title;
  document.getElementById("item-type-select").value = item.type;
  document.getElementById("item-date-input").value = item.date;
  document.getElementById("item-desc-input").value = item.desc || "";

  document.getElementById("modal-title").textContent = "Edit Campus Item";
  formError.textContent = "";
  itemModalOverlay.hidden = false;
}

async function deleteItem(id) {
  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    if (db) {
      await db.collection("campus_items").doc(id).delete();
    } else {
      items = items.filter(i => i.id !== id);
      saveLocalData();
      renderItems();
    }
  } catch (err) {
    alert("Error deleting item: " + err.message);
  }
}

// ==========================================
// 7. HERO SLIDER CAROUSEL LOGIC
// ==========================================
let currentSlide = 0;
const slidesCount = 2;

function showSlide(index) {
  currentSlide = index;
  heroSlides.style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll(".dot").forEach((dot, idx) => {
    dot.classList.toggle("active", idx === currentSlide);
  });
}

heroDots.addEventListener("click", (e) => {
  if (e.target.classList.contains("dot")) {
    const dotsArray = Array.from(heroDots.children);
    const index = dotsArray.indexOf(e.target);
    showSlide(index);
  }
});

// Auto-advance banner every 5 seconds
setInterval(() => {
  currentSlide = (currentSlide + 1) % slidesCount;
  showSlide(currentSlide);
}, 5000);