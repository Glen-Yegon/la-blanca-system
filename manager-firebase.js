// manager-firebase.js
// NOTE: depends on firebase-config.js
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  getDocs,
  deleteDoc,
  Timestamp
} from "./firebase-config.js";

/* =========================
   DOM ELEMENTS (expected IDs in your HTML)
   ========================= */
const loader = document.getElementById("loader");
const toastEl = document.getElementById("toast");

const pendingCountEl = document.getElementById("pendingCount");
const inProgressCountEl = document.getElementById("inProgressCount");
const completedCountEl = document.getElementById("completedCount");
const revenueSumEl = document.getElementById("revenueSum");
const activeStaffEl = document.getElementById("activeStaff");
const quickJobsListEl = document.getElementById("quickJobsList");

const jobsTableBody = document.querySelector("#jobsTable tbody");
const filterStatusSelect = document.getElementById("filterStatus");
const searchInput = document.getElementById("searchInput");
const refreshJobsBtn = document.getElementById("refreshJobs");

const staffGridEl = document.getElementById("staffGrid");
const reportsListEl = document.getElementById("reportsList");
const cashReportListEl = document.getElementById("cashReportList");
const usersListEl = document.getElementById("usersList");
const activityLogEl = document.getElementById("activityLog");

const dateFilterSelect = document.getElementById("dateFilter");
const applyFilterBtn = document.getElementById("applyFilterBtn");

let unsubOverview = null;
let unsubJobs = null;
let unsubStaff = null;
let unsubActivity = null;

/* ------------------------- small UI helpers ------------------------- */
function showLoader() { if (loader) loader.style.display = "flex"; }
function hideLoader() { if (loader) loader.style.display = "none"; }

function toast(msg, timeout = 3000) {
  if (!toastEl) { console.log("TOAST:", msg); return; }
  toastEl.textContent = msg;
  toastEl.classList.add("visible");
  setTimeout(() => toastEl.classList.remove("visible"), timeout);
}

function formatCurrency(n) {
  try { return `Ksh ${Number(n).toLocaleString()}`; } catch(e){ return `Ksh ${n}`; }
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

/* ------------------------- time range helpers ------------------------- */
function startOfRange(range) {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Timestamp.fromDate(start);
  } else if (range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return Timestamp.fromDate(start);
  } else if (range === "month") {
    const start = new Date(now);
    start.setMonth(now.getMonth() - 1);
    return Timestamp.fromDate(start);
  } else if (range === "3months") {
    const start = new Date(now);
    start.setMonth(now.getMonth() - 3);
    return Timestamp.fromDate(start);
  } else if (range === "year") {
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    return Timestamp.fromDate(start);
  } else {
    return null;
  }
}

/* ------------------------- overview listener ------------------------- */
function startOverviewListener(dateRange = "all") {
  if (unsubOverview) unsubOverview();
  showLoader();

  const jobsRef = collection(db, "jobs");
  const rangeStart = startOfRange(dateRange);
  const qAll = rangeStart ? query(jobsRef, where("createdAt", ">=", rangeStart), orderBy("createdAt", "desc")) : query(jobsRef, orderBy("createdAt", "desc"));

unsubOverview = onSnapshot(qAll, snap => {
  let pending = 0, inprogress = 0, completed = 0, revenue = 0;
  const quick = [];

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const st = d.status;

    if (st === "pending") pending++;
    else if (st === "in_progress") inprogress++;
    else if (st === "completed") {
      completed++;
      revenue += Number(d.total || 0); // only add completed jobs to revenue
    }

    quick.push({
      id: docSnap.id,
      plate: d.plate,
      status: st,
      total: d.total || 0,
      createdAt: d.createdAt || null,
      assignedTo: d.assignedTo || null
    });
  });

  if (pendingCountEl) pendingCountEl.textContent = pending;
  if (inProgressCountEl) inProgressCountEl.textContent = inprogress;
  if (completedCountEl) completedCountEl.textContent = completed;
  if (revenueSumEl) revenueSumEl.textContent = formatCurrency(revenue);

  if (activeStaffEl) {
    const assignedSet = new Set(quick.filter(j => j.assignedTo).map(j => j.assignedTo));
    activeStaffEl.textContent = assignedSet.size || "0";
  }

  if (quickJobsListEl) {
    quickJobsListEl.innerHTML = quick.slice(0, 8).map(j => `
      <div class="quick-item">
        <div class="plate">${j.plate || "—"}</div>
        <div class="meta">${(j.status||"—").replace("_"," ")} • ${formatCurrency(j.total)}</div>
        <div class="time">${j.createdAt ? formatDate(j.createdAt) : ""}</div>
      </div>
    `).join("");
  }

  hideLoader();
}, err => {
  hideLoader();
  console.error("Overview listener error", err);
  toast("Failed to load overview (permissions?)");
});

}

