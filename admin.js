import { logoutCurrentUser, requireRole } from "./auth.js";
import {
  deleteChatDeep,
  ensureDirectChat,
  formatSeenTime,
  formatTime,
  markMessagesSeen,
  sendChatMessage,
  setBlockState,
  setUserPresence,
  setTypingState,
  subscribeChatsFor,
  subscribeMessages,
  subscribeUsers
} from "./chat.js";

const userListEl = document.getElementById("user-list");
const userSearchEl = document.getElementById("user-search");
const adminMetaEl = document.getElementById("admin-meta");
const chatUserNameEl = document.getElementById("chat-user-name");
const chatUserMetaEl = document.getElementById("chat-user-meta");
const blockBtn = document.getElementById("block-btn");
const deleteChatBtn = document.getElementById("delete-chat-btn");
const chatErrorEl = document.getElementById("chat-error");
const typingEl = document.getElementById("typing-indicator");
const messagesEl = document.getElementById("messages");
const messageInputEl = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const logoutBtn = document.getElementById("logout-btn");

let adminSession = null;
let users = [];
let chats = [];
let selectedUser = null;
let activeChatId = null;
let messagesUnsub = null;
let typingTimeout;

function setError(message = "") {
  if (!message) {
    chatErrorEl.classList.add("hidden");
    chatErrorEl.textContent = "";
    return;
  }

  chatErrorEl.textContent = message;
  chatErrorEl.classList.remove("hidden");
}

function renderUsers() {
  const search = userSearchEl.value.trim().toLowerCase();

  const chatMap = new Map();
  chats.forEach((chat) => {
    const otherId = chat.participants.find((id) => id !== adminSession.user.uid);
    chatMap.set(otherId, chat);
  });

  const filtered = users
    .map((user) => ({ ...user, chat: chatMap.get(user.uid) || null }))
    .filter((user) => !search || user.name?.toLowerCase().includes(search) || user.email?.toLowerCase().includes(search));

  if (!filtered.length) {
    userListEl.innerHTML = '<p class="empty-list">No users found.</p>';
    return;
  }

  userListEl.innerHTML = filtered
    .map((user) => {
      const isActive = selectedUser?.uid === user.uid;
      return `
        <div class="user-item ${isActive ? "active" : ""}" data-user-id="${user.uid}">
          <div class="user-top">
            <strong>${user.name || "Unnamed User"}</strong>
            <span class="online-dot ${user.isOnline ? "online" : ""}"></span>
          </div>
          <div class="user-preview">${user.chat?.lastMessage || "No messages yet"}</div>
          <div class="user-preview">${user.isOnline ? "Online" : `Last seen ${formatSeenTime(user.lastSeen) || "recently"}`}</div>
        </div>
      `;
    })
    .join("");

  userListEl.querySelectorAll(".user-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const user = users.find((entry) => entry.uid === item.dataset.userId);
      if (!user) return;
      await openChatForUser(user);
      renderUsers();
    });
  });
}

