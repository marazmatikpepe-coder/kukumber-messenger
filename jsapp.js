// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// Глобальные переменные
let currentUser = null;
let currentChatId = null;
let messagesListener = null;

// Инициализация приложения
window.addEventListener('load', () => {
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
        } else {
            showAuthScreen();
        }
    });
}

// Показать экран авторизации
function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
}

// Показать главный экран
function showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    loadChats();
    updateOnlineStatus(true);
}

// Загрузка данных пользователя
function loadUserData() {
    database.ref('users/' + currentUser.uid).once('value')
        .then(snapshot => {
            const userData = snapshot.val();
            if (userData) {
                document.getElementById('current-username').textContent = userData.username;
            }
        });
}

// Обновление онлайн статуса
function updateOnlineStatus(online) {
    if (currentUser) {
        const userStatusRef = database.ref('users/' + currentUser.uid + '/status');
        userStatusRef.set({
            online: online,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });

        // При отключении
        userStatusRef.onDisconnect().set({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }
}

// Форматирование времени
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин';
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// Генерация ID чата
function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Простое alert для примера, можно заменить на красивое уведомление
    alert(message);
}