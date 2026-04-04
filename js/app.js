// KUKUMBER MESSENGER - APP
var firebaseConfig = {
    apiKey: "AIzaSyBYNJPhbs8YaNAhdjSUIdj1Ok433N19GJM",
    authDomain: "kukumber-messenger.firebaseapp.com",
    databaseURL: "https://kukumber-messenger-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kukumber-messenger",
    storageBucket: "kukumber-messenger.firebasestorage.app",
    messagingSenderId: "738635892211",
    appId: "1:738635892211:web:4bf2a45b562d22e41b3e86"
};

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var database = firebase.database();

var currentUser = null;
var currentUserData = null;
var currentChatId = null;
var currentChatUser = null;
var messagesListener = null;
var currentTab = 'chats';

// === INIT ===
window.addEventListener('load', function() {
    setTimeout(function() {
        document.getElementById('loading-screen').classList.add('hidden');
        checkAuthState();
    }, 2000);
    
    initEmojiPicker();
});

function checkAuthState() {
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            loadUserData();
            showMainScreen();
            initializePeer();
        } else {
            currentUser = null;
            currentUserData = null;
            showAuthScreen();
        }
    });
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
}

function showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    loadChats();
    loadReels();
}

function loadUserData() {
    if (!currentUser) return;
    
    database.ref('users/' + currentUser.uid).on('value', function(snapshot) {
        currentUserData = snapshot.val();
        if (currentUserData) {
            updateUserDisplay();
        }
    });
}

function updateUserDisplay() {
    if (!currentUserData) return;
    
    var username = currentUserData.username || 'Пользователь';
    var avatar = currentUserData.avatar || '';
    
    document.getElementById('current-username').textContent = username;
    document.getElementById('settings-username').textContent = username;
    document.getElementById('settings-email').textContent = currentUserData.email || '';
    document.getElementById('settings-phone').textContent = currentUserData.phone || '';
    
    var avatarEls = ['user-avatar', 'settings-avatar'];
    avatarEls.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            if (avatar) {
                el.style.backgroundImage = 'url(' + avatar + ')';
                el.style.backgroundSize = 'cover';
                el.textContent = '';
            } else {
                el.style.backgroundImage = '';
                el.textContent = '🥒';
            }
        }
    });
}

// === TABS ===
function switchToTab(tabName) {
    currentTab = tabName;
    
    // Hide all tabs
    document.getElementById('chats-tab').classList.add('hidden');
    document.getElementById('reels-tab').classList.add('hidden');
    document.getElementById('settings-tab').classList.add('hidden');
    
    // Deactivate all nav items
    document.getElementById('nav-chats').classList.remove('active');
    document.getElementById('nav-reels').classList.remove('active');
    document.getElementById('nav-settings').classList.remove('active');
    
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.getElementById('nav-' + tabName).classList.add('active');
    
    // Load content
    if (tabName === 'reels') {
        loadReels();
    } else if (tabName === 'settings') {
        updateUserDisplay();
    }
    
    // Close sidebar on mobile
    closeSidebar();
}

// === SIDEBAR ===
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
}

// === UTILITIES ===
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = now - date;
    
    if (diff < 60000) return 'сейчас';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин';
    
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
}

function showNotification(message, type) {
    type = type || 'info';
    var container = document.getElementById('notifications-container');
    var notif = document.createElement('div');
    notif.className = 'notification ' + type;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(function() { notif.remove(); }, 3000);
}

// === EMOJI ===
function initEmojiPicker() {
    var emojis = ['😀','😂','🥰','😎','🤔','😢','😡','👍','👎','❤️','🔥','✨','🎉','🥒','💚','🌿','🍀','🌱','👋','🙏','😊','😍','🤣','😘','😜','🙄','😴','🤮','💪','🎂','🎁','🎄','☀️','🌙','⭐','🌈'];
    var grid = document.querySelector('.emoji-grid');
    if (grid) {
        grid.innerHTML = '';
        emojis.forEach(function(emoji) {
            var span = document.createElement('span');
            span.textContent = emoji;
            span.onclick = function() { insertEmoji(emoji); };
            grid.appendChild(span);
        });
    }
}

function toggleEmojiPicker() {
    document.getElementById('emoji-picker').classList.toggle('hidden');
}

function insertEmoji(emoji) {
    var input = document.getElementById('message-input');
    input.value += emoji;
    input.focus();
}

// Close emoji on outside click
document.addEventListener('click', function(e) {
    var picker = document.getElementById('emoji-picker');
    if (picker && !picker.classList.contains('hidden')) {
        if (!picker.contains(e.target) && !e.target.closest('.btn-icon')) {
            picker.classList.add('hidden');
        }
    }
});

// ESC to close modals
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});

function closeAllModals() {
    var modals = document.querySelectorAll('.modal');
    modals.forEach(function(m) { m.classList.add('hidden'); });
    document.getElementById('emoji-picker').classList.add('hidden');
}
