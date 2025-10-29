import { saveJob, loadPendingJobs } from "./customer-firebase.js";


// On page load, get pending jobs from Firestore
window.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loader"); // 🔹 get loader element

  try {
    // 🔹 show loader
    loader.classList.remove("hidden");

    const jobs = await loadPendingJobs();

    // 🔹 sort jobs by creation time (newest first)
    jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 🔹 display each job
    jobs.forEach((job) => {
      activeJobs[job.id] = job;
      addJobCard(job);
    });

    console.log(`✅ Loaded ${jobs.length} pending jobs from Firestore`);
  } catch (error) {
    console.error("❌ Error loading jobs:", error);
  } finally {
    // 🔹 hide loader when done
    loader.classList.add("hidden");
  }
});





const addBtn = document.getElementById('addBtn');
const addFormSection = document.getElementById('addForm');
const customerForm = document.getElementById('customerForm');
const cancelBtn = document.getElementById('cancelBtn');
const services = Array.from(document.querySelectorAll('.service'));
const totalEl = document.getElementById('total');
const cardsContainer = document.getElementById('cardsContainer');

const modal = document.getElementById('receiptModal');
const closeReceipt = document.getElementById('closeReceipt');
const r_plate = document.getElementById('r_plate');
const r_model = document.getElementById('r_model');
const r_color = document.getElementById('r_color');
const r_phone = document.getElementById('r_phone');
const r_services = document.getElementById('r_services');
const r_payment = document.getElementById('r_payment');
const r_total = document.getElementById('r_total');
const markFinishedBtn = document.getElementById('markFinished');

let activeJobs = {}; // store jobs in-memory: { jobId: {...} }

// Toggle open/close form
addBtn.addEventListener('click', () => {
  const expanded = addBtn.getAttribute('aria-expanded') === 'true';
  addBtn.setAttribute('aria-expanded', String(!expanded));
  addFormSection.setAttribute('aria-hidden', String(expanded));
  if (!expanded) {
    // focus first input
    setTimeout(() => document.getElementById('plate').focus(), 120);
  }
});

// Cancel form
cancelBtn.addEventListener('click', () => {
  resetForm();
  closeForm();
});

function closeForm(){
  addBtn.setAttribute('aria-expanded', 'false');
  addFormSection.setAttribute('aria-hidden', 'true');
}

function resetForm(){
  customerForm.reset();
  services.forEach(s => {
    s.setAttribute('aria-pressed','false');
    s.classList.remove('active');
  });
  updateTotal();
}

// Service toggles
services.forEach(s => {
  s.addEventListener('click', () => {
    const pressed = s.getAttribute('aria-pressed') === 'true';
    s.setAttribute('aria-pressed', String(!pressed));
    s.classList.toggle('active', !pressed);
    updateTotal();
  });

  // keyboard accessibility
  s.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      s.click();
    }
  });
});

// compute total from selected services
function updateTotal(){
  const selected = services.filter(s => s.getAttribute('aria-pressed') === 'true');
  const total = selected.reduce((sum, s) => sum + Number(s.dataset.price || 0), 0);
  totalEl.textContent = `Kshs ${total}`;
  return total;
}

// form submit -> create job card
// form submit -> create job card
customerForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const plate = document.getElementById("plate").value.trim();
  const model = document.getElementById("model").value.trim();
  const color = document.getElementById("color").value.trim();
  const phone = document.getElementById("phone").value.trim() || "—";
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const selectedServices = services
    .filter((s) => s.getAttribute("aria-pressed") === "true")
    .map((s) => ({
      name: s.querySelector(".service-name").textContent,
      price: Number(s.dataset.price),
    }));
  const total = updateTotal();

  if (!plate || !model || !color) {
    alert("Please fill the required fields: number plate, model and color.");
    return;
  }

  // create a job object
  const jobId = `job_${Date.now()}`;
const assignTo = document.getElementById("assignTo").value.trim();

const job = {
  id: jobId,
  plate,
  model,
  color,
  phone,
  payment,
  services: selectedServices,
  total,
  createdAt: new Date().toISOString(),
};

