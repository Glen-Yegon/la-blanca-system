// manager-firebase.js
// NOTE: depends on firebase-config.js
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  collectionGroup,
  addDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  getDocs,
  getDoc,
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



let unsubOverview = null;
let unsubJobs = null;
let unsubStaff = null;
let unsubActivity = null;

/* ------------------------- global date range store ------------------------- */
let globalStartTs = null;
let globalEndTs = null;

function setGlobalDateRange(startTs, endTs) {
  console.log("[GLOBAL] Setting global date range:", { startTs, endTs });
  globalStartTs = startTs;
  globalEndTs = endTs;
}

function getGlobalDateRange() {
  console.log("[GLOBAL] Getting global date range:", { start: globalStartTs, end: globalEndTs });
  return { start: globalStartTs, end: globalEndTs };
}

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

const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const applyDateRangeBtn = document.getElementById("applyDateRangeBtn");

/* ------------------------- Date filter apply ------------------------- */
applyDateRangeBtn.addEventListener("click", () => {
  console.log("[DATE-FILTER] APPLY CLICKED");

  const start = startDateInput.value ? new Date(startDateInput.value) : null;
  const end = endDateInput.value ? new Date(endDateInput.value) : null;

  if (!start || !end) {
    toast("Select both start and end dates");
    return;
  }

  end.setHours(23, 59, 59); // include whole end day

  const startTs = Timestamp.fromDate(start);
  const endTs   = Timestamp.fromDate(end);

  setGlobalDateRange(startTs, endTs);

  console.log("[DATE-FILTER] Converted to Firestore Timestamp:", { startTs, endTs });

  // 🔹 Load jobs table
  loadJobsByDateRange(startTs, endTs);

  // 🔹 Update overview with the same range
  startOverviewListener(startTs, endTs);

  toast("Date filter applied");
});





/* ------------------------- Load jobs by date range with logs ------------------------- */
async function loadJobsByDateRange(startTs, endTs) {
  console.log("[JOBS] loadJobsByDateRange STARTED", { startTs, endTs });

  try {
    showLoader();

    let jobsRef = collectionGroup(db, "jobs");
    let q = null;

    if (startTs && endTs) {
      console.log("[JOBS] Query: BETWEEN start & end");
      q = query(jobsRef, where("createdAt", ">=", startTs), where("createdAt", "<=", endTs));

    } else if (startTs && !endTs) {
      console.log("[JOBS] Query: FROM start → infinity");
      q = query(jobsRef, where("createdAt", ">=", startTs));

    } else if (!startTs && endTs) {
      console.log("[JOBS] Query: FROM -infinity → end");
      q = query(jobsRef, where("createdAt", "<=", endTs));

    } else {
      console.log("[JOBS] No date filter applied! Returning...");
      return;
    }

    console.log("[JOBS] Executing Firestore query:", q);

    const snap = await getDocs(q);
    console.log("[JOBS] Firestore returned docs:", snap.docs.length);

    const jobs = snap.docs.map(d => {
      const data = d.data();
      console.log("[JOBS] Job:", { id: d.id, ...data });
      return { id: d.id, ...data };
    });

    console.log("[JOBS] Final jobs array:", jobs);

    renderJobsTable(jobs);
    toast(`Loaded ${jobs.length} job(s) for selected date range.`);

  } catch (e) {
    console.error("[JOBS] Error loading date range:", e);
    toast("Failed to load data.");
  } finally {
    hideLoader();
  }
}

/* ------------------------- time range helpers ------------------------- */
/*
function startOfRange(range) {
  const now = new Date();

  if (range === "week") {
    // Start of the current week (Monday)
    const day = now.getDay(); // Sunday = 0
    const diff = (day === 0 ? 6 : day - 1); // Monday = 0
    const start = new Date(now);
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "month") {
    // Start of current month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  // Default: return null (no filtering)
  return null;
}
*/