/* ------------------------- jobs listener & render ------------------------- */
function startJobsListener({ status = "all", search = "", dateRange = "all" } = {}) {
  if (unsubJobs) unsubJobs();
  showLoader();

  const jobsRef = collection(db, "jobs");
  const rangeStart = startOfRange(dateRange);

  const clauses = [];
  if (status && status !== "all") clauses.push(where("status", "==", status));
  if (rangeStart) clauses.push(where("createdAt", ">=", rangeStart));

  let qJobs;
  if (clauses.length) qJobs = query(jobsRef, ...clauses, orderBy("createdAt", "desc"));
  else qJobs = query(jobsRef, orderBy("createdAt", "desc"));

  unsubJobs = onSnapshot(qJobs, snap => {
    const rows = [];
    snap.forEach(snapDoc => rows.push({ id: snapDoc.id, ...snapDoc.data() }));

    const filtered = rows.filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.plate && r.plate.toLowerCase().includes(q)) || (r.id && r.id.toLowerCase().includes(q));
    });

    renderJobsTable(filtered);
    hideLoader();
  }, err => {
    console.error("Jobs listener error", err);
    toast("Failed to load jobs (permissions?)");
    hideLoader();
  });
}

function renderJobsTable(rows = []) {
  if (!jobsTableBody) return;
  if (!rows.length) {
    jobsTableBody.innerHTML = `<tr><td colspan="7" class="muted">No jobs found</td></tr>`;
    return;
  }

  jobsTableBody.innerHTML = rows.map(r => {
    const assigned = r.assignedTo || "—";
    const statusLabel = r.status ? r.status.replace("_", " ") : "—";
    const total = formatCurrency(r.total || 0);
    const created = r.createdAt ? formatDate(r.createdAt) : "—";

    return `
      <tr data-id="${r.id}">
        <td>${r.id}</td>
        <td>${r.plate || "—"}</td>
        <td>${r.model || "—"}</td>
        <td>${assigned}</td>
        <td>${statusLabel}</td>
        <td>${total}</td>
        <td>
          ${r.status === "pending" ? `<button class="btn small start-btn" data-id="${r.id}">Start</button>` : ""}
          ${r.status === "in_progress" ? `<button class="btn small complete-btn" data-id="${r.id}">Complete</button>` : ""}
          <button class="btn small details-btn" data-id="${r.id}">Details</button>
          <button class="btn small danger delete-btn" data-id="${r.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  // Wire actions
  jobsTableBody.querySelectorAll(".start-btn").forEach(b => b.onclick = async (e) => {
    const id = e.target.dataset.id;
    try {
      await updateDoc(doc(db, "jobs", id), { status: "in_progress", startedAt: serverTimestamp() });
      toast("Job started");
    } catch (err) {
      console.error(err);
      toast("Failed to start job");
    }
  });

  jobsTableBody.querySelectorAll(".complete-btn").forEach(b => b.onclick = async (e) => {
    const id = e.target.dataset.id;
    try {
      await updateDoc(doc(db, "jobs", id), { status: "completed", completedAt: serverTimestamp() });
      toast("Job marked completed");
    } catch (err) {
      console.error(err);
      toast("Failed to complete job");
    }
  });

  jobsTableBody.querySelectorAll(".delete-btn").forEach(b => b.onclick = async (e) => {
    const id = e.target.dataset.id;
    if (!confirm("Delete this job? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "jobs", id));
      toast("Job deleted");
    } catch (err) {
      console.error(err);
      toast("Failed to delete job");
    }
  });

  jobsTableBody.querySelectorAll(".details-btn").forEach(b => b.onclick = (e) => {
    const id = e.target.dataset.id;
    const ev = new CustomEvent("niapay:openJob", { detail: { id } });
    window.dispatchEvent(ev);
  });
}

/* ------------------------- staff listener & rendering ------------------------- */
function startStaffListener(dateRange = "all") {
  if (unsubStaff) unsubStaff();

  const usersRef = collection(db, "users"); // ensure users collection exists
  const rangeStart = startOfRange(dateRange);

  // simple query for staff
  const q = query(usersRef, where("role", "==", "staff"), orderBy("displayName", "asc"));

  unsubStaff = onSnapshot(q, async (snap) => {
    const staffDocs = [];
    for (const s of snap.docs) staffDocs.push({ id: s.id, ...s.data() });

    const staffWithMetrics = await Promise.all(staffDocs.map(async staff => {
      const jobsRef = collection(db, "jobs");
      const clauses = [where("assignedTo", "==", staff.uid || staff.id)];
      if (rangeStart) clauses.push(where("createdAt", ">=", rangeStart));
      const qJobs = query(jobsRef, ...clauses);
      const jobsSnap = await getDocs(qJobs);
      const jobsArr = [];
      jobsSnap.forEach(d => jobsArr.push({ id: d.id, ...d.data() }));

      const totalCars = jobsArr.length;
      const timeSpent = jobsArr.reduce((acc, j) => acc + (j.timeMinutes || 0), 0);
      return { ...staff, totalCars, timeSpent, jobs: jobsArr };
    }));

    renderStaffGrid(staffWithMetrics);
  }, err => {
    console.error("Staff listener err", err);
    toast("Failed to load staff");
  });
}

function renderStaffGrid(staff = []) {
  if (!staffGridEl) return;
  if (!staff.length) {
    staffGridEl.innerHTML = `<div class="muted">No staff found</div>`;
    return;
  }

  staffGridEl.innerHTML = staff.map(s => `
    <div class="staff-card">
      <div class="top">
        <div class="avatar">${s.displayName ? s.displayName[0].toUpperCase() : "S"}</div>
        <div class="info">
          <div class="name">${s.displayName || s.email || s.id}</div>
          <div class="meta">Cars: ${s.totalCars} • Time: ${s.timeSpent} min</div>
        </div>
      </div>
      <div class="jobs-list">
        ${s.jobs.slice(0,5).map(j => `<div class="job-small">${j.plate || j.id} • ${j.status}</div>`).join("")}
      </div>
    </div>
  `).join("");
}

/* ------------------------- activity listener ------------------------- */
function startActivityListener(dateRange = "all") {
  if (unsubActivity) unsubActivity();

  const actRef = collection(db, "activity"); // ensure you have this collection
  const rangeStart = startOfRange(dateRange);
  const q = rangeStart ? query(actRef, where("createdAt", ">=", rangeStart), orderBy("createdAt", "desc")) : query(actRef, orderBy("createdAt", "desc"));

  unsubActivity = onSnapshot(q, snap => {
    if (!activityLogEl) return;
    if (!snap.size) {
      activityLogEl.innerHTML = `<div class="muted">No activity</div>`;
      return;
    }
    activityLogEl.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `<div class="activity-item">
        <div class="act-time">${formatDate(data.createdAt)}</div>
        <div class="act-text">${data.text || data.action || JSON.stringify(data)}</div>
      </div>`;
    }).join("");
  }, err => {
    console.error("Activity listener err", err);
    toast("Failed to load activity");
  });
}

/* ------------------------- reports (cash) ------------------------- */
async function generateCashReport(dateRange = "all") {
  showLoader();
  try {
    const jobsRef = collection(db, "jobs");
    const rangeStart = startOfRange(dateRange);

    const clauses = [where("status", "==", "completed")];
    if (rangeStart) clauses.push(where("createdAt", ">=", rangeStart));
    const q = query(jobsRef, ...clauses, orderBy("createdAt", "desc"));

    const snap = await getDocs(q);
    const items = [];
    let total = 0;
    snap.forEach(s => {
      const d = s.data();
      items.push({ id: s.id, plate: d.plate, total: d.total || 0, date: d.createdAt || null, assignedTo: d.assignedTo || null });
      total += Number(d.total || 0);
    });

    if (cashReportListEl) {
      cashReportListEl.innerHTML = `
        <div class="report-summary">
          <div>Total completed jobs: ${items.length}</div>
          <div>Total revenue: ${formatCurrency(total)}</div>
        </div>
        <div class="report-items">
          ${items.map(it => `<div class="report-row">${formatDate(it.date)} • ${it.plate || "—"} • ${formatCurrency(it.total)} • ${it.assignedTo || "—"}</div>`).join("")}
        </div>
      `;
    }

    hideLoader();
    return { items, total };
  } catch (err) {
    console.error(err);
    hideLoader();
    toast("Failed to generate cash report");
    return { items: [], total: 0 };
  }
}

/* ------------------------- admin helpers ------------------------- */
async function assignJobTo(jobId, staffId) {
  try {
    await updateDoc(doc(db, "jobs", jobId), { assignedTo: staffId, updatedAt: serverTimestamp() });
    toast("Assigned");
  } catch (err) {
    console.error(err);
    toast("Assign failed");
  }
}

async function deleteJobById(jobId) {
  try {
    await deleteDoc(doc(db, "jobs", jobId));
    toast("Job deleted");
  } catch (err) {
    console.error(err);
    toast("Delete failed");
  }
}

/* ------------------------- wire UI (filters + events) ------------------------- */
function wireUI() {
  if (applyFilterBtn && dateFilterSelect) {
    applyFilterBtn.onclick = () => {
      const range = dateFilterSelect.value || "all";
      startOverviewListener(range);
      startJobsListener({ status: filterStatusSelect ? filterStatusSelect.value : "all", search: searchInput ? searchInput.value : "", dateRange: range });
      startStaffListener(range);
      startActivityListener(range);
      generateCashReport(range);
      toast(`Applied filter: ${range}`);
    };
  }

  if (refreshJobsBtn) refreshJobsBtn.onclick = () => {
    const range = dateFilterSelect ? dateFilterSelect.value : "all";
    startJobsListener({ status: filterStatusSelect ? filterStatusSelect.value : "all", search: searchInput ? searchInput.value : "", dateRange: range });
    toast("Jobs refreshed");
  };

  if (filterStatusSelect) filterStatusSelect.onchange = () => {
    const range = dateFilterSelect ? dateFilterSelect.value : "all";
    startJobsListener({ status: filterStatusSelect.value, search: searchInput ? searchInput.value : "", dateRange: range });
  };

  if (searchInput) {
    let t;
    searchInput.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const range = dateFilterSelect ? dateFilterSelect.value : "all";
        startJobsListener({ status: filterStatusSelect ? filterStatusSelect.value : "all", search: searchInput.value, dateRange: range });
      }, 350);
    };
  }

  // open job modal event from table — fetch doc and dispatch jobLoaded
  window.addEventListener("niapay:openJob", (e) => {
    const { id } = e.detail || {};
    if (!id) return;
    (async () => {
      try {
        const q = query(collection(db, "jobs"), where("__name__", "==", id));
        const snaps = await getDocs(q);
        if (snaps.docs.length) {
          const d = snaps.docs[0].data();
          const jobDoc = { id, ...d };
          window.dispatchEvent(new CustomEvent("niapay:jobLoaded", { detail: jobDoc }));
        } else {
          console.warn("Job not found", id);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  });
}

/* ------------------------- start manager app (auth-aware) ------------------------- */
function startManagerApp() {
  wireUI();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Optionally: verify user role stored in `users` or `accounts` doc before starting
      startOverviewListener("all");
      startJobsListener({ status: "all", search: "", dateRange: "all" });
      startStaffListener("all");
      startActivityListener("all");
      generateCashReport("all");
    } else {
      console.log("Manager not signed in — redirect to sign page or show login");
    }
  });
}

/* ------------------------- exported things ------------------------- */
export {
  startManagerApp,
  startOverviewListener,
  startJobsListener,
  startStaffListener,
  startActivityListener,
  generateCashReport,
  assignJobTo,
  deleteJobById
};

// Do not auto-start here; let manager.js call startManagerApp() when appropriate in your flow.
// But if you want the module to auto-start, uncomment the next line:
// startManagerApp();
