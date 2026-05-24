// KUKUMBER MESSENGER - APP.JS (исправленный: поиск, настройки, профиль)
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
var isSuperAdmin = false;

// Принудительное скрытие загрузки через 3 секунды
setTimeout(function() {
    var loading = document.getElementById('loading-screen');
    if (loading) loading.style.display = 'none';
    var authScreen = document.getElementById('auth-screen');
    var mainScreen = document.getElementById('main-screen');
    
    if (currentUser && currentUserData) {
        if (authScreen) authScreen.classList.add('hidden');
        if (mainScreen) mainScreen.classList.remove('hidden');
    } else if (authScreen) {
        authScreen.classList.remove('hidden');
        if (mainScreen) mainScreen.classList.add('hidden');
    }
}, 3000);
window.addEventListener('load', function() {
    setTimeout(function() {
        var loading = document.getElementById('loading-screen');
        if (loading) loading.classList.add('hidden');
        checkAuthState();
    }, 1500);
    initEmojiPicker();
});

function checkAuthState() {
    console.log('checkAuthState вызвана');
    
    // Принудительно скрываем загрузку через 2 секунды в любом случае
    setTimeout(function() {
        var loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'none';
    }, 2000);
    
    auth.onAuthStateChanged(function(user) {
        console.log('onAuthStateChanged:', user ? user.uid : 'нет пользователя');
        
        var loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'none';
        
        if (user) {
            currentUser = user;
            loadUserData();
        } else {
            currentUser = null;
            currentUserData = null;
            var authScreen = document.getElementById('auth-screen');
            var mainScreen = document.getElementById('main-screen');
            if (authScreen) authScreen.classList.remove('hidden');
            if (mainScreen) mainScreen.classList.add('hidden');
        }
    });
}
function loadUserData() {
    console.log('loadUserData вызвана для:', currentUser.uid);
    
    if (!currentUser) return;
    
    database.ref('users/' + currentUser.uid).once('value').then(function(snapshot) {
        currentUserData = snapshot.val();
        console.log('Данные пользователя загружены:', currentUserData ? 'да' : 'нет');
        
        if (currentUserData) {
            updateUserDisplay();
            checkSuperAdmin();
            
            // Показываем главный экран
            var authScreen = document.getElementById('auth-screen');
            var mainScreen = document.getElementById('main-screen');
            if (authScreen) authScreen.classList.add('hidden');
            if (mainScreen) mainScreen.classList.remove('hidden');
            
            // Загружаем чаты
            if (typeof loadChats === 'function') {
                setTimeout(function() { loadChats(); }, 500);
            }
            
            // Загружаем слайсы
            setTimeout(function() {
                if (typeof loadSlices === 'function') loadSlices();
            }, 300);
            
            // Push-уведомления
            if (typeof requestNotificationPermission === 'function') {
                setTimeout(function() {
                    requestNotificationPermission();
                    setupForegroundMessages();
                }, 2000);
            }
        }
    }).catch(function(err) {
        console.error('Ошибка загрузки пользователя:', err);
        // Показываем экран входа при ошибке
        var authScreen = document.getElementById('auth-screen');
        var mainScreen = document.getElementById('main-screen');
        if (authScreen) authScreen.classList.remove('hidden');
        if (mainScreen) mainScreen.classList.add('hidden');
        var loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'none';
    });
}
function checkSuperAdmin() {
    database.ref('users/' + currentUser.uid + '/isSuperAdmin').once('value').then(function(snap) {
        isSuperAdmin = snap.val() === true;
        window.isSuperAdmin = isSuperAdmin;
    });
}
function updateUserDisplay() {
    if (!currentUserData) return;
    var username = currentUserData.username || 'Пользователь';
    var avatar = currentUserData.avatar || '';
    document.getElementById('current-username').textContent = username;
    document.getElementById('settings-username').textContent = username;
    
    // Функция для установки аватарки с дефолтом
    function setAvatar(element, avatarUrl, type) {
        if (!element) return;
        if (avatarUrl) {
            element.style.backgroundImage = 'url(' + avatarUrl + ')';
            element.style.backgroundSize = 'cover';
            element.textContent = '';
            element.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
        } else {
            element.style.backgroundImage = '';
            element.classList.add('default-avatar-' + type);
            element.textContent = '';
        }
    }
    
    setAvatar(document.getElementById('user-avatar'), avatar, 'user');
    setAvatar(document.getElementById('settings-avatar'), avatar, 'user');
    
    // Для Slices аватарки
    var slicesAvatar = document.getElementById('slices-user-avatar');
    if (slicesAvatar) {
        if (avatar) {
            slicesAvatar.style.backgroundImage = 'url(' + avatar + ')';
            slicesAvatar.style.backgroundSize = 'cover';
            slicesAvatar.textContent = '';
            slicesAvatar.classList.remove('default-avatar-user');
        } else {
            slicesAvatar.style.backgroundImage = '';
            slicesAvatar.classList.add('default-avatar-user');
            slicesAvatar.textContent = '';
        }
    }
}

function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
}

function showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    
    // Загружаем чаты
    if (typeof loadChats === 'function') {
        console.log('Загрузка чатов...');
        loadChats();
    } else {
        console.error('loadChats не определена');
    }
    
    // Загружаем слайсы
    setTimeout(function() {
        if (typeof loadSlices === 'function') {
            loadSlices();
        }
    }, 300);
}
function switchToTab(tabName) {
    currentTab = tabName;
    
    var tabs = ['chats', 'reels', 'settings'];
    tabs.forEach(function(tab) {
        var tabEl = document.getElementById(tab + '-tab');
        var navEl = document.getElementById('nav-' + tab);
        if (tabEl) tabEl.classList.add('hidden');
        if (navEl) navEl.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.getElementById('nav-' + tabName).classList.add('active');
    
    // ========== ОБНОВЛЕНИЕ ИКОНКИ НАСТРОЕК ПРИ ПЕРЕКЛЮЧЕНИИ ==========
    var settingsIcon = document.getElementById('settings-icon');
    if (settingsIcon) {
        if (tabName === 'settings') {
            // Активная вкладка - применяем цвет темы
            settingsIcon.style.filter = 'brightness(0) saturate(100%) invert(39%) sepia(93%) saturate(500%) hue-rotate(80deg)';
        } else if (document.body.classList.contains('night-mode')) {
            settingsIcon.style.filter = 'brightness(0.8) invert(1)';
        } else {
            settingsIcon.style.filter = 'brightness(0.3)';
        }
    }
    
    if (tabName === 'reels' && typeof loadSlices === 'function') loadSlices();
    if (tabName === 'chats' && typeof loadChats === 'function') loadChats();
    if (tabName === 'settings' && typeof updateUserDisplay === 'function') updateUserDisplay();
    
    closeSidebar();
}
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
}

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
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatLastSeen(timestamp) {
    if (!timestamp) return 'неизвестно';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' минут назад';
    if (diff < 86400) return 'сегодня в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    return date.toLocaleDateString('ru-RU') + ' в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
}

function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
}

function showNotification(message, type) {
    type = type || 'info';
    var container = document.getElementById('notifications-container');
    if (!container) return;
    var notif = document.createElement('div');
    notif.className = 'notification ' + type;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(function() { if (notif) notif.remove(); }, 3000);
}

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
    var picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.toggle('hidden');
}

function insertEmoji(emoji) {
    var input = document.getElementById('message-input');
    if (input) {
        input.value += emoji;
        input.focus();
    }
}

document.addEventListener('click', function(e) {
    var picker = document.getElementById('emoji-picker');
    if (picker && !picker.classList.contains('hidden') && !picker.contains(e.target) && !e.target.closest('.emoji-btn')) {
        picker.classList.add('hidden');
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAllModals();
});

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) {
        m.classList.add('hidden');
    });
    var picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.add('hidden');
}