/* ------------------------- overview listener (with collection group) ------------------------- */
async function startOverviewListener(dateRangeOrStart = "all", endTs = null) {
  console.log("Starting overview listener with:", { dateRangeOrStart, endTs });


  if (unsubOverview) {
    console.log("Unsubscribing previous overview listener");
    unsubOverview();
  }

  showLoader();

let rangeStart = null;

if (typeof dateRangeOrStart === "string") {
  rangeStart = startOfRange(dateRangeOrStart); // old behavior
} else if (dateRangeOrStart && dateRangeOrStart.toDate) {
  rangeStart = dateRangeOrStart; // Firestore Timestamp from calendar
}

console.log("Computed rangeStart:", rangeStart, "endTs:", endTs);

  try {
    // Collection group query: fetch all jobs, including corporate jobs
    const jobsRef = collectionGroup(db, "jobs");

const clauses = [];
if (rangeStart) clauses.push(where("createdAt", ">=", rangeStart));
if (endTs) clauses.push(where("createdAt", "<=", endTs));


    const qAllJobs = clauses.length
      ? query(jobsRef, ...clauses, orderBy("createdAt", "desc"))
      : query(jobsRef, orderBy("createdAt", "desc"));

    const jobsSnap = await getDocs(qAllJobs);
    console.log("Total jobs found (collection group):", jobsSnap.size);

    let pending = 0, inprogress = 0, completed = 0, revenue = 0;
    const quick = [];

    jobsSnap.forEach(jobSnap => {
      const j = jobSnap.data();

      // Determine if it's a corporate job from path: "corporates/{company}/jobs/{jobId}" or main "jobs/{jobId}"
      const pathParts = jobSnap.ref.path.split("/");
      const company = pathParts[0] === "corporates" ? pathParts[1] : null;

      // Count metrics
      const st = j.status;
      if (st === "pending") pending++;
      else if (st === "in_progress") inprogress++;
      else if (st === "completed") { completed++; revenue += Number(j.total || 0); }

      quick.push({
        id: jobSnap.id,
        plate: j.plate || "—",
        status: st || "pending",
        total: j.total || 0,
        createdAt: j.createdAt || null,
        assignedTo: j.assignedTo || null,
        company
      });
    });

    // Update overview metrics
    if (pendingCountEl) pendingCountEl.textContent = pending;
    if (inProgressCountEl) inProgressCountEl.textContent = inprogress;
    if (completedCountEl) completedCountEl.textContent = completed;
    if (revenueSumEl) revenueSumEl.textContent = formatCurrency(revenue);

    if (activeStaffEl) {
      const assignedSet = new Set(quick.filter(j => j.assignedTo).map(j => j.assignedTo));
      activeStaffEl.textContent = assignedSet.size || "0";
    }

    // Render latest 8 quick jobs
    if (quickJobsListEl) {
      quickJobsListEl.innerHTML = quick
        .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis())
        .slice(0, 8)
        .map(j => `
          <div class="quick-card">
            <div class="quick-header">
              <span class="quick-plate">${j.plate || "—"}</span>
              <span class="quick-status ${j.status}">${(j.status || "—").replace("_"," ")}</span>
            </div>
            <div class="quick-body">
              <div class="quick-total">${formatCurrency(j.total)}</div>
              <div class="quick-time">${j.createdAt ? formatDate(j.createdAt) : ""}</div>
              <div class="quick-company">${j.company || "Main"}</div>
            </div>
          </div>
        `).join("");
    }

  } catch (err) {
    console.error("Overview listener error:", err);
    toast("Failed to load overview (permissions?)");
  } finally {
    hideLoader();
    console.log("Overview listener update complete.");
  }
}