function renderMessages(list) {
  if (!list.length) {
    messagesEl.innerHTML = '<div class="center-state">No messages yet.</div>';
    return;
  }

  messagesEl.innerHTML = list
    .map((message) => {
      const mine = message.senderId === adminSession.user.uid;
      return `
      <div class="message-row ${mine ? "mine" : ""}">
        <div class="bubble ${mine ? "mine" : "other"}">
          ${escapeHtml(message.text)}
          <div class="message-meta">
            ${formatTime(message.timestamp)} ${mine ? `• ${message.seen ? "Seen" : "Sent"}` : ""}
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function openChatForUser(user) {
  selectedUser = user;
  setError("");

  chatUserNameEl.textContent = user.name || "User";
  chatUserMetaEl.textContent = `${user.email || "No email"} ${user.blocked ? "• Blocked" : ""}`;
  blockBtn.classList.remove("hidden");
  deleteChatBtn.classList.remove("hidden");
  blockBtn.textContent = user.blocked ? "Unblock" : "Block";

  try {
    activeChatId = await ensureDirectChat(adminSession.user.uid, user.uid);
    messageInputEl.disabled = user.blocked;
    sendBtn.disabled = user.blocked;

    if (messagesUnsub) messagesUnsub();
    messagesUnsub = subscribeMessages(
      activeChatId,
      async (items) => {
        renderMessages(items);
        await markMessagesSeen(activeChatId, adminSession.user.uid).catch(() => undefined);
      },
      () => setError("Failed to load messages.")
    );
  } catch {
    setError("Unable to open this chat.");
  }
}

async function sendCurrentMessage() {
  if (!activeChatId || !selectedUser || selectedUser.blocked) return;

  const text = messageInputEl.value.trim();
  if (!text) return;

  sendBtn.disabled = true;
  try {
    await sendChatMessage(activeChatId, adminSession.user.uid, text);
    messageInputEl.value = "";
    await setTypingState(activeChatId, adminSession.user.uid, false);
  } catch {
    setError("Failed to send message.");
  } finally {
    sendBtn.disabled = selectedUser.blocked;
  }
}

function bindEvents() {
  userSearchEl.addEventListener("input", renderUsers);

  messageInputEl.addEventListener("input", () => {
    if (!activeChatId) return;

    const isTyping = Boolean(messageInputEl.value.trim());
    setTypingState(activeChatId, adminSession.user.uid, isTyping).catch(() => undefined);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      setTypingState(activeChatId, adminSession.user.uid, false).catch(() => undefined);
    }, 1200);
  });

  messageInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendCurrentMessage();
    }
  });

  sendBtn.addEventListener("click", sendCurrentMessage);

  blockBtn.addEventListener("click", async () => {
    if (!selectedUser) return;
    try {
      await setBlockState(selectedUser.uid, !selectedUser.blocked);
      selectedUser.blocked = !selectedUser.blocked;
      blockBtn.textContent = selectedUser.blocked ? "Unblock" : "Block";
      messageInputEl.disabled = selectedUser.blocked;
      sendBtn.disabled = selectedUser.blocked;
      chatUserMetaEl.textContent = `${selectedUser.email || "No email"} ${selectedUser.blocked ? "• Blocked" : ""}`;
    } catch {
      setError("Failed to update block state.");
    }
  });

  deleteChatBtn.addEventListener("click", async () => {
    if (!activeChatId) return;
    const ok = window.confirm("Delete this chat and all messages?");
    if (!ok) return;

    try {
      await deleteChatDeep(activeChatId);
      activeChatId = null;
      messagesEl.innerHTML = '<div class="center-state">Chat deleted. Select a user.</div>';
      messageInputEl.value = "";
      messageInputEl.disabled = true;
      sendBtn.disabled = true;
    } catch {
      setError("Failed to delete chat.");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await logoutCurrentUser();
    window.location.replace("./index.html");
  });
}

async function init() {
  const authData = await requireRole("admin");
  if (!authData) return;
  adminSession = authData;

  adminMetaEl.textContent = `${authData.profile.name || "Admin"} • ${authData.profile.email || authData.user.email}`;

  bindEvents();

  subscribeUsers(
    (items) => {
      users = items;
      if (selectedUser) {
        const refreshed = items.find((entry) => entry.uid === selectedUser.uid);
        if (refreshed) selectedUser = refreshed;
      }
      renderUsers();
    },
    (error) => setError(`Unable to load users: ${error?.message || "Unknown error"}`)
  );

  subscribeChatsFor(
    authData.user.uid,
    (items) => {
      chats = items;
      renderUsers();

      const active = chats.find((chat) => chat.id === activeChatId);
      if (selectedUser && active?.typing?.[selectedUser.uid]) {
        typingEl.textContent = `${selectedUser.name || "User"} is typing...`;
        typingEl.classList.remove("hidden");
      } else {
        typingEl.classList.add("hidden");
      }
    },
    (error) => setError(`Unable to load chats: ${error?.message || "Unknown error"}`)
  );

  window.addEventListener("beforeunload", () => {
    if (activeChatId) {
      setTypingState(activeChatId, authData.user.uid, false).catch(() => undefined);
    }
    setUserPresence(authData.user.uid, false).catch(() => undefined);
  });
}

init();