// ✅ If a staff is assigned, mark as In Progress immediately
if (assignTo) {
  job.status = "In Progress";
  job.assignedTo = assignTo;
  job.startedAt = new Date().toISOString();
} else {
  job.status = "Pending";
}


  try {
    // ✅ Save to Firestore
    const savedId = await saveJob(job);

    // ✅ Store the job ID locally
localStorage.setItem("lastJobId", jobId);

    if (savedId) {
      console.log("✅ Job saved successfully:", savedId);
      job.firestoreId = savedId; // keep Firestore ID reference
      activeJobs[jobId] = job;
      addJobCard(job);
    }
  } catch (error) {
    console.error("❌ Failed to save job:", error);
  }

  // UI: reset and close
  resetForm();
  closeForm();
});



// add visual job card
function addJobCard(job){
  const card = document.createElement('button');
  card.className = 'card';
  card.type = 'button';
  card.dataset.jobId = job.id;

  card.innerHTML = `
    <div class="left">
      <div class="plate">${job.plate}</div>
      <div class="meta">${job.services.length} service(s) • ${job.model} • ${job.color}</div>
    </div>
    <div class="right">
      <div class="tag">${job.status}</div>
    </div>
  `;

  // open receipt when clicked
  card.addEventListener('click', () => openReceipt(job.id));

  cardsContainer.prepend(card);
}

// open receipt modal and populate values
function openReceipt(jobId){
  const job = activeJobs[jobId];
  if (!job) return;

  r_plate.textContent = job.plate;
  r_model.textContent = job.model;
  r_color.textContent = job.color;
  r_phone.textContent = job.phone;
  r_payment.textContent = job.payment === 'mpesa' ? 'M-Pesa' : 'Cash';
  r_total.textContent = `Kshs ${job.total}`;

  // services list
  r_services.innerHTML = '';
  if (job.services.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No services selected';
    r_services.appendChild(li);
  } else {
    job.services.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name} — Kshs ${s.price}`;
      r_services.appendChild(li);
    });
  }

  // store which job is active on modal
  modal.dataset.jobId = jobId;
  modal.setAttribute('aria-hidden','false');
  modal.style.display = 'flex';
  // focus close button for accessibility
  setTimeout(() => closeReceipt.focus(), 80);
}

// close modal
function closeModal(){
  modal.setAttribute('aria-hidden','true');
  modal.style.display = 'none';
  delete modal.dataset.jobId;
}

closeReceipt.addEventListener('click', closeModal);
modal.addEventListener('click', (ev) => {
  if (ev.target === modal) closeModal();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
});

// mark finished button (updates job status and card tag)
markFinishedBtn.addEventListener('click', () => {
  const jobId = modal.dataset.jobId;
  if (!jobId) return;
  const job = activeJobs[jobId];
  if (!job) return;

  job.status = 'Finished';
  job.finishedAt = new Date().toISOString();

  // Update card tag
  const card = document.querySelector(`.card[data-job-id="${jobId}"]`);
  if (card) {
    const tag = card.querySelector('.tag');
    if (tag) {
      tag.textContent = 'Finished';
      tag.style.background = 'transparent';
      tag.style.color = 'rgba(255,255,255,0.85)';
      tag.style.border = '1px solid rgba(255,255,255,0.06)';
    }
  }

  // Optionally persist to backend / Firestore here

  closeModal();
});


const assignSelect = document.getElementById("assignTo");

function loadStaffList() {
  // Listen to users in real time
  onSnapshot(collection(db, "users"), (staffSnapshot) => {
    // Listen to customers in real time to get job counts
    onSnapshot(collection(db, "customer"), (customerSnapshot) => {
      const jobCounts = {};

      // Count jobs assigned per staff
      customerSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.assignedTo && (data.status === "Pending" || data.status === "In Progress")) {
          const name = data.assignedTo.trim();
          jobCounts[name] = (jobCounts[name] || 0) + 1;
        }
      });

      // Clear and rebuild the dropdown
      assignSelect.innerHTML = `<option value="">-- Select Staff (optional) --</option>`;

      staffSnapshot.forEach((staffDoc) => {
        const staffData = staffDoc.data();
        const staffName = staffData.name || "Unnamed Staff";
        const count = jobCounts[staffName] || 0;

        const option = document.createElement("option");
        option.value = staffName;
        option.textContent = `${staffName} (${count})`;
        assignSelect.appendChild(option);
      });
    });
  });
}

// Call this when your page loads
loadStaffList();