/* ------------------------- jobs listener & render ------------------------- */
async function startJobsListener({ status = "all", search = "", dateRange = "all" } = {}) {
  if (unsubJobs) unsubJobs();
  showLoader();

  const rangeStart = startOfRange(dateRange);

  try {
    // Collection group query: all "jobs" subcollections (includes corporate jobs)
    const jobsGroupRef = collectionGroup(db, "jobs");
    const clauses = [];
    if (status && status !== "all") clauses.push(where("status", "==", status));
    if (rangeStart) clauses.push(where("createdAt", ">=", rangeStart));

    const qJobs = clauses.length
      ? query(jobsGroupRef, ...clauses, orderBy("createdAt", "desc"))
      : query(jobsGroupRef, orderBy("createdAt", "desc"));

    const jobsSnap = await getDocs(qJobs);
    console.log("Jobs found (collection group):", jobsSnap.size);

    const rows = jobsSnap.docs.map(jobSnap => {
      const pathParts = jobSnap.ref.path.split("/");
      // If job is under "corporates/{company}/jobs", extract company
      const company = pathParts[0] === "corporates" ? pathParts[1] : null;
      return { id: jobSnap.id, company, ...jobSnap.data() };
    });

    // Filter by search term
    const filtered = rows.filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.plate && r.plate.toLowerCase().includes(q)) ||
             (r.id && r.id.toLowerCase().includes(q)) ||
             (r.company && r.company.toLowerCase().includes(q));
    });

    renderJobsTable(filtered);
  } catch (err) {
    console.error("Jobs listener error:", err);
    toast("Failed to load jobs (permissions?)");
  } finally {
    hideLoader();
  }
}

