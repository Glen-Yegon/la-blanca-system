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
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
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

customerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const plate = plateInput.value.trim();
  const model = modelInput.value.trim();
  const color = colorInput.value.trim();

  const servicesArr = [...selectedServices].map(s => JSON.parse(s));
  const total = servicesArr.reduce((s, x) => s + x.price, 0);

  // No phone, no assignment yet → manager assigns later
  const status = "pending";

  await addDoc(collection(db, "jobs"), {
    plate,
    model,
    color,
    phone: "",            // intentionally blank for now
    services: servicesArr,
    total,
    assignedTo: "",       // assigned later
    status,
    createdAt: serverTimestamp()
  });

  // Reset UI
  cancelBtn.click();
});


/* -------------------------
   LIVE JOBS
   -------------------------*/
function startJobsListener() {
  loader.style.display = "flex";

  // ✅ Only fetch jobs where status is pending or in_progress
  const q = query(
    collection(db, "jobs"),
    where("status", "in", ["pending", "in_progress"]),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    cardsContainer.innerHTML = "";
    snap.forEach(docSnap => renderJobCard(docSnap.id, docSnap.data()));
    loader.style.display = "none";
  });
}


/* -------------------------
   JOB CARD
   -------------------------*/
function renderJobCard(id, data) {
  const card = document.createElement("div");
  card.className = "card";

card.innerHTML = `
  <div class="left">
    <div class="plate">${data.plate}</div>
    <div class="meta">${data.model} • ${data.phone || "No phone"}</div>
  </div>
  <div class="right">
    <div class="tag">${data.status.replace("_", " ")}</div>
    <button class="small-btn primary">${data.status === "pending" ? "Start" : data.status === "in_progress" ? "Complete" : "Completed"}</button>
    <button class="small-btn ghost">Details</button>
    <button class="small-btn danger delete-btn">X</button>
  </div>
`;


  const action = card.querySelector(".primary");
  const details = card.querySelector(".ghost");
  const del = card.querySelector(".delete-btn");


  details.onclick = () => openJobModal(id, data);

  action.onclick = async () => {
    if (data.status === "pending") {
      await updateDoc(doc(db, "jobs", id), { status: "in_progress" });
    } else if (data.status === "in_progress") {
      openCustomerFinalizeModal(id, data);
    }
  };

  del.onclick = async () => {
  const confirmDelete = confirm("Remove this job permanently?");
  if (!confirmDelete) return;

  await deleteDoc(doc(db, "jobs", id));
};


  cardsContainer.appendChild(card);
}

/* -------------------------
   JOB DETAILS MODAL
   -------------------------*/
function openJobModal(id, data) {
  currentJobId = id;

  r_jobid.textContent = id;
  r_plate.textContent = data.plate;
  r_model.textContent = data.model;
  r_color.textContent = data.color;
  r_services.innerHTML = data.services.map(s => `<li>${s.name} — Kshs ${s.price}</li>`).join("");

  // Show current assigned person or blank
  takeStaffSelect.value = data.assignedTo || "";

  r_assigned.textContent = data.assignedTo || "—";
  r_total.textContent = `Kshs ${data.total}`;

  // Always show assignment controls in modal
  takeStaffSelect.style.display = "block";
  confirmAssignBtn.style.display = "block";

  // Show or hide Take Job button depending on status
  takeJobBtn.style.display = data.status === "pending" ? "block" : "none";

  receiptModal.setAttribute("aria-hidden", "false");
}

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

  await updateDoc(doc(db, "jobs", currentJobId), {
    assignedTo: takeStaffSelect.value,
    status: "in_progress"
  });

  closeModal();
};

// When Confirm Assign is clicked, just change the assignedTo field
confirmAssignBtn.onclick = async () => {
  if (!takeStaffSelect.value) return alert("Select staff");

  await updateDoc(doc(db, "jobs", currentJobId), {
    assignedTo: takeStaffSelect.value
  });

  r_assigned.textContent = takeStaffSelect.value;
  alert("Assigned person updated");
};

/* -------------------------
   COMPLETE JOB → SAVE CUSTOMER + WHATSAPP
   -------------------------*/
function openCustomerFinalizeModal(id, data) {
  currentJobId = id;
  openJobModal(id, data);

  // ✅ Remove old form if it exists
  const oldForm = document.getElementById("finishForm");
  if (oldForm) oldForm.remove();

  const formHtml = `
    <form id="finishForm" style="
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    ">
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

    await updateDoc(doc(db, "jobs", id), { status: "completed" });

    // ✅ Send the receipt to the *customer*
    const waLink = `https://wa.me/${cphone.replace("+", "")}?text=${encodeURIComponent(
      `NIAPAY RECEIPT\nPlate: ${data.plate}\nServices:\n${data.services.map(s => s.name + " - " + s.price).join("\n")}\nTotal: Kshs ${data.total}\n\nThank you for choosing NIAPAY Car Wash.`
    )}`;

    window.open(waLink, "_blank");
    closeModal();
  };
}


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


