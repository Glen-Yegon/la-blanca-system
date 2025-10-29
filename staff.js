import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { 
  getFirestore, doc, getDoc , where, collection, getDocs, query, orderBy, updateDoc 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// ==============================
// FIREBASE CONFIGURATION
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyCT1Zb6b9qBDxa2nrqNu_6cSJ6jCKfq4yY",
  authDomain: "niapay-carwash.firebaseapp.com",
  projectId: "niapay-carwash",
  storageBucket: "niapay-carwash.appspot.com",
  messagingSenderId: "994223696529",
  appId: "1:994223696529:web:97e8e7807cc7338878ed30",
  measurementId: "G-NKDCNQZND5",
};

// ==============================
// INITIALIZE
// ==============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const staffNameEl = document.getElementById("staffName");
const jobsContainer = document.getElementById("jobsContainer");
const loader = document.getElementById("loader");

let currentStaffName = "";

// ==============================
// LOAD STAFF NAME
// ==============================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      currentStaffName = data.name;
      staffNameEl.textContent = `Welcome, ${data.name}`;
      loadJobs();
    } else {
      staffNameEl.textContent = "Staff Member";
    }
  } else {
    window.location.href = "login.html";
  }
});


async function loadJobs() {
  loader.classList.remove("hidden");
  try {
    const q = query(collection(db, "customer"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const jobs = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === "Pending" || data.status === "In Progress") {
        jobs.push({ id: docSnap.id, ...data });
      }
    });

    renderJobs(jobs);
  } catch (error) {
    console.error("Error loading jobs:", error);
  } finally {
    loader.classList.add("hidden");
  }
}


function renderJobs(jobs) {
  jobsContainer.innerHTML = "";

  if (jobs.length === 0) {
    jobsContainer.innerHTML = `<p style="text-align:center; color:#777;">No active jobs at the moment.</p>`;
    return;
  }

  jobs.forEach((job) => {
    // 🚫 Skip jobs assigned to someone else
    if (job.assignedTo && job.assignedTo.trim().toLowerCase() !== currentStaffName.trim().toLowerCase()) {
      return; // don't render this card
    }

    const servicesHTML = job.services
      .map((s) => `<div class="service-item"><span>${s.name}</span><span>Ksh ${s.price}</span></div>`)
      .join("");

    const jobCard = document.createElement("div");
    jobCard.classList.add("job-card");

    jobCard.innerHTML = `
      <div class="job-header">
        <div>
          <span class="job-plate"><strong>Plate:</strong> ${job.plate}</span><br>
          <span class="job-uuid"><strong>Job UUID:</strong> ${job.jobUUID}</span>
        </div>
        <span class="job-status ${job.status.replace(" ", "-")}">${job.status}</span>
      </div>

      <div class="job-details">
        <p><strong>Model:</strong> ${job.model}</p>
        <p><strong>Color:</strong> ${job.color}</p>
        <p><strong>Phone:</strong> ${job.phone}</p>
        <p><strong>Payment:</strong> ${job.payment}</p>

        <div class="services">
          <strong>Services:</strong>
          ${servicesHTML}
        </div>

        <p style="margin-top:0.5rem;"><strong>Total:</strong> Ksh ${job.total}</p>
        ${job.assignedTo ? `<p><strong>Assigned To:</strong> ${job.assignedTo}</p>` : ""}
      </div>

      <button class="take-btn" data-uuid="${job.jobUUID}">
        ${job.status === "Pending" ? "Take Job" : "Finish"}
      </button>
    `;

    const btn = jobCard.querySelector(".take-btn");
    btn.addEventListener("click", async () => {
      const jobUUID = btn.dataset.uuid;

      if (job.status === "Pending") {
        await takeJob(jobUUID, jobCard);
      } else if (job.status === "In Progress") {
        await finishJob(jobUUID, jobCard);
      }
    });

    jobsContainer.appendChild(jobCard);
  });
}


// ==============================
// TAKE JOB FUNCTION (using jobUUID)
// ==============================
async function takeJob(jobUUID, card) {
  try {
    const jobsRef = collection(db, "customer");
    const q = query(jobsRef, where("jobUUID", "==", jobUUID));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error("❌ Job not found:", jobUUID);
      return;
    }

    // There should only be one match
    const jobDoc = querySnapshot.docs[0];
    const jobRef = doc(db, "customer", jobDoc.id);

    await updateDoc(jobRef, {
      status: "In Progress",
      assignedTo: currentStaffName,
      startedAt: new Date().toISOString(),
    });

    // Update UI instantly
    const statusEl = card.querySelector(".job-status");
    statusEl.textContent = "In Progress";
    statusEl.className = "job-status In-Progress";

    const assigned = document.createElement("p");
    assigned.innerHTML = `<strong>Assigned To:</strong> ${currentStaffName}`;
    card.querySelector(".job-details").appendChild(assigned);

    const btn = card.querySelector(".take-btn");
    btn.textContent = "Finish";
    btn.onclick = () => finishJob(jobUUID, card);

    console.log(`✅ Job ${jobUUID} assigned to ${currentStaffName}`);
  } catch (error) {
    console.error("❌ Error taking job:", error);
  }
}

// ==============================
// FINISH JOB FUNCTION (using jobUUID)
// ==============================
async function finishJob(jobUUID, card) {
  try {
    const jobsRef = collection(db, "customer");
    const q = query(jobsRef, where("jobUUID", "==", jobUUID));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error("❌ Job not found:", jobUUID);
      return;
    }

    const jobDoc = querySnapshot.docs[0];
    const jobRef = doc(db, "customer", jobDoc.id);

    await updateDoc(jobRef, {
      status: "Completed",
      completedAt: new Date().toISOString(),
    });

    // Update UI instantly
    const statusEl = card.querySelector(".job-status");
    statusEl.textContent = "Completed";
    statusEl.className = "job-status Completed";

    const btn = card.querySelector(".take-btn");
    btn.disabled = true;
    btn.textContent = "Completed ✅";
    btn.style.backgroundColor = "#b89360";
    btn.style.cursor = "not-allowed";

    console.log(`✅ Job ${jobUUID} marked as Completed`);
  } catch (error) {
    console.error("❌ Error finishing job:", error);
  }
}