function renderJobsTable(rows = []) {
  if (!jobsTableBody) return;
  if (!rows.length) {
    jobsTableBody.innerHTML = `<tr><td colspan="8" class="muted">No jobs found</td></tr>`;
    return;
  }

  jobsTableBody.innerHTML = rows.map(r => {
    const assigned = r.assignedTo || "—";
    const statusLabel = r.status ? r.status.replace("_", " ") : "—";
    const total = formatCurrency(r.total || 0);
    const created = r.createdAt ? formatDate(r.createdAt) : "—";
    const company = r.company || null;

    return `
      <tr data-id="${r.id}" data-company="${company || ""}">
        <td>${r.id}</td>
        <td>${r.plate || "—"}</td>
        <td>${r.model || "—"}</td>
        <td>${assigned}</td>
        <td>${statusLabel}</td>
        <td>${total}</td>
        <td>${company || "Main"}</td>
        <td>
          ${r.status === "pending" ? `<button class="btn small start-btn" data-id="${r.id}" data-company="${company || ""}">Start</button>` : ""}
          ${r.status === "in_progress" ? `<button class="btn small complete-btn" data-id="${r.id}" data-company="${company || ""}">Complete</button>` : ""}
          <button class="btn small details-btn" data-id="${r.id}" data-company="${company || ""}">Details</button>
          <button class="btn small danger delete-btn" data-id="${r.id}" data-company="${company || ""}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  // Helper to get correct doc reference
  const getJobRef = (id, company) => {
    return company
      ? doc(db, "corporates", company, "jobs", id) // corporate job
      : doc(db, "jobs", id);                     // main job
  };

  // Wire actions
  jobsTableBody.querySelectorAll(".start-btn").forEach(b => b.onclick = async e => {
    const id = e.target.dataset.id;
    const company = e.target.dataset.company || null;
    try {
      await updateDoc(getJobRef(id, company), { status: "in_progress", startedAt: serverTimestamp() });
      toast("Job started");
    } catch (err) { console.error(err); toast("Failed to start job"); }
  });

  jobsTableBody.querySelectorAll(".complete-btn").forEach(b => b.onclick = async e => {
    const id = e.target.dataset.id;
    const company = e.target.dataset.company || null;
    try {
      await updateDoc(getJobRef(id, company), { status: "completed", completedAt: serverTimestamp() });
      toast("Job marked completed");
    } catch (err) { console.error(err); toast("Failed to complete job"); }
  });

  jobsTableBody.querySelectorAll(".delete-btn").forEach(b => b.onclick = async e => {
    const id = e.target.dataset.id;
    const company = e.target.dataset.company || null;
    if (!confirm("Delete this job? This cannot be undone.")) return;
    try {
      await deleteDoc(getJobRef(id, company));
      toast("Job deleted");
    } catch (err) { console.error(err); toast("Failed to delete job"); }
  });

  jobsTableBody.querySelectorAll(".details-btn").forEach(b => b.onclick = e => {
    const id = e.target.dataset.id;
    const company = e.target.dataset.company || null;
    openJobModal(id, company); // Pass company if modal needs to fetch corporate job
  });
}



async function openJobModal(jobId) {
  const modal = document.getElementById("jobModal");
  const modalBody = document.getElementById("modalBody");

  modal.classList.remove("hidden");
  modalBody.innerHTML = "Loading...";

  try {
    const snap = await getDoc(doc(db, "jobs", jobId));
    if (!snap.exists()) {
      modalBody.innerHTML = "Job not found.";
      return;
    }

    const d = snap.data();

    modalBody.innerHTML = `
      <div class="modal-row"><strong>Plate:</strong> ${d.plate}</div>
      <div class="modal-row"><strong>Model:</strong> ${d.model}</div>
      <div class="modal-row"><strong>Status:</strong> ${d.status.replace("_", " ")}</div>
      <div class="modal-row"><strong>Total:</strong> ${formatCurrency(d.total)}</div>
      <div class="modal-row"><strong>Assigned To:</strong> ${d.assignedTo || "—"}</div>
      <div class="modal-row"><strong>Created:</strong> ${d.createdAt ? formatDate(d.createdAt) : "—"}</div>
    `;
  } catch (err) {
    modalBody.innerHTML = "Error loading job details.";
    console.error(err);
  }
}

document.getElementById("closeJobModal").onclick = () =>
  document.getElementById("jobModal").classList.add("hidden");

window.onclick = function (e) {
  const modal = document.getElementById("jobModal");
  if (e.target === modal) modal.classList.add("hidden");
};



// Load global commission rate
async function getCommissionRate() {
  try {
    const snap = await getDoc(doc(db, "commissions", "settings"));
    if (snap.exists()) {
      return Number(snap.data().rate) / 100; // convert 10 → 0.10
    }
  } catch (err) {
    console.error("Failed to load commission:", err);
  }
  return 0.10; // fallback default 10%
}



function startOfRange(range) {
  const now = new Date();

  if (range === "week") {
    // Start of the current week (Monday)
    const day = now.getDay(); // Sunday = 0
    const diff = (day === 0 ? 6 : day - 1); // Monday = 0
    const start = new Date(now);
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "month") {
    // Start of current month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (range === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  // Default: return null (no filtering)
  return null;
}



/* ------------------------- simplified staff listener & rendering (with collection group) ------------------------- */
async function startStaffListener(dateRange = "month") {
  if (typeof unsubStaff === "function") unsubStaff();

  console.log("Starting staff listener for range:", dateRange);

  const rangeStart = startOfRange(dateRange);
  console.log("Range start timestamp:", rangeStart?.toDate());

  try {
    // 🔹 Load commission tiers from Firestore
    const commissionSnap = await getDoc(doc(db, "commissions", "settings"));
    let tiers = [];
    if (commissionSnap.exists()) {
      tiers = commissionSnap.data().tiers || [];
      console.log("Loaded commission tiers:", tiers);
    } else {
      console.warn("No commission tiers found. Defaulting to 0%");
    }

    // 🔹 Only proceed if user is manager
    const userSnap = await getDoc(doc(db, "accounts", auth.currentUser.uid));
    const userRole = userSnap.data()?.role;
    if (userRole !== "manager") {
      console.warn("Current user is not a manager. Aborting staff listener.");
      return;
    }

    // 🔹 Collection group query for all completed jobs (main + corporate)
    const jobsRef = collectionGroup(db, "jobs");
    const clauses = [where("status", "==", "completed")];
    if (rangeStart) clauses.push(where("createdAt", ">=", rangeStart));

    const qJobs = query(jobsRef, ...clauses, orderBy("createdAt"), orderBy("assignedTo"));
    const jobsSnap = await getDocs(qJobs);
    console.log("Completed jobs snapshot received:", jobsSnap.size, "docs");

    if (!jobsSnap.size) {
      console.warn("No completed jobs found.");
      staffGridEl.innerHTML = `<div class="muted">No staff jobs found</div>`;
      return;
    }

    // Aggregate jobs by staff
    const staffMap = {};
    jobsSnap.forEach(docSnap => {
      const job = docSnap.data();
      const staffName = job.assignedTo || "Unassigned";

      if (!staffMap[staffName]) staffMap[staffName] = { totalRevenue: 0, totalCars: 0 };
      staffMap[staffName].totalRevenue += Number(job.total || 0);
      staffMap[staffName].totalCars += 1;
    });

    // Function to determine commission rate based on tiers
    const getCommissionRate = (revenue) => {
      if (!tiers.length) return 0; // fallback if no tiers
      const tier = tiers.find(t => revenue >= t.min && revenue <= t.max);
      return tier ? tier.rate : 0;
    };

    // Build simplified staff array using tiered commission
    const staffWithMetrics = Object.keys(staffMap).map(name => {
      const totalRevenue = staffMap[name].totalRevenue;
      const totalCars = staffMap[name].totalCars;
      const commissionRate = getCommissionRate(totalRevenue);
      const commission = totalRevenue * commissionRate;

      console.log(`Staff: ${name}, Revenue: ${totalRevenue}, Rate: ${commissionRate}, Commission: ${commission}`);
      return { displayName: name, totalRevenue, totalCars, commission };
    });

    console.log("Staff metrics with tiered commission:", staffWithMetrics);

    renderStaffGrid(staffWithMetrics);

  } catch (err) {
    console.error("Staff listener error:", err);
    toast("Failed to load staff");
  }
}



function renderStaffGrid(staff = []) {
  if (!staffGridEl) return;

  if (!staff.length) {
    staffGridEl.innerHTML = `<div class="muted">No staff found</div>`;
    return;
  }

  console.log("Rendering staff grid with", staff.length, "staff members");

  // Column headers
  const headers = `
    <div class="staff-row staff-header">
      <div class="col name">Name</div>
      <div class="col jobs">Jobs Done</div>
      <div class="col revenue">Revenue</div>
      <div class="col commission">Commission</div>
    </div>
  `;

  // Staff rows
  const rows = staff.map(s => `
    <div class="staff-row">
      <div class="col name">${s.displayName}</div>
      <div class="col jobs">${s.totalCars}</div>
      <div class="col revenue">${formatCurrency(s.totalRevenue)}</div>
      <div class="col commission">${formatCurrency(s.commission)}</div>
    </div>
  `).join("");

  staffGridEl.innerHTML = headers + rows;
}

// Start the listener
startStaffListener();




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
    const rangeStart = startOfRange(dateRange);

    // Use collection group to fetch all "jobs" subcollections, including corporate jobs
    const jobsRef = collectionGroup(db, "jobs");

    const clauses = [where("status", "==", "completed")];
    if (rangeStart) clauses.push(where("createdAt", ">=", rangeStart));

    const q = query(jobsRef, ...clauses, orderBy("createdAt", "desc"));

    const snap = await getDocs(q);
    const items = [];
    let total = 0;

    snap.forEach(s => {
      const d = s.data();

      // Determine company if corporate job
      const pathParts = s.ref.path.split("/"); // e.g., corporates/{company}/jobs/{jobId}
      const company = pathParts[1] && pathParts[0] === "corporates" ? pathParts[1] : null;

      items.push({
        id: s.id,
        plate: d.plate,
        total: d.total || 0,
        date: d.createdAt || null,
        assignedTo: d.assignedTo || null,
        company
      });

      total += Number(d.total || 0);
    });

    if (cashReportListEl) {
      cashReportListEl.innerHTML = `
        <div class="report-summary">
          <div>Total completed jobs: ${items.length}</div>
          <div>Total revenue: ${formatCurrency(total)}</div>
        </div>
        <div class="report-items">
          ${items.map(it => `
            <div class="report-row">
              ${formatDate(it.date)} • ${it.plate || "—"} • ${formatCurrency(it.total)} • ${it.assignedTo || "—"} ${it.company ? `• ${it.company}` : ""}
            </div>`).join("")}
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


// Firestore references
const staffRef = collection(db, "staff");
const servicesRef = collection(db, "services");
const companiesRef = collection(db, "companies");

// ---------- STAFF ----------
const staffListEl = document.getElementById("staffList");
document.getElementById("addStaffBtn").onclick = async () => {
  const first = document.getElementById("staffFirstName").value.trim();
  const last = document.getElementById("staffLastName").value.trim();
  if (!first || !last) return toast("Enter first and last name");
  
  try {
    await addDoc(staffRef, { firstName: first, lastName: last, createdAt: serverTimestamp() });
    document.getElementById("staffFirstName").value = "";
    document.getElementById("staffLastName").value = "";
    toast("Staff added");
  } catch (err) {
    console.error(err); toast("Failed to add staff");
  }
};

// ---------- SERVICES ----------
const servicesListEl = document.getElementById("servicesList");
document.getElementById("addServiceBtn").onclick = async () => {
  const name = document.getElementById("serviceName").value.trim();
  const price = parseFloat(document.getElementById("servicePrice").value);
  if (!name || isNaN(price)) return toast("Enter valid service name and price");
  
  try {
    await addDoc(servicesRef, { name, price, createdAt: serverTimestamp() });
    document.getElementById("serviceName").value = "";
    document.getElementById("servicePrice").value = "";
    toast("Service added");
  } catch (err) {
    console.error(err); toast("Failed to add service");
  }
};

// ---------- COMPANIES ----------
const companiesListEl = document.getElementById("companiesList");
document.getElementById("addCompanyBtn").onclick = async () => {
  const name = document.getElementById("companyName").value.trim();
  if (!name) return toast("Enter company name");

  try {
    await addDoc(companiesRef, { name, createdAt: serverTimestamp() });
    document.getElementById("companyName").value = "";
    toast("Company added");
  } catch (err) {
    console.error(err); toast("Failed to add company");
  }
};
// ---------- COMMISSION SETTINGS ----------
const commissionDocRef = doc(db, "commissions", "settings");
const commissionStatusEl = document.getElementById("commissionStatus");
const saveCommissionBtn = document.getElementById("saveCommissionBtn");

// Function to format and display tiers
function displayTiers(tiers, title = "Commission Tiers") {
  console.log("displayTiers called with tiers:", tiers, "title:", title);

  if (!tiers || !tiers.length) {
    console.log("No tiers provided or tiers empty");
    commissionStatusEl.textContent = "No commission tiers set yet.";
    return;
  }

  const formatted = tiers.map(t => {
    if (t.max === Number.MAX_SAFE_INTEGER) return `${t.min.toLocaleString()}+ → ${t.rate * 100}%`;
    return `${t.min.toLocaleString()}–${t.max.toLocaleString()} → ${t.rate * 100}%`;
  }).join("<br>");

  commissionStatusEl.innerHTML = `<strong>${title}:</strong><br>` + formatted;
  console.log("Updated commissionStatusEl with formatted tiers");
}

// Load existing commission on page startup
async function loadCommission() {
  console.log("Loading commission from Firestore...");
  try {
    const snap = await getDoc(commissionDocRef);
    console.log("Firestore snapshot received:", snap);

    if (snap.exists()) {
      const data = snap.data();
      console.log("Commission document exists. Data:", data);

      displayTiers(data.tiers, "Commission Tiers Loaded");
    } else {
      console.warn("Commission document does not exist");
      displayTiers(null);
    }
  } catch (err) {
    console.error("Failed to load commission:", err);
    toast("Failed to load commission");
  }
}

loadCommission();

// Save or update commission
saveCommissionBtn.onclick = async () => {
  console.log("Save commission button clicked");

  try {
    const tiers = [
      { min: 0, max: 24999, rate: 0.2 },
      { min: 25000, max: 29999, rate: 0.25 },
      { min: 30000, max: Number.MAX_SAFE_INTEGER, rate: 0.3 }
    ];

    console.log("Saving tiers to Firestore:", tiers);

    await setDoc(commissionDocRef, {
      tiers,
      updatedAt: serverTimestamp()
    });

    console.log("Tiers saved successfully to Firestore");

    displayTiers(tiers, "Commission Tiers Saved");
    toast("Commission tiers saved successfully");
  } catch (err) {
    console.error("Failed to save commission:", err);
    toast("Failed to save commission");
  }
};


// ---------- REALTIME LISTENERS ----------
function renderAdminList(snap, listEl, type) {
  if (!snap.size) {
    listEl.innerHTML = `<li class="muted">No ${type} found</li>`;
    return;
  }

  listEl.innerHTML = snap.docs.map(docSnap => {
    const data = docSnap.data();
    const displayName = type === "staff" ? `${data.firstName} ${data.lastName}` :
                        type === "services" ? `${data.name} - Ksh ${data.price}` :
                        data.name;
    return `
      <li data-id="${docSnap.id}">
        <span>${displayName}</span>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </li>
    `;
  }).join("");

  // Attach edit/delete events
  listEl.querySelectorAll(".edit-btn").forEach(btn => {
    btn.onclick = async e => {
      const id = e.target.parentElement.dataset.id;
      const docRef = doc(db, type === "staff" ? "staff" : type === "services" ? "services" : "companies", id);
      const current = snap.docs.find(d => d.id === id).data();

      if (type === "staff") {
        const newFirst = prompt("First Name:", current.firstName);
        const newLast = prompt("Last Name:", current.lastName);
        if (!newFirst || !newLast) return;
        await updateDoc(docRef, { firstName: newFirst, lastName: newLast });
      } else if (type === "services") {
        const newName = prompt("Service Name:", current.name);
        const newPrice = parseFloat(prompt("Price (Ksh):", current.price));
        if (!newName || isNaN(newPrice)) return;
        await updateDoc(docRef, { name: newName, price: newPrice });
      } else {
        const newName = prompt("Company Name:", current.name);
        if (!newName) return;
        await updateDoc(docRef, { name: newName });
      }
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} updated`);
    };
  });

  listEl.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = async e => {
      if (!confirm("Are you sure?")) return;
      const id = e.target.parentElement.dataset.id;
      const docRef = doc(db, type === "staff" ? "staff" : type === "services" ? "services" : "companies", id);
      await deleteDoc(docRef);
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`);
    };
  });
}

// Staff realtime listener
onSnapshot(staffRef, snap => renderAdminList(snap, staffListEl, "staff"));
// Services realtime listener
onSnapshot(servicesRef, snap => renderAdminList(snap, servicesListEl, "services"));
// Companies realtime listener
onSnapshot(companiesRef, snap => renderAdminList(snap, companiesListEl, "companies"));


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
/* ------------------------- wire UI (filters + events) ------------------------- */
function wireUI() {

  // Status filter
  if (filterStatusSelect) {
    filterStatusSelect.onchange = () => {
      console.log("[FILTER] Status changed:", filterStatusSelect.value);
      console.log("[FILTER] Using global range:", { globalStartTs, globalEndTs });

      startJobsListener({
        status: filterStatusSelect.value,
        search: searchInput ? searchInput.value : "",
        start: globalStartTs,
        end: globalEndTs
      });
    };
  }

  // Search filter
  if (searchInput) {
    let t;
    searchInput.oninput = () => {
      clearTimeout(t);

      t = setTimeout(() => {
        console.log("[FILTER] Search:", searchInput.value);
        console.log("[FILTER] Using global range:", { globalStartTs, globalEndTs });

        startJobsListener({
          status: filterStatusSelect ? filterStatusSelect.value : "all",
          search: searchInput.value,
          start: globalStartTs,
          end: globalEndTs
        });

      }, 350);
    };
  }

  // Refresh jobs
  if (refreshJobsBtn) {
    refreshJobsBtn.onclick = () => {
      console.log("[FILTER] Refresh clicked");
      console.log("[FILTER] Using global range:", { globalStartTs, globalEndTs });

      startJobsListener({
        status: filterStatusSelect ? filterStatusSelect.value : "all",
        search: searchInput ? searchInput.value : "",
        start: globalStartTs,
        end: globalEndTs
      });

      toast("Jobs refreshed");
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
