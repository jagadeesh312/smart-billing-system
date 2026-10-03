import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  clearAdminLocalSession,
  setAdminLocalSession,
  onAuthStateChanged,
  updateDoc,
  serverTimestamp
} from "./firebase-config.js";

export async function loginWithRole(email, password, expectedRole) {
  await setPersistence(auth, browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(auth, email, password);

  const userRef = doc(db, "users", credential.user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await signOut(auth);
    throw new Error("No Firestore profile found for this account.");
  }

  const profile = userSnap.data();
  if (profile.role !== "admin" && profile.role !== "user") {
    await signOut(auth);
    throw new Error("Invalid role configured for this user.");
  }

  if (expectedRole && profile.role !== expectedRole) {
    await signOut(auth);
    throw new Error(`This account is not a ${expectedRole}.`);
  }

  if (profile.role === "admin") {
    await setPersistence(auth, browserLocalPersistence);
    setAdminLocalSession(credential.user, profile);
  } else {
    clearAdminLocalSession();
  }

  await updateDoc(userRef, {
    isOnline: true,
    lastSeen: serverTimestamp()
  });

  return {
    user: credential.user,
    profile: { uid: userSnap.id, ...profile }
  };
}

export async function signupUser(name, email, password) {
  await setPersistence(auth, browserSessionPersistence);
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  const userData = {
    name: name.trim(),
    email,
    role: "user",
    createdAt: serverTimestamp(),
    isOnline: true,
    lastSeen: serverTimestamp(),
    blocked: false
  };

  await setDoc(doc(db, "users", credential.user.uid), userData);
  clearAdminLocalSession();

  return {
    user: credential.user,
    profile: { uid: credential.user.uid, ...userData }
  };
}

export async function logoutCurrentUser() {
  const current = auth.currentUser;
  if (current) {
    try {
      await updateDoc(doc(db, "users", current.uid), {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    } catch {
      // Keep logout flow resilient even if presence update fails.
    }
  }

  clearAdminLocalSession();
  await signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentUserProfile(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return null;
  return { uid: userSnap.id, ...userSnap.data() };
}

export async function requireRole(expectedRole) {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        window.location.replace("./index.html");
        resolve(null);
        return;
      }

      const profile = await getCurrentUserProfile(user.uid);
      if (!profile || profile.role !== expectedRole) {
        window.location.replace(profile?.role === "admin" ? "./dashboard.html" : "./chat.html");
        resolve(null);
        return;
      }

      await updateDoc(doc(db, "users", user.uid), {
        isOnline: true,
        lastSeen: serverTimestamp()
      }).catch(() => undefined);

      resolve({ user, profile });
    });
  });
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const roleSwitch = document.getElementById("role-switch");
  const modeSwitch = document.getElementById("mode-switch");
  const signupTab = document.getElementById("signup-tab");
  const roleHelp = document.getElementById("role-help");
  const nameField = document.getElementById("name-field");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("login-btn");
  const loadingBox = document.getElementById("loading");
  const errorBox = document.getElementById("error");

  let selectedRole = "user";
  let mode = "login";

  function syncUi() {
    if (selectedRole === "admin") {
      mode = "login";
    }

    roleSwitch.querySelectorAll(".switch-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.role === selectedRole);
    });

    modeSwitch.querySelectorAll(".switch-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

    if (selectedRole === "admin") {
      nameField.classList.add("hidden");
      nameInput.required = false;
      signupTab.disabled = true;
      signupTab.classList.remove("active");
      roleHelp.textContent = "Admin uses login only.";
      loginButton.textContent = "Login as Admin";
      return;
    }

    signupTab.disabled = false;
    roleHelp.textContent = "User can login or sign up.";

    if (mode === "signup") {
      nameField.classList.remove("hidden");
      nameInput.required = true;
      loginButton.textContent = "Create User Account";
    } else {
      nameField.classList.add("hidden");
      nameInput.required = false;
      loginButton.textContent = "Login as User";
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const profile = await getCurrentUserProfile(user.uid);
    if (!profile) return;
    window.location.replace(profile.role === "admin" ? "./dashboard.html" : "./chat.html");
  });

  roleSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-role]");
    if (!button) return;
    selectedRole = button.dataset.role;
    if (selectedRole === "admin") {
      mode = "login";
    }
    syncUi();
  });

  modeSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button || selectedRole === "admin") return;
    mode = button.dataset.mode;
    syncUi();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    errorBox.classList.add("hidden");
    loadingBox.classList.remove("hidden");
    loginButton.disabled = true;

    try {
      if (selectedRole === "user" && mode === "signup") {
        const name = nameInput.value.trim();
        if (name.length < 2) {
          throw new Error("Please enter a valid name.");
        }

        await signupUser(name, emailInput.value.trim(), passwordInput.value);
        window.location.replace("./chat.html");
      } else {
        const { profile } = await loginWithRole(emailInput.value.trim(), passwordInput.value, selectedRole);
        window.location.replace(profile.role === "admin" ? "./dashboard.html" : "./chat.html");
      }
    } catch (error) {
      errorBox.textContent = error.message || "Authentication failed.";
      errorBox.classList.remove("hidden");
    } finally {
      loadingBox.classList.add("hidden");
      loginButton.disabled = false;
    }
  });

  syncUi();
}

initLoginPage();
