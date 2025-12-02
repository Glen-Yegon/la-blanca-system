// staff-app.js
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  addDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  collectionGroup,
  updateDoc,
  deleteDoc
} from "./firebase-config.js";


/* -------------------------
   UI ELEMENTS
   -------------------------*/
const addBtn = document.getElementById("addBtn");
const addForm = document.getElementById("addForm");
const customerForm = document.getElementById("customerForm");
const cancelBtn = document.getElementById("cancelBtn");
const services = document.querySelectorAll(".service");
const totalEl = document.getElementById("total");
const cardsContainer = document.getElementById("cardsContainer");
const loader = document.getElementById("loader");

const receiptModal = document.getElementById("receiptModal");
const closeReceipt = document.getElementById("closeReceipt");
const closeReceiptBtn = document.getElementById("closeReceiptBtn");

const r_jobid = document.getElementById("r_jobid");
const r_plate = document.getElementById("r_plate");
const r_model = document.getElementById("r_model");
const r_color = document.getElementById("r_color");
const r_phone = document.getElementById("r_phone");
const r_services = document.getElementById("r_services");
const r_assigned = document.getElementById("r_assigned");
const r_total = document.getElementById("r_total");

const takeJobBtn = document.getElementById("takeJobBtn");
const confirmAssignBtn = document.getElementById("confirmAssignBtn");
const takeStaffSelect = document.getElementById("takeStaffSelect");

const signinModal = document.getElementById("signinModal");
const signinForm = document.getElementById("signinForm");
const signInEmail = document.getElementById("signInEmail");
const signInPassword = document.getElementById("signInPassword");
const managerEmail = document.getElementById("managerEmail");
const signOutBtn = document.getElementById("signOutBtn");
const companyInput = document.getElementById("company");

/* -------------------------
   STATE
   -------------------------*/
let selectedServices = new Set();
let currentJobId = null;

/* -------------------------
   UI LOGIC
   -------------------------*/
addBtn.addEventListener("click", () => {
  const expanded = addBtn.getAttribute("aria-expanded") === "true";
  addBtn.setAttribute("aria-expanded", !expanded);
  addForm.setAttribute("aria-hidden", expanded);
});

cancelBtn.addEventListener("click", () => {
  selectedServices.clear();
  customerForm.reset();
  services.forEach(s => s.setAttribute("aria-pressed", "false"));
  updateTotal();
  addBtn.setAttribute("aria-expanded", false);
  addForm.setAttribute("aria-hidden", true);
});

services.forEach(btn => {
  btn.addEventListener("click", () => {
    const pressed = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", !pressed);

    const price = Number(btn.dataset.price);
    const name = btn.querySelector(".service-name").textContent.trim();
    const key = JSON.stringify({ name, price });

    if (!pressed) selectedServices.add(key);
    else selectedServices.delete(key);

    updateTotal();
  });
});

function updateTotal() {
  let total = 0;
  selectedServices.forEach(s => total += JSON.parse(s).price);
  totalEl.textContent = `Kshs ${total}`;
}

/* -------------------------
   CREATE JOB
   -------------------------*/
const plateInput = document.getElementById("plate");
const modelInput = document.getElementById("model");
const colorInput = document.getElementById("color");

const descriptionInput = document.getElementById("description");

customerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const plate = plateInput.value.trim();
  const model = modelInput.value.trim();
  const color = colorInput.value.trim();
  const description = descriptionInput.value.trim(); // <-- new

  const servicesArr = [...selectedServices].map(s => JSON.parse(s));
  const total = servicesArr.reduce((s, x) => s + x.price, 0);

  const status = "pending";

const company = companyInput.value;

// Save inside corporate structure
await addDoc(collection(db, "corporates", company, "jobs"), {
  company,
  plate,
  model,
  color,
  description,
  phone: "",
  services: servicesArr,
  total,
  assignedTo: "",
  status,
  createdAt: serverTimestamp()
});


  // Reset UI
  cancelBtn.click();
});


/* -------------------------
   LIVE JOBS (Separated)
-------------------------*/
function startJobsListener() {
  loader.style.display = "flex";

  const q = query(
    collectionGroup(db, "jobs"),
    where("company", "!=", ""), 
    where("status", "in", ["pending", "in_progress"]),
    orderBy("company"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {

    const pendingContainer = document.getElementById("cardsContainer");
    const inProgressContainer = document.getElementById("inProgressContainer");

    pendingContainer.innerHTML = "";
    inProgressContainer.innerHTML = "";

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;

      const card = renderJobCard(id, data, docSnap.ref);

      if (data.status === "pending") {
        pendingContainer.appendChild(card);
      } else if (data.status === "in_progress") {
        inProgressContainer.appendChild(card);
      }
    });

    loader.style.display = "none";
  });
}



