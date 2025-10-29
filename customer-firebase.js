// ==============================
// FIREBASE SETUP
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// ==============================
// FIREBASE CONFIG
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyCT1Zb6b9qBDxa2nrqNu_6cSJ6jCKfq4yY",
  authDomain: "niapay-carwash.firebaseapp.com",
  projectId: "niapay-carwash",
  storageBucket: "niapay-carwash.firebasestorage.app",
  messagingSenderId: "994223696529",
  appId: "1:994223696529:web:97e8e7807cc7338878ed30",
  measurementId: "G-NKDCNQZND5"
};

// ==============================
// INITIALIZE FIREBASE
// ==============================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==============================
// HELPER FUNCTIONS
// ==============================

// Generate a human-readable unique customer ID (plate + timestamp + random suffix)
function generateCustomerId(plate) {
  const cleanPlate = plate.replace(/\s+/g, "").toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${cleanPlate}_${Date.now()}_${randomPart}`;
}

// ==============================
// FIRESTORE FUNCTIONS
// ==============================

// Load staff names into the dropdown
async function loadStaffNames() {
  const staffSelect = document.getElementById("assignTo");
  staffSelect.innerHTML = `<option value="">-- Select Staff (optional) --</option>`;

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.role === "staff" || data.name) {
        const option = document.createElement("option");
        option.value = data.name;
        option.textContent = data.name;
        staffSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("❌ Error loading staff names:", error);
  }
}

// Run on page load
window.addEventListener("DOMContentLoaded", loadStaffNames);

// Save a new job
export async function saveJob(job) {
  try {
    job.createdAt = new Date().toISOString();
    job.status = "Pending";

    // Generate unique IDs
    job.customerId = generateCustomerId(job.plate);
    job.jobUUID = crypto.randomUUID(); // Guaranteed unique machine ID

    // Save to Firestore
    const docRef = await addDoc(collection(db, "customer"), job);
    console.log("✅ Job saved with Firestore ID:", docRef.id);
    console.log("✅ Job customerId:", job.customerId);
    console.log("✅ Job UUID:", job.jobUUID);

    return { firestoreId: docRef.id, customerId: job.customerId, jobUUID: job.jobUUID };
  } catch (error) {
    console.error("❌ Error adding job:", error);
    return null;
  }
}

// Load all Pending + In-Progress jobs
export async function loadPendingJobs() {
  try {
    const q = query(collection(db, "customer"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const jobs = [];
    querySnapshot.forEach((doc) => {
      const data = { firestoreId: doc.id, ...doc.data() };
      if (data.status === "Pending" || data.status === "In Progress") {
        jobs.push(data);
      }
    });

    console.log(`✅ Loaded ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    console.error("❌ Error loading jobs:", error);
    return [];
  }
}
