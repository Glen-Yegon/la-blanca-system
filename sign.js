import { auth, db } from "./firebase-config.js";

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

import { 
  doc, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";


const signupForm = document.getElementById("signupForm");
const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupConfirm = document.getElementById("signupConfirm");
const signupRole = document.getElementById("signupRole");
const loginRole = document.getElementById("loginRole");


document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = signupName.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value.trim();
  const confirm = signupConfirm.value.trim();
  const role = signupRole.value.toLowerCase(); // normalize to lowercase

  if (!name || !email || !password || !confirm) {
    alert("Please fill in all fields.");
    return;
  }

  if (password !== confirm) {
    alert("Passwords do not match.");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save profile with normalized role
    await setDoc(doc(db, "accounts", user.uid), {
      name,
      email,
      role,
      createdAt: new Date()
    });

    // Redirect based on role
    if (role === "manager") {
      window.location.href = "manager.html";
    } else if (role === "clerk") {
      window.location.href = "customer.html";
    } else {
      console.warn("Unknown role, redirecting to login page.");
      window.location.href = "login.html";
    }

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
});





// LOGIN
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();
const role = loginRole.value.toLowerCase();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const profileSnap = await getDoc(doc(db, "accounts", user.uid));

    if (!profileSnap.exists()) {
      alert("Profile not found.");
      return;
    }

    const profile = profileSnap.data();

if (role === "manager") {
  window.location.href = "manager.html";
} else if (role === "clerk") {
  window.location.href = "customer.html";
} else {
  alert("Invalid role.");
}


  } catch (error) {
    alert("Incorrect email or password.");
  }
});



// Toggle Login ↔ Signup
const toggleButtons = document.querySelectorAll('.toggle-btn');
const loginForm = document.getElementById('loginForm');

toggleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    toggleButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.target === 'signup') {
      loginForm.classList.add('hidden');
      signupForm.classList.remove('hidden');
    } else {
      signupForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    }
  });
});


// Password Show / Hide
document.querySelectorAll('.pw-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const targetId = toggle.dataset.target;
    const input = document.getElementById(targetId);

    if (input.type === "password") {
      input.type = "text";
      toggle.textContent = "Hide";
    } else {
      input.type = "password";
      toggle.textContent = "Show";
    }
  });
});


// Back Button
document.getElementById("backBtn").addEventListener("click", () => {
  window.history.back();
});
