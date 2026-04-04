// ========================================
// KUKUMBER MESSENGER - MAIN APP
// ========================================

// Конфигурация Firebase (С ПРАВИЛЬНЫМ DATABASE URL ДЛЯ EUROPE)
const firebaseConfig = {
    apiKey: "AIzaSyBYNJPhbs8YaNAhdjSUIdj1Ok433N19GJM",
    authDomain: "kukumber-messenger.firebaseapp.com",
    databaseURL: "https://kukumber-messenger-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kukumber-messenger",
    storageBucket: "kukumber-messenger.firebasestorage.app",
    messagingSenderId: "738635892211",
    appId: "1:738635892211:web:4bf2a45b562d22e41b3e86",
    measurementId: "G-LNYKV37CHX"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Глобальные переменные
let currentUser = null;
let currentUserData = null;
let currentChatId = null;
let currentChatUser = null;
let messagesListener = null;
let typingTimeout = null;
let callTimer = null;
let callSeconds = 0;

// ========================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

window.addEventListener('load', () => {
    // Показать экран загрузки 2 секунды
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        checkAuthState();
    }, 2000);
});

// Проверка состояния авторизации
function checkAuthState() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserData();
            showMainScreen();
            updateOnlineStatus(true);
            initializePeer();
        } else {
            currentUser = null;
            currentUserData = null;
            showAuthScreen();
        }
    });
}

// ========================================
// ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
// ========================================

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
}

function showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    loadChats();
}

// ========================================
// ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
// ========================================

function loadUserData() {
    if (!currentUser) return;
    
    database.ref('users/' + currentUser.uid).on('value', snapshot => {
        currentUserData = snapshot.val();
        if (currentUserData) {
            document.getElementById('current-username').textContent = currentUserData.username || 'Пользователь';
            
            // Показать аватарку
            const avatarEl = document.getElementById('user-avatar');
            if (currentUserData.avatar) {
                avatarEl.style.backgroundImage = `url(${currentUserData.avatar})`;
                avatarEl.textContent = '';
            } else {
                avatarEl.style.backgroundImage = '';
                avatarEl.textContent = '🥒';
            }
        }
    });
}

// Обновление онлайн статуса
function updateOnlineStatus(online) {
    if (!currentUser) return;
    
    const userStatusRef = database.ref('users/' + currentUser.uid + '/status');
    
    userStatusRef.set({
        online: online,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    // При отключении
    if (online) {
        userStatusRef.onDisconnect().set({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }
}

// ========================================
// УТИЛИТЫ
// ========================================

// Форматирование времени
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Меньше минуты
    if (diff < 60000) return 'только что';
    
    // Меньше часа
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return mins + ' мин. назад';
    }
    
    // Сегодня
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'вчера ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Другие дни
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// Форматирование статуса
function formatStatus(status) {
    if (!status) return 'был(а) недавно';
    
    if (status.online) return 'в сети';
    
    if (status.lastSeen) {
        return 'был(а) ' + formatTime(status.lastSeen);
    }
    
    return 'был(а) недавно';
}

// Генерация ID чата
function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// УВЕДОМЛЕНИЯ
// ========================================

function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications-container');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    
    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Удалить через 4 секунды
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ========================================
// МОБИЛЬНАЯ АДАПТАЦИЯ
// ========================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
}

// Закрыть боковую панель при клике вне её
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    if (sidebar && sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && 
        menuBtn && !menuBtn.contains(e.target)) {
        closeSidebar();
    }
});