/* -------------------------
   JOB CARD
-------------------------*/
function renderJobCard(id, data, ref) {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <div class="left">
      <div class="plate">${data.plate}</div>
      <div class="company-tag">${data.company || "—"}</div>
    </div>
    <div class="right">
      <div class="actions-column">
        <button class="small-btn primary">
          ${data.status === "pending" ? "Start" : data.status === "in_progress" ? "Complete" : "Completed"}
        </button>
        <button class="small-btn ghost">Details</button>
      </div>
    </div>
  `;

  const action = card.querySelector(".primary");
  const details = card.querySelector(".ghost");

  // Details modal
  details.onclick = () => openJobModal(id, data, ref);

  // Change status using real path
  action.onclick = async () => {
    if (data.status === "pending") {
      await updateDoc(ref, { status: "in_progress" });
    } else if (data.status === "in_progress") {
      openCustomerFinalizeModal(id, data, ref);
    }
  };

  return card;
}


let currentJobRef = null;  // store the exact Firestore doc reference
/* -------------------------
   JOB DETAILS MODAL
-------------------------*/
function openJobModal(id, data, ref) {

  currentJobId = id;
 currentJobRef = ref; 

  r_jobid.textContent = id;
  r_plate.textContent = data.plate;
  r_company.textContent = data.company || "—";
  r_model.textContent = data.model;
  r_color.textContent = data.color;
  r_description.textContent = data.description || "—"; // <-- new
  r_services.innerHTML = data.services.map(s => `<li>${s.name} — Kshs ${s.price}</li>`).join("");

  // Assignment controls
  takeStaffSelect.value = data.assignedTo || "";
  r_assigned.textContent = data.assignedTo || "—";
  r_total.textContent = `Kshs ${data.total}`;

  takeStaffSelect.style.display = "block";
  confirmAssignBtn.style.display = "block";
  takeJobBtn.style.display = data.status === "pending" ? "block" : "none";

  modalDeleteBtn.style.display = "block";
  modalDeleteBtn.onclick = async () => {
    const confirmDelete = confirm("Remove this job permanently?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "jobs", id));
      closeModal();
    } catch (error) {
      console.error("Failed to delete job:", error);
      alert("Error deleting job. Please try again.");
    }
  };

  receiptModal.setAttribute("aria-hidden", "false");
}


// Close modal handlers
closeReceipt.onclick = closeModal;
closeReceiptBtn.onclick = closeModal;

function closeModal() {
  currentJobId = null;
  receiptModal.setAttribute("aria-hidden", "true");
}

/* -------------------------
   ASSIGN STAFF & TAKE JOB
   -------------------------*/

// When Take Job is clicked, simply mark in_progress with selected staff
takeJobBtn.onclick = async () => {
  if (!takeStaffSelect.value) return alert("Select staff before taking job");

  if (!currentJobRef) return alert("Error: job reference missing");

  await updateDoc(currentJobRef, {
    assignedTo: takeStaffSelect.value,
    status: "in_progress"
  });

  closeModal();
};



// When Confirm Assign is clicked, just change the assignedTo field
confirmAssignBtn.onclick = async () => {
  if (!takeStaffSelect.value) return alert("Select staff");

  if (!currentJobRef) return alert("Error: job reference missing");

  await updateDoc(currentJobRef, {
    assignedTo: takeStaffSelect.value
  });

  r_assigned.textContent = takeStaffSelect.value;
  alert("Assigned person updated");
};


/* -------------------------
   COMPLETE JOB → SAVE CUSTOMER + WHATSAPP
   -------------------------*/
function openCustomerFinalizeModal(id, data, ref) {
  currentJobId = id;
  currentJobRef = ref;          // correct path
  openJobModal(id, data, ref);  // pass ref to modal

  const oldForm = document.getElementById("finishForm");
  if (oldForm) oldForm.remove();

  const formHtml = `
    <form id="finishForm" style="margin-top: 18px; display: flex; flex-direction: column; gap: 12px;">
      <input id="cust_name" type="text" placeholder="Customer name" required
        style="padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 15px;">
      <input id="cust_phone" type="tel" placeholder="+2547XXXXXXXX" required
        style="padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 15px;">
      <button class="btn primary" type="submit" style="padding: 10px; border-radius: 8px; font-weight: 600;">
        Save & Send Receipt
      </button>
    </form>
  `;

  r_services.insertAdjacentHTML("afterend", formHtml);

  document.getElementById("finishForm").onsubmit = async (e) => {
    e.preventDefault();

    const cname = cust_name.value.trim();
    let cphone = cust_phone.value.replace(/\s+/g, "");

    await setDoc(doc(db, "customers", id), {
      jobId: id,
      customerName: cname,
      phone: cphone,
      carPlate: data.plate,
      services: data.services,
      total: data.total,
      createdAt: serverTimestamp()
    });

    // ✅ use the correct ref here
    await updateDoc(currentJobRef, { status: "completed" });

    const waLink = `https://wa.me/${cphone.replace("+", "")}?text=${encodeURIComponent(
      `NIAPAY RECEIPT\nPlate: ${data.plate}\nServices:\n${data.services.map(s => s.name + " - " + s.price).join("\n")}\nTotal: Kshs ${data.total}\n\nThank you for choosing NIAPAY Car Wash.`
    )}`;

    window.open(waLink, "_blank");
    closeModal();
  };
}




async function renderServices() {
  const servicesGrid = document.getElementById("servicesGrid");
  if (!servicesGrid) return;

  try {
    const servicesRef = collection(db, "services");
    const snap = await getDocs(servicesRef);

    if (snap.empty) {
      servicesGrid.innerHTML = `<div class="muted">No services available</div>`;
      return;
    }

    // Generate buttons for each service
    servicesGrid.innerHTML = snap.docs.map(docSnap => {
      const s = docSnap.data();
      const name = s.name || "Unnamed Service";
      const price = s.price || 0;

      return `
        <button type="button" class="service" data-price="${price}" aria-pressed="false">
          <div class="service-name">${name}</div>
          <div class="service-price">Kshs ${price}</div>
        </button>
      `;
    }).join("");

  } catch (err) {
    console.error("Failed to load services:", err);
    servicesGrid.innerHTML = `<div class="muted">Failed to load services</div>`;
  }
}

// Call the function when the page loads or panel is opened
renderServices();



async function populateStaffDropdown() {
  const staffSelect = document.getElementById("takeStaffSelect");
  if (!staffSelect) return;

  try {
    const staffRef = collection(db, "staff");
    const snap = await getDocs(staffRef);

    // Clear previous options except the placeholder
    staffSelect.innerHTML = `<option value="">-- Choose staff --</option>`;

    snap.forEach(docSnap => {
      const staff = docSnap.data();
      const fullName = `${staff.firstName || ""} ${staff.lastName || ""}`.trim();
      if (fullName) {
        const option = document.createElement("option");
        option.value = fullName;
        option.textContent = fullName;
        staffSelect.appendChild(option);
      }
    });

  } catch (err) {
    console.error("Failed to load staff:", err);
    // Optionally show an error option
    staffSelect.innerHTML = `<option value="">Failed to load staff</option>`;
  }
}

// Call this function when page loads or when the receipt panel opens
populateStaffDropdown();



async function populateCompaniesDropdown() {
  const companySelect = document.getElementById("company");
  if (!companySelect) return;

  try {
    const companiesRef = collection(db, "companies");
    const snap = await getDocs(companiesRef);

    // Clear previous options except the placeholder
    companySelect.innerHTML = `<option value="" disabled selected>Select company</option>`;

    snap.forEach(docSnap => {
      const company = docSnap.data();
      const name = company.name || company.fullName || docSnap.id;
      if (name) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        companySelect.appendChild(option);
      }
    });

  } catch (err) {
    console.error("Failed to load companies:", err);
    companySelect.innerHTML = `<option value="">Failed to load companies</option>`;
  }
}

// Call this on page load or when the form is displayed
populateCompaniesDropdown();

/* -------------------------
   AUTH
   -------------------------*/
signinForm.onsubmit = async (e) => {
  e.preventDefault();
  await signInWithEmailAndPassword(auth, signInEmail.value, signInPassword.value);
  signinModal.setAttribute("aria-hidden", "true");
};

signOutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  if (user) {
    managerEmail.textContent = user.email;
    if (!window.unsub) window.unsub = startJobsListener();
  } else {
    if (window.unsub) window.unsub();
    window.location = "sign.html";
  }
});


