// manager.js
import {
  startManagerApp,
  startOverviewListener,
  startJobsListener,
  startStaffListener,
  startActivityListener
} from "./manager-firebase.js";

// Sidebar Navigation
const navButtons = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".panel");
const pageTitle = document.getElementById("pageTitle");

// Filters
const dateFilter = document.getElementById("dateFilter");
const applyFilterBtn = document.getElementById("applyFilterBtn");

// Jobs filters
const filterStatus = document.getElementById("filterStatus");
const searchInput = document.getElementById("searchInput");
const refreshJobsBtn = document.getElementById("refreshJobs");

// store current
let currentDateRange = "all";
let currentJobStatus = "all";
let currentSearch = "";

// show panel by id
function showPanel(area) {
  panels.forEach(p => p.classList.remove("active"));
  const panel = document.getElementById(area);
  if (panel) panel.classList.add("active");

  navButtons.forEach(b => b.classList.remove("active"));
  const activeBtn = document.querySelector(`.nav-btn[data-area="${area}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  pageTitle.textContent = activeBtn ? activeBtn.textContent : area;

  if (area === "overview") startOverviewListener(currentDateRange);
  if (area === "jobs") startJobsListener({ status: currentJobStatus, search: currentSearch, dateRange: currentDateRange });
  if (area === "staff") startStaffListener(currentDateRange);
  if (area === "activity") startActivityListener(currentDateRange);
}

// nav buttons
navButtons.forEach(btn => {
  btn.addEventListener("click", () => showPanel(btn.dataset.area));
});

// apply date filter
applyFilterBtn?.addEventListener("click", () => {
  currentDateRange = dateFilter.value || "all";
  const activePanel = document.querySelector(".panel.active")?.id || "overview";
  showPanel(activePanel);
});

// job status filter
filterStatus?.addEventListener("change", () => {
  currentJobStatus = filterStatus.value;
  startJobsListener({ status: currentJobStatus, search: currentSearch, dateRange: currentDateRange });
});

// search input
searchInput?.addEventListener("input", () => {
  currentSearch = searchInput.value.trim().toLowerCase();
  startJobsListener({ status: currentJobStatus, search: currentSearch, dateRange: currentDateRange });
});

// refresh
refreshJobsBtn?.addEventListener("click", () => {
  startJobsListener({ status: currentJobStatus, search: currentSearch, dateRange: currentDateRange });
});

// Kick off auth-aware app (this will start listeners when auth ready)
startManagerApp();

// show overview initially
showPanel("overview");