// Функции для настроек (чтобы не падали ошибки)
//function showNotificationSettings() { showNotification('Уведомления: в разработке', 'info'); }
//function showPrivacySettings() { showNotification('Конфиденциальность: в разработке', 'info'); }
//function showThemeSettings() { showNotification('Тема: в разработке', 'info'); }
function showLanguageSettings() { 
    if (typeof window.showLanguageSettings === 'function') {
        window.showLanguageSettings();
    } else {
        showNotification('Язык: в разработке', 'info');
    }
}
function showStorageSettings() { showNotification('Данные и память: в разработке', 'info'); }
function showAbout() { alert('K Messenger v1.0\nСвежее общение каждый день 🥒'); }
function showHelp() { showNotification('Помощь: в разработке', 'info'); }
function logout() {
    if (!confirm('Вы уверены, что хотите выйти?')) return;
    if (messagesListener) messagesListener.off();
    auth.signOut().then(function() {
        currentUser = null;
        currentUserData = null;
        currentChatId = null;
        currentChatUser = null;
        showNotification('Вы вышли', 'info');
        location.reload(); // Принудительная перезагрузка
    }).catch(function() { 
        showNotification('Ошибка выхода', 'error'); 
    });
}
// ========== PUSH-УВЕДОМЛЕНИЯ ==========
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Браузер не поддерживает уведомления');
        return false;
    }
    
    if (!('serviceWorker' in navigator)) {
        console.log('Service Worker не поддерживается');
        return false;
    }
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.log('Разрешение на уведомления не получено');
        return false;
    }
    
    try {
        const messaging = firebase.messaging();
        
        // ========== ПОЛУЧАЕМ ПРАВИЛЬНЫЙ БАЗОВЫЙ ПУТЬ ==========
        // Автоматически определяем путь к приложению
        function getBasePath() {
            const path = window.location.pathname;
            // Если путь заканчивается на /Kukumber-messenger/ или содержит его
            if (path.includes('/Kukumber-messenger/')) {
                return '/Kukumber-messenger/';
            }
            // Если мы в корне репозитория
            if (path !== '/' && path !== '') {
                const parts = path.split('/');
                if (parts.length > 1) {
                    return '/' + parts[1] + '/';
                }
            }
            return '/';
        }
        
        const basePath = getBasePath();
        console.log('Базовый путь для SW:', basePath);
        
        // Получаем Service Worker регистрацию
        let registration;
        try {
            registration = await navigator.serviceWorker.ready;
            console.log('Service Worker уже готов:', registration.scope);
        } catch (e) {
            // Регистрируем с правильным путём
            console.log('Регистрируем Service Worker по пути:', basePath + 'firebase-messaging-sw.js');
            registration = await navigator.serviceWorker.register(basePath + 'firebase-messaging-sw.js');
            console.log('Service Worker зарегистрирован:', registration.scope);
        }
        
        // Получаем токен
        const token = await messaging.getToken({
            serviceWorkerRegistration: registration,
            vapidKey: 'BJSObaY_-k70LbjMB89bpLyBV9zL4KhzzwbRpyIHjT6pjjOM09S7xDagdlMnTV4XiISYklhrVZNk3HetaTuL5a4'
        });
        
        if (token) {
            console.log('✅ FCM Token получен:', token);
            
            // Сохраняем токен в базе
            if (currentUser && currentUser.uid) {
                await database.ref('users/' + currentUser.uid + '/fcmToken').set(token);
                console.log('✅ Токен сохранён в базе');
            }
            
            // Показываем тестовое уведомление
            setTimeout(() => {
                new Notification('✅ Уведомления включены!', {
                    body: 'Теперь вы будете получать уведомления о новых сообщениях',
                    icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png'
                });
            }, 1000);
            
            return true;
        }
    } catch (err) {
        console.error('❌ Ошибка получения токена:', err);
    }
    return false;
}

// Обработка уведомлений когда приложение открыто
function setupForegroundMessages() {
    const messaging = firebase.messaging();
    messaging.onMessage((payload) => {
        console.log('📨 Уведомление в активном окне:', payload);
        
        // Показываем уведомление даже если сайт открыт
        if (Notification.permission === 'granted') {
            new Notification(payload.notification?.title || 'K Messenger', {
                body: payload.notification?.body || 'Новое сообщение',
                icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png',
                badge: 'https://i.ibb.co/23pNfd0W/F449-F920-46-E7-4-E73-85-EF-26-CFF5-CAD938.jpg',
                vibrate: [200, 100, 200]
            });
        }
        
        // Также показываем в нашем контейнере
        if (payload.notification?.body) {
            showNotification(payload.notification.body, 'info');
        }
    });
}

// Вызови эти функции после входа пользователя
// Например, в loadUserData() добавь:
// requestNotificationPermission();
// setupForegroundMessages();
// ========== СВАЙПЫ МЕЖДУ ВКЛАДКАМИ ==========
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let isSwiping = false;

const tabs = ['chats', 'reels', 'settings'];
let currentTabIndex = 0;

function getCurrentTabIndex() {
    const activeTab = document.querySelector('.tab-content:not(.hidden)').id;
    return tabs.indexOf(activeTab.replace('-tab', ''));
}

function switchToTabBySwipe(direction) {
    let currentIdx = getCurrentTabIndex();
    let newIdx = currentIdx + direction;
    
    if (newIdx >= 0 && newIdx < tabs.length) {
        switchToTab(tabs[newIdx]);
    }
}

document.getElementById('main-screen').addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isSwiping = true;
}, { passive: true });

