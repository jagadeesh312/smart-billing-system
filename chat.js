import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "./firebase-config.js";
import {
  addDoc,
  deleteDoc,
  limit,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export function subscribeUsers(onData, onError) {
  const usersQuery = query(collection(db, "users"), where("role", "==", "user"));
  return onSnapshot(
    usersQuery,
    (snap) =>
      onData(
        snap.docs
          .map((item) => ({ uid: item.id, ...item.data() }))
          .sort((a, b) => {
            const at = a.createdAt?.toMillis?.() || 0;
            const bt = b.createdAt?.toMillis?.() || 0;
            return at - bt;
          })
      ),
    onError
  );
}

export async function getAdminProfile() {
  const adminQuery = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
  const snap = await getDocs(adminQuery);
  if (snap.empty) return null;
  const adminDoc = snap.docs[0];
  return { uid: adminDoc.id, ...adminDoc.data() };
}

export function subscribeUserDoc(uid, onData, onError) {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({ uid: snap.id, ...snap.data() });
    },
    onError
  );
}

export function subscribeChatsFor(uid, onData, onError) {
  const chatsQuery = query(collection(db, "chats"), where("participants", "array-contains", uid));
  return onSnapshot(
    chatsQuery,
    (snap) =>
      onData(
        snap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => {
            const at = a.updatedAt?.toMillis?.() || 0;
            const bt = b.updatedAt?.toMillis?.() || 0;
            return bt - at;
          })
      ),
    onError
  );
}

export async function ensureDirectChat(adminId, userId) {
  const chatsQuery = query(collection(db, "chats"), where("participants", "array-contains", adminId));
  const snap = await getDocs(chatsQuery);

  const existing = snap.docs.find((entry) => {
    const data = entry.data();
    return data.participants?.length === 2 && data.participants.includes(adminId) && data.participants.includes(userId);
  });

  if (existing) return existing.id;

  const chatRef = await addDoc(collection(db, "chats"), {
    participants: [adminId, userId],
    lastMessage: "",
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    typing: {}
  });

  return chatRef.id;
}

export function subscribeMessages(chatId, onData, onError) {
  const messagesQuery = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
  return onSnapshot(
    messagesQuery,
    (snap) => onData(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function sendChatMessage(chatId, senderId, text) {
  const cleanText = text.trim();
  if (!cleanText) return;

  await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId,
    text: cleanText,
    timestamp: serverTimestamp(),
    seen: false,
    edited: false
  });

  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: cleanText,
    updatedAt: serverTimestamp()
  });
}

export async function markMessagesSeen(chatId, viewerId) {
  const snap = await getDocs(collection(db, "chats", chatId, "messages"));
  const unseen = snap.docs.filter((entry) => {
    const message = entry.data();
    return message.senderId !== viewerId && !message.seen;
  });

  if (!unseen.length) return;

  const batch = writeBatch(db);
  unseen.forEach((entry) => {
    batch.update(entry.ref, { seen: true });
  });
  await batch.commit();
}

export async function setTypingState(chatId, uid, isTyping) {
  await setDoc(
    doc(db, "chats", chatId),
    {
      typing: { [uid]: isTyping },
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function setUserPresence(uid, isOnline) {
  await updateDoc(doc(db, "users", uid), {
    isOnline,
    lastSeen: serverTimestamp()
  });
}

export async function setBlockState(userId, blocked) {
  await updateDoc(doc(db, "users", userId), { blocked });
}

export async function deleteChatDeep(chatId) {
  const msgSnap = await getDocs(collection(db, "chats", chatId, "messages"));

  if (!msgSnap.empty) {
    const batch = writeBatch(db);
    msgSnap.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, "chats", chatId));
}

export function formatTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatSeenTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