document.getElementById('main-screen').addEventListener('touchend', function(e) {
    if (!isSwiping) return;
    
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Горизонтальный свайп (игнорируем вертикальные)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
            // Свайп вправо → предыдущая вкладка
            switchToTabBySwipe(-1);
        } else {
            // Свайп влево → следующая вкладка
            switchToTabBySwipe(1);
        }
    }
    
    isSwiping = false;
}, { passive: true });
// ========== СВАЙП ДЛЯ ЗАКРЫТИЯ МОДАЛЬНЫХ ОКОН ==========
document.querySelectorAll('.modal').forEach(modal => {
    let modalStartY = 0;
    let modalCurrentY = 0;
    
    modal.addEventListener('touchstart', function(e) {
        modalStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    modal.addEventListener('touchend', function(e) {
        modalCurrentY = e.changedTouches[0].screenY;
        const deltaY = modalCurrentY - modalStartY;
        
        // Свайп вниз на 100px → закрыть
        if (deltaY > 100) {
            modal.classList.add('hidden');
            closeAllModals();
        }
    }, { passive: true });
});
// ========== СВАЙП ДЛЯ БОКОВОЙ ПАНЕЛИ ==========
let sidebarStartX = 0;
let sidebarEndX = 0;

document.getElementById('chat-area').addEventListener('touchstart', function(e) {
    sidebarStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.getElementById('chat-area').addEventListener('touchend', function(e) {
    sidebarEndX = e.changedTouches[0].screenX;
    const deltaX = sidebarEndX - sidebarStartX;
    
    // Свайп от левого края (первые 30px) вправо → открыть панель
    if (sidebarStartX < 30 && deltaX > 50) {
        openSidebar();
    }
    
    // Свайп влево при открытой панели → закрыть
    if (deltaX < -50) {
        closeSidebar();
    }
}, { passive: true });

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
}
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    sidebar.classList.toggle('open');
    
    // Скрываем/показываем кнопку меню при открытии панели
    if (sidebar.classList.contains('open')) {
        if (menuBtn) menuBtn.style.opacity = '0';
    } else {
        if (menuBtn) menuBtn.style.opacity = '1';
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    sidebar.classList.remove('open');
    if (menuBtn) menuBtn.style.opacity = '1';
}
// ========== СВАЙП ВЛЕВО ДЛЯ ЗАКРЫТИЯ ПАНЕЛИ ==========
const sidebarElement = document.getElementById('sidebar');
let sidebarSwipeStartX = 0;

sidebarElement.addEventListener('touchstart', function(e) {
    sidebarSwipeStartX = e.changedTouches[0].screenX;
}, { passive: true });

sidebarElement.addEventListener('touchend', function(e) {
    const sidebarSwipeEndX = e.changedTouches[0].screenX;
    const deltaX = sidebarSwipeEndX - sidebarSwipeStartX;
    
    // Свайп влево (отрицательный) — закрыть панель
    if (deltaX < -50) {
        closeSidebar();
    }
}, { passive: true });
// ===== ФИКС ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК =====
var originalSwitchToTab = window.switchToTab;
window.switchToTab = function(tabName) {
    document.getElementById('chats-tab').classList.add('hidden');
    document.getElementById('reels-tab').classList.add('hidden');
    document.getElementById('settings-tab').classList.add('hidden');
    
    document.getElementById('nav-chats').classList.remove('active');
    document.getElementById('nav-reels').classList.remove('active');
    document.getElementById('nav-settings').classList.remove('active');
    
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.getElementById('nav-' + tabName).classList.add('active');
    
    if (tabName === 'reels' && typeof loadSlices === 'function') loadSlices();
    if (tabName === 'chats' && typeof loadChats === 'function') loadChats();
    if (tabName === 'settings' && typeof updateUserDisplay === 'function') updateUserDisplay();
    
    closeSidebar();
};
// Глобальная функция для открытия профиля пользователя
window.openUserProfile = function(userId) {
    if (typeof openUserProfileFromChat === 'function') {
        openUserProfileFromChat(userId);
    } else if (typeof openUserProfile === 'function') {
        openUserProfile(userId);
    } else if (typeof window.openUserProfileModal === 'function') {
        window.openUserProfileModal(userId);
    } else {
        console.warn('Функция профиля не найдена, загружаем slices.js');
        if (typeof loadSlices === 'function') {
            showNotification('Профиль загружается...', 'info');
        }
    }
};
// ========== ПРИНУДИТЕЛЬНАЯ АВТОРИЗАЦИЯ ==========
// Перехватываем ошибки Firebase
window.addEventListener('load', function() {
    console.log('Страница загружена, проверяем авторизацию...');
    
    // Проверяем, есть ли сохранённая сессия
    setTimeout(function() {
        if (!currentUser) {
            console.log('Нет активного пользователя, проверяем Firebase...');
            
            // Пробуем получить текущего пользователя напрямую
            var firebaseUser = auth.currentUser;
            if (firebaseUser) {
                console.log('Найден пользователь через auth.currentUser:', firebaseUser.uid);
                currentUser = firebaseUser;
                loadUserData();
            } else {
                console.log('Пользователь не найден, показываем экран входа');
                showAuthScreen();
            }
        }
    }, 1000);
});

// Форсированная проверка каждые 2 секунды (на случай, если Firebase долго инициализируется)
var authCheckInterval = setInterval(function() {
    if (auth && auth.currentUser) {
        if (!currentUser) {
            console.log('Интервал: найден пользователь!', auth.currentUser.uid);
            currentUser = auth.currentUser;
            loadUserData();
            clearInterval(authCheckInterval);
        }
    } else if (document.getElementById('main-screen') && !document.getElementById('main-screen').classList.contains('hidden')) {
        // Если main-screen виден, но пользователя нет - показываем вход
        if (!currentUser && !auth.currentUser) {
            showAuthScreen();
        }
    }
}, 2000);

// Исправление входа
window.forceLogin = function(email, password) {
    console.log('Принудительный вход:', email);
    return auth.signInWithEmailAndPassword(email, password);
};

// Исправление регистрации
window.forceRegister = function(username, email, password) {
    console.log('Принудительная регистрация:', email);
    return auth.createUserWithEmailAndPassword(email, password).then(function(userCredential) {
        var user = userCredential.user;
        return database.ref('users/' + user.uid).set({
            username: username,
            email: email,
            avatar: '',
            bio: '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: { online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP }
        }).then(function() {
            return database.ref('usernames/' + username.toLowerCase()).set(user.uid);
        });
    });
};
// ========== PUSH-УВЕДОМЛЕНИЯ ==========
async function sendPushNotification(recipientId, title, body, chatId) {
    try {
        const tokenSnapshot = await database.ref('users/' + recipientId + '/fcmToken').once('value');
        const token = tokenSnapshot.val();
        
        if (!token) {
            console.log('Нет токена у пользователя', recipientId);
            return;
        }
        
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=AAAAvNcyvSU:APA91bE2G-ybuDgJLvKv2rJghVQVYOE74w3Jq6yLdgpQv9YGlJ__P21hUq70dMsQ15cBPG0OZ1-JnMj0v3c6K7OQthRdua2RkS5MQe5N2ypAt4ooScdrBWY5VrHD-K4pO-0SeWXh33MF'
            },
            body: JSON.stringify({
                to: token,
                notification: {
                    title: title,
                    body: body,
                    icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png',
                    badge: 'https://i.ibb.co/23pNfd0W/F449-F920-46-E7-4-E73-85-EF-26-CFF5-CAD938.jpg',
                    vibrate: [200, 100, 200],
                    sound: 'default'
                },
                data: {
                    chatId: chatId,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                }
            })
        });
        
        const data = await response.json();
        console.log('Push отправлен:', data);
        
    } catch (err) {
        console.error('Ошибка отправки push:', err);
    }
}
// ========== НОВАЯ ВКЛАДКА "ПЕРЕПИСКИ" ==========
(function() {
    console.log('Переписки: инициализация');
    
    // Переменные
    let currentMessagesChatId = null;
    let currentMessagesChatData = null;
    let messagesListener = null;
    let messagesLoadedIds = new Set();
    
    // Кэш пользователей
    let messagesUserCache = {};
    
    // ========== ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ==========
    async function getMessagesUserData(userId) {
        if (messagesUserCache[userId]) return messagesUserCache[userId];
        
        try {
            const snapshot = await database.ref('users/' + userId).once('value');
            const data = snapshot.val();
            if (data) {
                messagesUserCache[userId] = {
                    username: data.username || 'Пользователь',
                    avatar: data.avatar || '',
                    status: data.status || { online: false }
                };
                return messagesUserCache[userId];
            }
        } catch(e) {}
        return { username: 'Пользователь', avatar: '', status: { online: false } };
    }
    
    // ========== ЗАГРУЗКА СПИСКА ЧАТОВ ==========
    async function loadMessagesChats() {
        const container = document.getElementById('messages-chats-list');
        if (!container) return;
        
        if (!currentUser || !currentUser.uid) {
            container.innerHTML = '<div class="messages-empty">🔐 Войдите в аккаунт</div>';
            return;
        }
        
        container.innerHTML = '<div class="messages-empty">🔄 Загрузка...</div>';
        
        try {
            const userChatsSnap = await database.ref('userChats/' + currentUser.uid).once('value');
            const userChats = userChatsSnap.val();
            
            if (!userChats || Object.keys(userChats).length === 0) {
                container.innerHTML = '<div class="messages-empty">💬 Нет чатов. Начните диалог!</div>';
                return;
            }
            
            const chatIds = Object.keys(userChats);
            const chatsArray = [];
            
            for (const chatId of chatIds) {
                const chatSnap = await database.ref('chats/' + chatId).once('value');
                const chat = chatSnap.val();
                if (chat) {
                    chatsArray.push({ id: chatId, data: chat });
                }
            }
            
            // Сортировка по времени последнего сообщения
            chatsArray.sort((a, b) => (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0));
            
            container.innerHTML = '';
            
            for (const chat of chatsArray) {
                const chatElement = await createMessagesChatItem(chat.id, chat.data);
                container.appendChild(chatElement);
            }
            
        } catch (err) {
            console.error('Ошибка загрузки чатов:', err);
            container.innerHTML = '<div class="messages-empty">❌ Ошибка загрузки</div>';
        }
    }
    
    // ========== СОЗДАНИЕ ЭЛЕМЕНТА ЧАТА ==========
    async function createMessagesChatItem(chatId, chatData) {
        const div = document.createElement('div');
        div.className = 'messages-chat-item';
        div.setAttribute('data-chat-id', chatId);
        
        let name = '';
        let avatarContent = '';
        let avatarStyle = '';
        let preview = chatData.lastMessage || 'Нет сообщений';
        let time = chatData.lastMessageTime ? formatMessageTime(chatData.lastMessageTime) : '';
        
        if (preview && preview.length > 50) preview = preview.substring(0, 47) + '...';
        
        if (chatData.type === 'group') {
            name = chatData.name || 'Группа';
            avatarContent = '';
            if (chatData.avatar) avatarStyle = `background-image: url(${chatData.avatar}); background-size: cover;`;
        } 
        else if (chatData.type === 'channel') {
            name = chatData.name || 'Канал';
            avatarContent = '';
            if (chatData.avatar) avatarStyle = `background-image: url(${chatData.avatar}); background-size: cover;`;
        }
        else {
            // Личный чат
            let otherUserId = null;
            if (chatData.participants) {
                for (const uid of chatData.participants) {
                    if (uid !== currentUser.uid) {
                        otherUserId = uid;
                        break;
                    }
                }
            }
            
            if (otherUserId) {
                const userData = await getMessagesUserData(otherUserId);
                name = userData.username;
                if (userData.avatar) {
                    avatarStyle = `background-image: url(${userData.avatar}); background-size: cover;`;
                    avatarContent = '';
                }
            } else {
                name = 'Пользователь';
            }
        }
        
        div.innerHTML = `
            <div class="messages-chat-avatar-small" style="${avatarStyle}">${avatarContent}</div>
            <div class="messages-chat-info">
                <div class="messages-chat-name">${escapeHtml(name)}</div>
                <div class="messages-chat-preview">${escapeHtml(preview)}</div>
            </div>
            <div class="messages-chat-time">${time}</div>
        `;
        
        div.onclick = () => openMessagesChat(chatId, chatData);
        
        return div;
    }
    
    // ========== ОТКРЫТИЕ ЧАТА ==========
    async function openMessagesChat(chatId, chatData) {
        console.log('Открытие чата:', chatId);
        
        currentMessagesChatId = chatId;
        currentMessagesChatData = chatData;
        currentMessagesChatData.chatId = chatId;
        
        // Устанавливаем otherUserId для личных чатов
        if (chatData.type === 'private' && chatData.participants) {
            for (const uid of chatData.participants) {
                if (uid !== currentUser.uid) {
                    currentMessagesChatData.otherUserId = uid;
                    break;
                }
            }
        }
        
        // Обновляем активный класс в списке
        document.querySelectorAll('.messages-chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-chat-id') === chatId) {
                item.classList.add('active');
            }
        });
        
        // Показываем область чата
        const noChat = document.getElementById('messages-no-chat');
        const activeChat = document.getElementById('messages-active-chat');
        
        if (noChat) noChat.style.display = 'none';
        if (activeChat) activeChat.style.display = 'flex';
        
        // Обновляем шапку
        await updateMessagesHeader(chatId, chatData);
        
        // Загружаем сообщения
        loadMessagesChat(chatId);
        
        // На мобильных закрываем боковую панель
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.messages-sidebar');
            if (sidebar) sidebar.classList.remove('open');
        }
    }
    
    // ========== ОБНОВЛЕНИЕ ШАПКИ ==========
    async function updateMessagesHeader(chatId, chatData) {
        const nameEl = document.getElementById('messages-chat-name');
        const statusEl = document.getElementById('messages-chat-status');
        const avatarEl = document.getElementById('messages-chat-avatar');
        
        if (!nameEl) return;
        
        // Сбрасываем
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = '';
        avatarEl.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
        
        if (chatData.type === 'group') {
            nameEl.textContent = chatData.name || 'Группа';
            statusEl.textContent = chatData.members ? Object.keys(chatData.members).length + ' участников' : 'группа';
            if (chatData.avatar) {
                avatarEl.style.backgroundImage = `url(${chatData.avatar})`;
                avatarEl.style.backgroundSize = 'cover';
            } else {
                avatarEl.textContent = '';
                avatarEl.classList.add('default-avatar-group');
            }
        } 
        else if (chatData.type === 'channel') {
            nameEl.textContent = chatData.name || 'Канал';
            statusEl.textContent = chatData.subscribers ? Object.keys(chatData.subscribers).length + ' подписчиков' : 'канал';
            if (chatData.avatar) {
                avatarEl.style.backgroundImage = `url(${chatData.avatar})`;
                avatarEl.style.backgroundSize = 'cover';
            } else {
                avatarEl.textContent = '';
                avatarEl.classList.add('default-avatar-channel');
            }
        }
        else {
            // Личный чат
            const otherUserId = currentMessagesChatData.otherUserId;
            if (otherUserId) {
                const userData = await getMessagesUserData(otherUserId);
                nameEl.textContent = userData.username;
                if (userData.status.online) {
                    statusEl.textContent = 'в сети';
                } else {
                    statusEl.textContent = formatMessageLastSeen(userData.status.lastSeen);
                }
                if (userData.avatar) {
                    avatarEl.style.backgroundImage = `url(${userData.avatar})`;
                    avatarEl.style.backgroundSize = 'cover';
                } else {
                    avatarEl.textContent = '';
                    avatarEl.classList.add('default-avatar-user');
                }
            }
        }
        
        // Настраиваем клик по шапке
        const userInfo = document.getElementById('messages-chat-user-info');
        if (userInfo) {
            userInfo.onclick = () => openMessagesProfile();
        }
    }
    
    // ========== ОТКРЫТИЕ ПРОФИЛЯ ==========
    function openMessagesProfile() {
        if (!currentMessagesChatData) return;
        
        if (currentMessagesChatData.type === 'private' && currentMessagesChatData.otherUserId) {
            if (typeof window.openUserProfile === 'function') {
                window.openUserProfile(currentMessagesChatData.otherUserId);
            }
        } else if (currentMessagesChatData.type === 'group') {
            if (typeof window.openGroupProfile === 'function') {
                window.openGroupProfile(currentMessagesChatId);
            }
        } else if (currentMessagesChatData.type === 'channel') {
            if (typeof window.openChannelProfile === 'function') {
                window.openChannelProfile(currentMessagesChatId);
            }
        }
    }
    
    // ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
    function loadMessagesChat(chatId) {
        const container = document.getElementById('messages-container');
        if (!container) return;
        
        container.innerHTML = '';
        messagesLoadedIds.clear();
        
        if (messagesListener) {
            messagesListener.off();
        }
        
        messagesListener = database.ref('messages/' + chatId)
            .orderByChild('timestamp')
            .limitToLast(50);
        
        messagesListener.on('child_added', (snapshot) => {
            const message = snapshot.val();
            const messageId = snapshot.key;
            
            if (messagesLoadedIds.has(messageId)) return;
            messagesLoadedIds.add(messageId);
            
            message.id = messageId;
            appendMessagesMessage(message);
        });
        
        messagesListener.on('child_removed', (snapshot) => {
            const msgElement = document.querySelector(`.messages-message[data-message-id="${snapshot.key}"]`);
            if (msgElement) msgElement.remove();
            messagesLoadedIds.delete(snapshot.key);
        });
    }
    
    // ========== ДОБАВЛЕНИЕ СООБЩЕНИЯ ==========
    function appendMessagesMessage(message) {
        const container = document.getElementById('messages-container');
        if (!container) return;
        
        const isSent = message.senderId === currentUser.uid;
        const messageDiv = document.createElement('div');
        messageDiv.className = `messages-message ${isSent ? 'sent' : 'received'}`;
        messageDiv.setAttribute('data-message-id', message.id);
        
        let content = '';
        
        if (message.type === 'image') {
            content = `<img src="${message.imageUrl}" style="max-width: 200px; max-height: 200px; border-radius: 12px;">`;
            if (message.caption) content += `<div class="messages-message-text" style="margin-top: 5px;">${escapeHtml(message.caption)}</div>`;
        } 
        else if (message.type === 'gif') {
            content = `<img src="${message.gifUrl}" style="max-width: 200px; border-radius: 12px;"><span style="font-size: 10px; margin-left: 5px;">GIF</span>`;
        }
        else if (message.type === 'audio') {
            content = `<div>🎤 Голосовое сообщение ${message.duration ? '(' + message.duration + ' сек)' : ''}</div>`;
        }
        else if (message.type === 'file') {
            content = `<div>📎 <a href="${message.fileUrl}" target="_blank" style="color: inherit;">${escapeHtml(message.fileName)}</a></div>`;
        }
        else {
            content = `<div class="messages-message-text">${escapeHtml(message.text || '')}</div>`;
        }
        
        const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
        
        messageDiv.innerHTML = `
            ${content}
            <div class="messages-message-time">${time}</div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }
    
    // ========== ОТПРАВКА СООБЩЕНИЯ ==========
    async function sendMessagesMessage() {
        const input = document.getElementById('messages-input');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text || !currentMessagesChatId) return;
        
        const message = {
            type: 'text',
            text: text,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        input.value = '';
        
        try {
            await database.ref('messages/' + currentMessagesChatId).push(message);
            
            const shortText = text.length > 50 ? text.substring(0, 47) + '...' : text;
            await database.ref('chats/' + currentMessagesChatId).update({
                lastMessage: shortText,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Обновляем список чатов
            loadMessagesChats();
            
        } catch (err) {
            console.error('Ошибка отправки:', err);
            showNotification('Ошибка отправки', 'error');
            input.value = text;
        }
    }
    
    // ========== ПОИСК ==========
    let searchTimeout = null;
    
    function setupMessagesSearch() {
        const searchInput = document.getElementById('messages-search-input');
        if (!searchInput) return;
        
        searchInput.oninput = function() {
            const query = this.value.trim().toLowerCase();
            
            if (searchTimeout) clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(() => {
                filterMessagesChats(query);
            }, 300);
        };
    }
    
    async function filterMessagesChats(query) {
        const items = document.querySelectorAll('.messages-chat-item');
        
        if (!query || query.length < 2) {
            items.forEach(item => item.style.display = 'flex');
            return;
        }
        
        // Поиск по всем чатам
        for (const item of items) {
            const chatId = item.getAttribute('data-chat-id');
            const chatSnap = await database.ref('chats/' + chatId).once('value');
            const chat = chatSnap.val();
            
            let match = false;
            
            if (chat.type === 'group') {
                match = chat.name?.toLowerCase().includes(query);
            } 
            else if (chat.type === 'channel') {
                match = chat.name?.toLowerCase().includes(query) || 
                        (chat.kname && chat.kname.toLowerCase().includes(query.replace('@', '')));
            }
            else {
                // Личный чат - ищем по username или userTag
                let otherUserId = null;
                if (chat.participants) {
                    for (const uid of chat.participants) {
                        if (uid !== currentUser.uid) {
                            otherUserId = uid;
                            break;
                        }
                    }
                }
                if (otherUserId) {
                    const userData = await getMessagesUserData(otherUserId);
                    match = userData.username?.toLowerCase().includes(query) ||
                            (userData.userTag && userData.userTag.toLowerCase().includes(query.replace('@', '')));
                }
            }
            
            item.style.display = match ? 'flex' : 'none';
        }
    }
    
    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function formatMessageTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'сейчас';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' мин';
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }
    
    function formatMessageLastSeen(timestamp) {
        if (!timestamp) return 'неизвестно';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'только что';
        if (diff < 3600) return Math.floor(diff / 60) + ' минут назад';
        if (diff < 86400) return 'сегодня в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('ru-RU') + ' в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function showNotification(message, type) {
        const container = document.getElementById('notifications-container');
        if (!container) return;
        const notif = document.createElement('div');
        notif.className = 'notification ' + type;
        notif.textContent = message;
        container.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
    
    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    function initMessagesTab() {
        console.log('Инициализация вкладки Переписки');
        
        // Привязываем обработчики
        const sendBtn = document.getElementById('messages-send-btn');
        const messageInput = document.getElementById('messages-input');
        const attachBtn = document.getElementById('messages-attach-btn');
        
        if (sendBtn) sendBtn.onclick = sendMessagesMessage;
        if (messageInput) messageInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessagesMessage();
            }
        };
        if (attachBtn) {
            attachBtn.onclick = () => {
                showNotification('Прикрепление файлов скоро будет доступно', 'info');
            };
        }
        
        setupMessagesSearch();
        
        // Загружаем чаты
        setTimeout(() => {
            loadMessagesChats();
        }, 500);
    }
    
    // Перехватываем переключение на вкладку
    const originalSwitchToTab = window.switchToTab;
    window.switchToTab = function(tabName) {
        if (tabName === 'messages') {
            setTimeout(() => {
                initMessagesTab();
            }, 100);
        }
        if (originalSwitchToTab) originalSwitchToTab(tabName);
    };
    
    // Если уже на вкладке при загрузке
    setTimeout(() => {
        const messagesTab = document.getElementById('messages-tab');
        if (messagesTab && !messagesTab.classList.contains('hidden') && currentUser) {
            initMessagesTab();
        }
    }, 1500);
    
    // Экспортируем функции
    window.loadMessagesChats = loadMessagesChats;
    window.openMessagesChat = openMessagesChat;
    
    console.log('Переписки: готово');
})();
// Функция для открытия/закрытия боковой панели в Переписках на мобильных
window.toggleMessagesSidebar = function() {
    var sidebar = document.querySelector('#messages-tab .messages-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
};

// Закрывать панель при выборе чата на мобильных
window.closeMessagesSidebar = function() {
    var sidebar = document.querySelector('#messages-tab .messages-sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }
};
// ========== ПРОСТАЯ И НАДЁЖНАЯ ВКЛАДКА "ПЕРЕПИСКИ" ==========
(function() {
    console.log('🔥 Переписки: простая версия загружается');
    
    let currentChat = null;
    let msgListener = null;
    let loadedMsgIds = new Set();

    // Загрузка списка чатов
    window.loadMessagesChats = async function() {
        const container = document.getElementById('messages-chats-list');
        if (!container) return;
        if (!currentUser || !currentUser.uid) {
            container.innerHTML = '<div class="messages-empty">🔐 Войдите в аккаунт</div>';
            return;
        }
        
        container.innerHTML = '<div class="messages-empty">🔄 Загрузка чатов...</div>';
        
        try {
            // Получаем чаты пользователя
            const userChatsSnap = await database.ref('userChats/' + currentUser.uid).once('value');
            const userChats = userChatsSnap.val();
            
            if (!userChats || Object.keys(userChats).length === 0) {
                container.innerHTML = '<div class="messages-empty">💬 Нет чатов</div>';
                return;
            }
            
            const chatIds = Object.keys(userChats);
            const chats = [];
            
            for (const chatId of chatIds) {
                const chatSnap = await database.ref('chats/' + chatId).once('value');
                const chat = chatSnap.val();
                if (chat) {
                    chats.push({ id: chatId, data: chat });
                }
            }
            
            // Сортируем по времени последнего сообщения
            chats.sort((a, b) => (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0));
            
            container.innerHTML = '';
            
            for (const chat of chats) {
                const item = document.createElement('div');
                item.className = 'messages-chat-item';
                item.setAttribute('data-chat-id', chat.id);
                
                let name = 'Чат';
                let avatarHtml = '💬';
                let preview = chat.data.lastMessage || 'Нет сообщений';
                let time = '';
                
                if (chat.data.lastMessageTime) {
                    const d = new Date(chat.data.lastMessageTime);
                    time = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                }
                
                if (preview.length > 40) preview = preview.substring(0, 37) + '...';
                
                // Определяем тип чата
                if (chat.data.type === 'group') {
                    name = chat.data.name || 'Группа';
                    avatarHtml = '';
                } 
                else if (chat.data.type === 'channel') {
                    name = chat.data.name || 'Канал';
                    avatarHtml = '';
                }
                else {
                    // Личный чат - ищем имя собеседника
                    let otherId = null;
                    if (chat.data.participants) {
                        for (const uid of chat.data.participants) {
                            if (uid !== currentUser.uid) {
                                otherId = uid;
                                break;
                            }
                        }
                    }
                    if (otherId) {
                        const userSnap = await database.ref('users/' + otherId + '/username').once('value');
                        name = userSnap.val() || 'Пользователь';
                        avatarHtml = '';
                    }
                }
                
                item.innerHTML = `
                    <div class="messages-chat-avatar-small">${avatarHtml}</div>
                    <div class="messages-chat-info">
                        <div class="messages-chat-name">${escapeHtml2(name)}</div>
                        <div class="messages-chat-preview">${escapeHtml2(preview)}</div>
                    </div>
                    <div class="messages-chat-time">${time}</div>
                `;
                
                item.onclick = (function(id, data) {
                    return function() { openMessageChat(id, data); };
                })(chat.id, chat.data);
                
                container.appendChild(item);
            }
            
        } catch (err) {
            console.error('Ошибка:', err);
            container.innerHTML = '<div class="messages-empty">❌ Ошибка загрузки</div>';
        }
    };
    
    // Открытие чата
    window.openMessageChat = async function(chatId, chatData) {
        console.log('Открываем чат:', chatId, chatData.type);
        
        currentChat = { id: chatId, data: chatData };
        
        // Обновляем активный класс
        document.querySelectorAll('.messages-chat-item').forEach(el => {
            el.classList.remove('active');
            if (el.getAttribute('data-chat-id') === chatId) {
                el.classList.add('active');
            }
        });
        
        // Показываем область чата
        const noChat = document.getElementById('messages-no-chat');
        const activeChat = document.getElementById('messages-active-chat');
        if (noChat) noChat.style.display = 'none';
        if (activeChat) activeChat.style.display = 'flex';
        
        // Обновляем шапку
        await updateChatHeader2(chatId, chatData);
        
        // Загружаем сообщения
        loadMessages2(chatId);
        
        // Закрываем sidebar на мобильных
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('messages-sidebar');
            if (sidebar) sidebar.classList.remove('open');
        }
    };
    
    // Обновление шапки
    async function updateChatHeader2(chatId, chatData) {
        const nameEl = document.getElementById('messages-chat-name');
        const statusEl = document.getElementById('messages-chat-status');
        const avatarEl = document.getElementById('messages-chat-avatar');
        
        if (!nameEl) return;
        
        if (chatData.type === 'group') {
            nameEl.textContent = chatData.name || 'Группа';
            statusEl.textContent = 'группа';
            avatarEl.textContent = '';
        } 
        else if (chatData.type === 'channel') {
            nameEl.textContent = chatData.name || 'Канал';
            statusEl.textContent = 'канал';
            avatarEl.textContent = '';
        }
        else {
            // Личный чат
            let otherId = null;
            if (chatData.participants) {
                for (const uid of chatData.participants) {
                    if (uid !== currentUser.uid) {
                        otherId = uid;
                        break;
                    }
                }
            }
            if (otherId) {
                const userSnap = await database.ref('users/' + otherId).once('value');
                const userData = userSnap.val();
                nameEl.textContent = userData?.username || 'Пользователь';
                statusEl.textContent = userData?.status?.online ? 'в сети' : 'не в сети';
                avatarEl.textContent = '';
                if (userData?.avatar) {
                    avatarEl.style.backgroundImage = `url(${userData.avatar})`;
                    avatarEl.style.backgroundSize = 'cover';
                    avatarEl.textContent = '';
                }
            }
        }
        
        // Клик по шапке
        const userInfo = document.getElementById('messages-chat-user-info');
        if (userInfo) {
            userInfo.onclick = () => {
                if (chatData.type === 'private' && currentChat?.data?.otherUserId) {
                    if (typeof window.openUserProfile === 'function') {
                        window.openUserProfile(currentChat.data.otherUserId);
                    }
                }
            };
        }
    }
    
    // Загрузка сообщений
    function loadMessages2(chatId) {
        const container = document.getElementById('messages-container');
        if (!container) return;
        
        container.innerHTML = '';
        loadedMsgIds.clear();
        
        if (msgListener) msgListener.off();
        
        msgListener = database.ref('messages/' + chatId)
            .orderByChild('timestamp')
            .limitToLast(50);
        
        msgListener.on('child_added', (snapshot) => {
            const msg = snapshot.val();
            const msgId = snapshot.key;
            
            if (loadedMsgIds.has(msgId)) return;
            loadedMsgIds.add(msgId);
            
            msg.id = msgId;
            appendMessage2(msg);
        });
    }
    
    // Добавление сообщения
    function appendMessage2(msg) {
        const container = document.getElementById('messages-container');
        if (!container) return;
        
        const isSent = msg.senderId === currentUser?.uid;
        const div = document.createElement('div');
        div.className = `messages-message ${isSent ? 'sent' : 'received'}`;
        
        let content = '';
        if (msg.type === 'text' || !msg.type) {
            content = `<div class="messages-message-text">${escapeHtml2(msg.text || '')}</div>`;
        } else if (msg.type === 'image') {
            content = `<img src="${msg.imageUrl}" style="max-width:200px; border-radius:12px;">`;
        } else if (msg.type === 'gif') {
            content = `<img src="${msg.gifUrl}" style="max-width:200px; border-radius:12px;"><span style="font-size:10px;">GIF</span>`;
        } else {
            content = `<div class="messages-message-text">📎 ${msg.type}</div>`;
        }
        
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
        
        div.innerHTML = `${content}<div class="messages-message-time">${time}</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
    
    // Отправка сообщения
    window.sendMessagesMessage = async function() {
        const input = document.getElementById('messages-input');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text || !currentChat) return;
        
        const msg = {
            type: 'text',
            text: text,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        input.value = '';
        
        try {
            await database.ref('messages/' + currentChat.id).push(msg);
            
            const shortText = text.length > 50 ? text.substring(0, 47) + '...' : text;
            await database.ref('chats/' + currentChat.id).update({
                lastMessage: shortText,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Обновляем список чатов
            window.loadMessagesChats();
            
        } catch (err) {
            console.error('Ошибка:', err);
            showNotification2('Ошибка отправки', 'error');
            input.value = text;
        }
    };
    
    // Поиск
    let searchTimeout2 = null;
    function setupSearch2() {
        const input = document.getElementById('messages-search-input');
        if (!input) return;
        input.oninput = async function() {
            const query = this.value.trim().toLowerCase();
            if (searchTimeout2) clearTimeout(searchTimeout2);
            searchTimeout2 = setTimeout(async () => {
                const items = document.querySelectorAll('.messages-chat-item');
                if (!query || query.length < 2) {
                    items.forEach(i => i.style.display = 'flex');
                    return;
                }
                for (const item of items) {
                    const nameEl = item.querySelector('.messages-chat-name');
                    const name = nameEl?.textContent?.toLowerCase() || '';
                    item.style.display = name.includes(query) ? 'flex' : 'none';
                }
            }, 300);
        };
    }
    
    function escapeHtml2(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function showNotification2(msg, type) {
        const container = document.getElementById('notifications-container');
        if (!container) return;
        const notif = document.createElement('div');
        notif.className = 'notification ' + type;
        notif.textContent = msg;
        container.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
    
    // Инициализация
    function initMessages2() {
        console.log('Инициализация Переписок');
        const sendBtn = document.getElementById('messages-send-btn');
        const msgInput = document.getElementById('messages-input');
        
        if (sendBtn) sendBtn.onclick = () => window.sendMessagesMessage();
        if (msgInput) {
            msgInput.onkeypress = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.sendMessagesMessage();
                }
            };
        }
        
        setupSearch2();
        window.loadMessagesChats();
    }
    
    // Перехват переключения вкладки
    const origSwitch = window.switchToTab;
    window.switchToTab = function(tabName) {
        if (tabName === 'messages') {
            setTimeout(() => initMessages2(), 100);
        }
        if (origSwitch) origSwitch(tabName);
    };
    
    // Если уже на вкладке
    setTimeout(() => {
        const tab = document.getElementById('messages-tab');
        if (tab && !tab.classList.contains('hidden') && currentUser) {
            initMessages2();
        }
    }, 1500);
})();

// Функции для мобильной версии
window.toggleMessagesSidebar = function() {
    const sidebar = document.getElementById('messages-sidebar');
    if (sidebar) sidebar.classList.toggle('open');
};
// ===== ЖЕСТКИЙ ФИКС: ПРИНУДИТЕЛЬНОЕ СКРЫТИЕ ВКЛАДКИ ПЕРЕПИСКИ =====
(function() {
    // Сохраняем оригинальную функцию
    const originalSwitchToTab = window.switchToTab;
    
    // Переопределяем функцию переключения вкладок
    window.switchToTab = function(tabName) {
        console.log('Переключение на вкладку:', tabName);
        
        // СКРЫВАЕМ ВСЕ ВКЛАДКИ ПРИНУДИТЕЛЬНО
        const allTabs = ['chats-tab', 'messages-tab', 'reels-tab', 'settings-tab'];
        for (let i = 0; i < allTabs.length; i++) {
            const tab = document.getElementById(allTabs[i]);
            if (tab) {
                tab.style.display = 'none';
                tab.classList.add('hidden');
            }
        }
        
        // ПОКАЗЫВАЕМ НУЖНУЮ ВКЛАДКУ
        const activeTab = document.getElementById(tabName + '-tab');
        if (activeTab) {
            activeTab.style.display = '';
            activeTab.classList.remove('hidden');
        }
        
        // Обновляем активный класс в навигации
        const navButtons = ['nav-chats', 'nav-messages', 'nav-reels', 'nav-settings'];
        for (let i = 0; i < navButtons.length; i++) {
            const btn = document.getElementById(navButtons[i]);
            if (btn) btn.classList.remove('active');
        }
        const activeBtn = document.getElementById('nav-' + tabName);
        if (activeBtn) activeBtn.classList.add('active');
        
        // Загружаем данные
        if (tabName === 'reels' && typeof loadSlices === 'function') loadSlices();
        if (tabName === 'chats' && typeof loadChats === 'function') loadChats();
        if (tabName === 'messages' && typeof window.loadMessagesChats === 'function') {
            setTimeout(() => window.loadMessagesChats(), 100);
        }
        
        // Закрываем боковую панель
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        
        // ДОПОЛНИТЕЛЬНО: принудительно скрываем messages-sidebar если он открыт
        const msgSidebar = document.getElementById('messages-sidebar');
        if (msgSidebar) msgSidebar.classList.remove('open');
    };
    
    // Также добавляем обработчик на все кнопки навигации для надежности
    setTimeout(() => {
        const btns = document.querySelectorAll('.bottom-nav .nav-item');
        btns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                // Небольшая задержка для гарантии
                setTimeout(() => {
                    const messagesTab = document.getElementById('messages-tab');
                    if (messagesTab && window.currentTab !== 'messages') {
                        messagesTab.style.display = 'none';
                        messagesTab.classList.add('hidden');
                    }
                }, 10);
            });
        });
    }, 1000);
})();
// ========== ГЛОБАЛЬНЫЙ ПОИСК ==========
window.searchGlobalNew = async function() {
    const query = document.getElementById('global-search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('global-search-results');
    const resultsList = document.getElementById('search-results-list');
    
    if (!query || query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    resultsContainer.style.display = 'block';
    resultsList.innerHTML = '<div style="padding:20px;text-align:center;">🔍 Поиск...</div>';
    
    try {
        const usersSnap = await database.ref('users').once('value');
        const users = usersSnap.val();
        const results = [];
        
        for (const uid in users) {
            if (uid === currentUser?.uid) continue;
            const user = users[uid];
            const username = (user.username || '').toLowerCase();
            const userTag = (user.userTag || '').toLowerCase();
            
            if (username.includes(query) || userTag.includes(query)) {
                results.push({ uid, ...user });
            }
            if (results.length >= 20) break;
        }
        
        if (results.length === 0) {
            resultsList.innerHTML = '<div style="padding:20px;text-align:center;">👻 Ничего не найдено</div>';
            return;
        }
        
        resultsList.innerHTML = '';
        results.forEach(user => {
            const avatarUrl = user.avatar || '';
            const avatarStyle = avatarUrl ? `background-image:url(${avatarUrl});background-size:cover;` : '';
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-avatar" style="${avatarStyle}">${avatarUrl ? '' : '👤'}</div>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(user.username)}</div>
                    <div class="search-result-username">${user.userTag || '@' + user.username.toLowerCase()}</div>
                </div>
                <div class="search-result-badge">💬</div>
            `;
            item.onclick = () => startPrivateChatFromGlobalSearch(user.uid);
            resultsList.appendChild(item);
        });
    } catch(err) {
        console.error('Ошибка поиска:', err);
        resultsList.innerHTML = '<div style="padding:20px;text-align:center;">❌ Ошибка</div>';
    }
};

window.closeSearchResults = function() {
    document.getElementById('global-search-results').style.display = 'none';
    document.getElementById('global-search-input').value = '';
};

async function startPrivateChatFromGlobalSearch(userId) {
    closeSearchResults();
    
    const chatId = currentUser.uid < userId ? currentUser.uid + '_' + userId : userId + '_' + currentUser.uid;
    const chatSnap = await database.ref('chats/' + chatId).once('value');
    
    if (!chatSnap.exists()) {
        await database.ref('chats/' + chatId).set({
            type: 'private',
            participants: [currentUser.uid, userId],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Чат создан',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        await database.ref('userChats/' + userId + '/' + chatId).set(true);
    }
    
    if (typeof switchToTab === 'function') switchToTab('chats');
    setTimeout(() => { if (typeof openChatById === 'function') openChatById(chatId); }, 300);
}
// ========== КНОПКА ПЛЮС И СОЗДАНИЕ ==========
window.openCreateMenu = function() {
    const modal = document.getElementById('create-menu-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeCreateMenu = function() {
    const modal = document.getElementById('create-menu-modal');
    if (modal) modal.classList.add('hidden');
};

window.openNewChatFromMenu = function() {
    closeCreateMenu();
    showNewChatDialog();
};

function showNewChatDialog() {
    const modalHtml = `
        <div id="new-chat-dialog" class="modal" style="z-index:10050;">
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3>💬 Новый чат</h3>
                    <button onclick="closeNewChatDialog()" class="btn-close">×</button>
                </div>
                <div style="padding:20px;">
                    <input type="text" id="new-chat-search" placeholder="🔍 Поиск пользователей..." style="width:100%; padding:12px; border:2px solid var(--border); border-radius:30px;">
                    <div id="new-chat-results" style="margin-top:15px; max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
        </div>
    `;
    
    const old = document.getElementById('new-chat-dialog');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('new-chat-dialog').classList.remove('hidden');
    
    const searchInput = document.getElementById('new-chat-search');
    searchInput.oninput = async function() {
        const query = this.value.trim().toLowerCase();
        const container = document.getElementById('new-chat-results');
        if (!query || query.length < 2) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Введите минимум 2 символа</div>';
            return;
        }
        container.innerHTML = '<div style="text-align:center;padding:20px;">🔍 Поиск...</div>';
        
        const usersSnap = await database.ref('users').once('value');
        const users = usersSnap.val();
        const results = [];
        for (const uid in users) {
            if (uid === currentUser?.uid) continue;
            const username = (users[uid].username || '').toLowerCase();
            if (username.includes(query)) results.push({ uid, ...users[uid] });
            if (results.length >= 20) break;
        }
        
        if (results.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;">👻 Не найдено</div>';
            return;
        }
        container.innerHTML = '';
        for (const user of results) {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid var(--border); cursor:pointer;';
            div.onclick = () => createNewChatFromDialog(user.uid, user.username);
            div.innerHTML = `
                <div style="width:45px;height:45px;border-radius:50%;background:var(--sage);display:flex;align-items:center;justify-content:center;${user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : ''}">${user.avatar ? '' : '👤'}</div>
                <div style="flex:1;"><strong>${escapeHtml(user.username)}</strong></div>
                <div style="color:var(--forest);">→</div>
            `;
            container.appendChild(div);
        }
    };
    searchInput.focus();
}

window.closeNewChatDialog = function() {
    const dialog = document.getElementById('new-chat-dialog');
    if (dialog) dialog.remove();
};

async function createNewChatFromDialog(userId, userName) {
    closeNewChatDialog();
    const chatId = currentUser.uid < userId ? currentUser.uid + '_' + userId : userId + '_' + currentUser.uid;
    const chatSnap = await database.ref('chats/' + chatId).once('value');
    if (!chatSnap.exists()) {
        await database.ref('chats/' + chatId).set({
            type: 'private',
            participants: [currentUser.uid, userId],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Чат создан',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        await database.ref('userChats/' + userId + '/' + chatId).set(true);
        showNotification('Чат создан!', 'success');
    }
    if (typeof switchToTab === 'function') switchToTab('chats');
    setTimeout(() => { if (typeof openChatById === 'function') openChatById(chatId); }, 300);
}

// ========== СОЗДАНИЕ ГРУППЫ (ПОЛНАЯ ВЕРСИЯ) ==========
window.openCreateGroupWizard = function() {
    closeCreateMenu();
    
    // Создаём модальное окно
    const modalHtml = `
        <div id="create-group-wizard" class="modal" style="z-index:10050;">
            <div class="modal-content" style="max-width: 500px; border-radius: 24px;">
                <div class="wizard-header" style="position: relative; padding: 15px 20px; border-bottom: 1px solid var(--border);">
                    <button class="wizard-back-btn" onclick="closeCreateGroupWizard()" style="position: absolute; left: 15px; top: 12px; background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                    <h3 style="text-align: center; margin: 0;">👥 Создание группы</h3>
                    <div class="wizard-steps" style="display: flex; justify-content: center; gap: 20px; margin-top: 15px;">
                        <div class="wizard-step active" id="step1-indicator">1</div>
                        <div class="wizard-step" id="step2-indicator">2</div>
                        <div class="wizard-step" id="step3-indicator">3</div>
                    </div>
                </div>
                <div id="wizard-step-1" class="wizard-step-content">
                    <input type="text" id="group-name" class="wizard-input" placeholder="Название группы">
                    <input type="text" id="group-kname" class="wizard-input" placeholder="Ссылка (только латиница, например: mygroup)">
                    <textarea id="group-desc" class="wizard-input" placeholder="Описание группы" rows="3"></textarea>
                    <div class="wizard-buttons">
                        <button class="wizard-next-btn" onclick="goToGroupStep(2)">Далее →</button>
                    </div>
                </div>
                <div id="wizard-step-2" class="wizard-step-content" style="display: none;">
                    <div style="margin-bottom: 15px;">
                        <input type="text" id="member-search" class="wizard-input" placeholder="🔍 Поиск пользователей...">
                    </div>
                    <div id="member-search-results" style="max-height: 300px; overflow-y: auto;"></div>
                    <div style="margin-top: 15px;">
                        <div style="font-weight: 600; margin-bottom: 8px;">Выбранные участники:</div>
                        <div id="selected-members-list" class="selected-members"></div>
                    </div>
                    <div class="wizard-buttons">
                        <button class="wizard-back-btn-step" onclick="goToGroupStep(1)">← Назад</button>
                        <button class="wizard-next-btn" onclick="goToGroupStep(3)">Далее →</button>
                    </div>
                </div>
                <div id="wizard-step-3" class="wizard-step-content" style="display: none;">
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 15px;">👥</div>
                        <h3>Готова к созданию!</h3>
                        <p id="group-summary" style="color: var(--text-light);"></p>
                    </div>
                    <div class="wizard-buttons">
                        <button class="wizard-back-btn-step" onclick="goToGroupStep(2)">← Назад</button>
                        <button class="wizard-create-btn" onclick="createGroup()">🚀 Создать группу</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const old = document.getElementById('create-group-wizard');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('create-group-wizard').classList.remove('hidden');
    
    window.selectedGroupMembers = [];
    window.groupStep = 1;
    
    // Поиск пользователей
    const searchInput = document.getElementById('member-search');
    if (searchInput) {
        searchInput.oninput = async function() {
            const query = this.value.trim().toLowerCase();
            const container = document.getElementById('member-search-results');
            if (!query || query.length < 2) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = '<div style="padding:20px;text-align:center;">🔍 Поиск...</div>';
            
            const usersSnap = await database.ref('users').once('value');
            const users = usersSnap.val();
            container.innerHTML = '';
            
            for (const uid in users) {
                if (uid === currentUser?.uid) continue;
                if (window.selectedGroupMembers.includes(uid)) continue;
                const username = (users[uid].username || '').toLowerCase();
                if (username.includes(query)) {
                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid var(--border); cursor:pointer;';
                    div.onclick = () => addGroupMember(uid, users[uid].username, users[uid].avatar);
                    div.innerHTML = `
                        <div style="width:40px;height:40px;border-radius:50%;background:var(--sage);display:flex;align-items:center;justify-content:center;${users[uid].avatar ? 'background-image:url('+users[uid].avatar+');background-size:cover;' : ''}">${users[uid].avatar ? '' : '👤'}</div>
                        <div style="flex:1;"><strong>${escapeHtml(users[uid].username)}</strong></div>
                        <div style="color:var(--forest);">➕</div>
                    `;
                    container.appendChild(div);
                }
            }
            if (container.children.length === 0) {
                container.innerHTML = '<div style="padding:20px;text-align:center;">👻 Ничего не найдено</div>';
            }
        };
    }
    
    updateSelectedMembersList();
};

window.closeCreateGroupWizard = function() {
    const modal = document.getElementById('create-group-wizard');
    if (modal) modal.remove();
};

function addGroupMember(uid, username, avatar) {
    if (window.selectedGroupMembers.includes(uid)) return;
    window.selectedGroupMembers.push({ uid, username, avatar });
    updateSelectedMembersList();
    document.getElementById('member-search').value = '';
    document.getElementById('member-search-results').innerHTML = '';
}

function removeGroupMember(uid) {
    window.selectedGroupMembers = window.selectedGroupMembers.filter(m => m.uid !== uid);
    updateSelectedMembersList();
}

function updateSelectedMembersList() {
    const container = document.getElementById('selected-members-list');
    if (!container) return;
    container.innerHTML = window.selectedGroupMembers.map(m => `
        <div class="selected-member-chip">
            👤 ${escapeHtml(m.username)}
            <button onclick="removeGroupMember('${m.uid}')">×</button>
        </div>
    `).join('');
}

function goToGroupStep(step) {
    window.groupStep = step;
    for (let i = 1; i <= 3; i++) {
        const stepDiv = document.getElementById(`wizard-step-${i}`);
        const indicator = document.getElementById(`step${i}-indicator`);
        if (stepDiv) stepDiv.style.display = i === step ? 'block' : 'none';
        if (indicator) {
            if (i === step) indicator.classList.add('active');
            else indicator.classList.remove('active');
        }
    }
    
    if (step === 3) {
        const name = document.getElementById('group-name').value.trim() || 'Без названия';
        const membersCount = window.selectedGroupMembers.length;
        document.getElementById('group-summary').innerHTML = `📝 Название: ${escapeHtml(name)}<br>👥 Участников: ${membersCount + 1} (включая вас)`;
    }
}

async function createGroup() {
    const name = document.getElementById('group-name').value.trim();
    if (!name) {
        showNotification('Введите название группы!', 'error');
        return;
    }
    
    const kname = document.getElementById('group-kname').value.trim().toLowerCase();
    const description = document.getElementById('group-desc').value.trim();
    
    if (kname) {
        const knamePattern = /^[a-z0-9_]+$/;
        if (!knamePattern.test(kname)) {
            showNotification('Ссылка: только латиница, цифры и _', 'error');
            return;
        }
        const existing = await database.ref('channelKnames/' + kname).once('value');
        if (existing.exists()) {
            showNotification('Такая ссылка уже существует!', 'error');
            return;
        }
    }
    
    showNotification('Создание группы...', 'info');
    
    const chatId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const members = { [currentUser.uid]: true };
    const admins = { [currentUser.uid]: true };
    
    for (const m of window.selectedGroupMembers) {
        members[m.uid] = true;
    }
    
    const groupData = {
        type: 'group',
        name: name,
        kname: kname || null,
        description: description,
        createdBy: currentUser.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        members: members,
        admins: admins,
        membersCount: Object.keys(members).length,
        lastMessage: 'Группа создана',
        lastMessageTime: firebase.database.ServerValue.TIMESTAMP
    };
    
    await database.ref('chats/' + chatId).set(groupData);
    
    for (const uid of Object.keys(members)) {
        await database.ref('userChats/' + uid + '/' + chatId).set(true);
    }
    
    if (kname) {
        await database.ref('channelKnames/' + kname).set(chatId);
    }
    
    showNotification('✅ Группа создана!', 'success');
    closeCreateGroupWizard();
    
    if (typeof switchToTab === 'function') switchToTab('chats');
    setTimeout(() => { if (typeof openChatById === 'function') openChatById(chatId); }, 300);
}

// ========== СОЗДАНИЕ КАНАЛА (ПОЛНАЯ ВЕРСИЯ) ==========
window.openCreateChannelWizard = function() {
    closeCreateMenu();
    
    const modalHtml = `
        <div id="create-channel-wizard" class="modal" style="z-index:10050;">
            <div class="modal-content" style="max-width: 500px; border-radius: 24px;">
                <div class="wizard-header" style="position: relative; padding: 15px 20px; border-bottom: 1px solid var(--border);">
                    <button class="wizard-back-btn" onclick="closeCreateChannelWizard()" style="position: absolute; left: 15px; top: 12px; background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                    <h3 style="text-align: center; margin: 0;">📢 Создание канала</h3>
                </div>
                <div style="padding: 20px;">
                    <input type="text" id="channel-name" class="wizard-input" placeholder="Название канала">
                    <input type="text" id="channel-kname" class="wizard-input" placeholder="Ссылка (только латиница, например: mychannel)">
                    <textarea id="channel-desc" class="wizard-input" placeholder="Описание канала" rows="3"></textarea>
                    <div style="margin: 15px 0;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="radio" name="channel-type" value="public" checked> 📢 Публичный
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; margin-top: 8px; cursor: pointer;">
                            <input type="radio" name="channel-type" value="private"> 🔒 Приватный
                        </label>
                    </div>
                    <div class="wizard-buttons">
                        <button class="wizard-create-btn" onclick="createChannel()">🚀 Создать канал</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const old = document.getElementById('create-channel-wizard');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('create-channel-wizard').classList.remove('hidden');
};

window.closeCreateChannelWizard = function() {
    const modal = document.getElementById('create-channel-wizard');
    if (modal) modal.remove();
};

async function createChannel() {
    const name = document.getElementById('channel-name').value.trim();
    if (!name) {
        showNotification('Введите название канала!', 'error');
        return;
    }
    
    const kname = document.getElementById('channel-kname').value.trim().toLowerCase();
    const description = document.getElementById('channel-desc').value.trim();
    const isPublic = document.querySelector('input[name="channel-type"]:checked').value === 'public';
    
    if (kname) {
        const knamePattern = /^[a-z0-9_]+$/;
        if (!knamePattern.test(kname)) {
            showNotification('Ссылка: только латиница, цифры и _', 'error');
            return;
        }
        const existing = await database.ref('channelKnames/' + kname).once('value');
        if (existing.exists()) {
            showNotification('Такая ссылка уже существует!', 'error');
            return;
        }
    }
    
    showNotification('Создание канала...', 'info');
    
    const chatId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    const subscribers = { [currentUser.uid]: true };
    const admins = { [currentUser.uid]: true };
    
    const channelData = {
        type: 'channel',
        name: name,
        kname: kname || null,
        description: description,
        isPublic: isPublic,
        createdBy: currentUser.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        subscribers: subscribers,
        admins: admins,
        subscribersCount: 1,
        lastMessage: 'Канал создан',
        lastMessageTime: firebase.database.ServerValue.TIMESTAMP
    };
    
    await database.ref('chats/' + chatId).set(channelData);
    await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
    
    if (kname) {
        await database.ref('channelKnames/' + kname).set(chatId);
    }
    
    showNotification('✅ Канал создан!', 'success');
    closeCreateChannelWizard();
    
    if (typeof switchToTab === 'function') switchToTab('chats');
    setTimeout(() => { if (typeof openChatById === 'function') openChatById(chatId); }, 300);
}
// ========== ФИКС БЕСКОНЕЧНОЙ ЗАГРУЗКИ НА ТЕЛЕФОНЕ ==========
(function fixLoadingOnMobile() {
    // Отключаем загрузку если прошло слишком много времени
    setTimeout(function() {
        var loadingScreen = document.getElementById('loading-screen');
        var mainScreen = document.getElementById('main-screen');
        var authScreen = document.getElementById('auth-screen');
        
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            console.log('Принудительное скрытие загрузки');
            loadingScreen.classList.add('hidden');
            
            // Проверяем авторизацию
            if (currentUser) {
                if (mainScreen) mainScreen.classList.remove('hidden');
                if (authScreen) authScreen.classList.add('hidden');
            } else {
                if (mainScreen) mainScreen.classList.add('hidden');
                if (authScreen) authScreen.classList.remove('hidden');
            }
        }
    }, 3000);
    
    // Форсируем проверку авторизации каждые 2 секунды
    var checkInterval = setInterval(function() {
        if (currentUser && currentUser.uid) {
            var loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
                loadingScreen.classList.add('hidden');
                document.getElementById('main-screen').classList.remove('hidden');
                document.getElementById('auth-screen').classList.add('hidden');
                clearInterval(checkInterval);
            }
        }
    }, 2000);
})();
