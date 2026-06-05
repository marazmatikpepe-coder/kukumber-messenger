// KUKUMBER MESSENGER - CHAT.JS (ИСПРАВЛЕННАЯ ВЕРСИЯ + КОНТЕКСТНОЕ МЕНЮ + ВЕРИФИКАЦИЯ)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var currentUser = null;
var currentUserData = null;
var currentChatId = null;
var currentChatData = null;
var messagesListener = null;
var chatsListener = null;
var typingTimeout = null;
var loadedMessageIds = new Set();
var loadedChatIds = new Set(); // ДЛЯ ОТСЛЕЖИВАНИЯ ЗАГРУЖЕННЫХ ЧАТОВ

// Для контекстного меню
var currentContextMessage = null;
var currentContextMessageElement = null;

// Кэши для оптимизации
var userCache = {
    names: {},
    avatars: {},
    statuses: {},
    verified: {} // ДОБАВЛЕНО: кэш для верификации
};
// ========== ОФЛАЙН-КЭШ ДЛЯ СООБЩЕНИЙ ==========
var offlineCache = {
    messages: {}, // { chatId: [messages] }
    images: {}    // { url: blob }
};

// Загружаем кэш из localStorage
function loadOfflineCache() {
    var saved = localStorage.getItem('kukumber_offline_cache');
    if (saved) {
        try {
            var data = JSON.parse(saved);
            if (data.messages) offlineCache.messages = data.messages;
            if (data.images) offlineCache.images = data.images;
        } catch(e) {}
    }
}

// Сохраняем кэш
function saveOfflineCache() {
    // Не сохраняем изображения в localStorage (много места)
    var toSave = {
        messages: offlineCache.messages
    };
    localStorage.setItem('kukumber_offline_cache', JSON.stringify(toSave));
}

// Кэшируем сообщение
function cacheMessage(chatId, message) {
    if (!offlineCache.messages[chatId]) {
        offlineCache.messages[chatId] = [];
    }
    // Добавляем только если нет такого сообщения
    var exists = offlineCache.messages[chatId].some(m => m.id === message.id);
    if (!exists) {
        offlineCache.messages[chatId].push(message);
        // Ограничиваем количество cached сообщений до 200 на чат
        if (offlineCache.messages[chatId].length > 200) {
            offlineCache.messages[chatId].shift();
        }
        saveOfflineCache();
    }
}

// Кэшируем изображение
async function cacheImage(url) {
    if (offlineCache.images[url]) return;
    try {
        var response = await fetch(url);
        var blob = await response.blob();
        offlineCache.images[url] = blob;
        // Сохраняем blob в IndexedDB (временно, для офлайн-доступа)
        saveImageToIndexedDB(url, blob);
    } catch(e) {
        console.log('Не удалось кэшировать изображение:', e);
    }
}

// IndexedDB для хранения изображений
var dbPromise = null;

function openImageDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject) {
        var request = indexedDB.open('KukumberImages', 1);
        request.onerror = function() { reject(request.error); };
        request.onsuccess = function() { resolve(request.result); };
        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'url' });
            }
        };
    });
    return dbPromise;
}

async function saveImageToIndexedDB(url, blob) {
    try {
        var db = await openImageDatabase();
        var tx = db.transaction('images', 'readwrite');
        var store = tx.objectStore('images');
        store.put({ url: url, blob: blob, timestamp: Date.now() });
        await tx.complete;
    } catch(e) { console.log('Ошибка сохранения изображения:', e); }
}

async function getImageFromIndexedDB(url) {
    try {
        var db = await openImageDatabase();
        var tx = db.transaction('images', 'readonly');
        var store = tx.objectStore('images');
        var result = await new Promise(function(resolve) {
            var get = store.get(url);
            get.onsuccess = function() { resolve(get.result); };
        });
        return result?.blob;
    } catch(e) { return null; }
}
// Инициализация звука (нужно для автоплея)
function initAudioContext() {
    // Создаём пустой AudioContext для "разрешения" автоплея
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !window.audioContextAllowed) {
        var context = new AudioContext();
        context.resume().then(function() {
            console.log('🔊 Аудио разрешено');
            window.audioContextAllowed = true;
        });
    }
}

// Добавляем обработчик на весь документ для разрешения звука
document.addEventListener('click', function() {
    if (window.AudioContext && !window.audioContextAllowed) {
        var context = new (window.AudioContext || window.webkitAudioContext)();
        context.resume();
        window.audioContextAllowed = true;
    }
}, { once: true });
// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
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

function formatLastSeen(timestamp) {
    if (!timestamp) return 'неизвестно';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff / 60) + ' минут назад';
    if (diff < 86400) {
        return 'сегодня в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU') + ' в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? userId1 + '_' + userId2 : userId2 + '_' + userId1;
}

function showNotification(message, type) {
    type = type || 'info';
    var container = document.getElementById('notifications-container');
    if (!container) {
        console.log('Уведомление:', message);
        return;
    }
    var notif = document.createElement('div');
    notif.className = 'notification ' + type;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(function() { if (notif) notif.remove(); }, 3000);
}

// ========== ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ (С ВЕРИФИКАЦИЕЙ) ==========
async function getUserData(userId) {
    if (!userId) return null;
    
    if (userCache.names[userId] && Date.now() - (userCache.names[userId]._time || 0) < 60000) {
        return {
            username: userCache.names[userId].value,
            avatar: userCache.avatars[userId]?.value || '',
            status: userCache.statuses[userId]?.value || { online: false },
            verified: userCache.verified[userId]?.value || false
        };
    }
    
    try {
        var snapshot = await database.ref('users/' + userId).once('value');
        var data = snapshot.val();
        if (data) {
            userCache.names[userId] = { value: data.username || 'Пользователь', _time: Date.now() };
            userCache.avatars[userId] = { value: data.avatar || '', _time: Date.now() };
            userCache.statuses[userId] = { value: data.status || { online: false }, _time: Date.now() };
            userCache.verified[userId] = { value: data.verified === true, _time: Date.now() };
            return {
                username: data.username || 'Пользователь',
                avatar: data.avatar || '',
                status: data.status || { online: false },
                verified: data.verified === true
            };
        }
    } catch (err) {
        console.error('Ошибка получения данных пользователя:', err);
    }
    return { username: 'Пользователь', avatar: '', status: { online: false }, verified: false };
}

// ========== ЗАГРУЗКА СПИСКА ЧАТОВ (БЕЗ ДУБЛЕЙ + ВЕРИФИКАЦИЯ) ==========
function loadChats() {
    console.log('loadChats() вызвана');
    
    if (!window.currentUser || !window.currentUser.uid) {
        console.log('Нет авторизованного пользователя');
        return;
    }
    
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) {
        console.error('Элемент chats-list не найден');
        return;
    }
    
    loadedChatIds.clear();
    chatsList.innerHTML = '<div class="empty-chats">🔄 Загрузка чатов...</div>';
    
    if (chatsListener) chatsListener.off();
    
    database.ref('userChats/' + window.currentUser.uid).once('value', function(snapshot) {
        var userChats = snapshot.val();
        
        if (!userChats || Object.keys(userChats).length === 0) {
            chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов. Начните диалог!</div>';
            return;
        }
        
        var chatIds = Object.keys(userChats);
        console.log('Найдено чатов:', chatIds.length);
        
        var chatsData = {};
        var loadedCount = 0;
        
        chatsList.innerHTML = '<div class="empty-chats">🔄 Загрузка чатов...</div>';
        
        chatIds.forEach(function(chatId) {
            loadedChatIds.add(chatId);
            database.ref('chats/' + chatId).once('value', function(chatSnap) {
                var chat = chatSnap.val();
                if (chat) chatsData[chatId] = chat;
                loadedCount++;
                if (loadedCount === chatIds.length) renderChatsList(chatsData);
            });
        });
    });
    
    if (!chatsListener) {
        chatsListener = database.ref('userChats/' + window.currentUser.uid);
        chatsListener.on('child_added', function(snapshot) {
            var newChatId = snapshot.key;
            if (loadedChatIds.has(newChatId)) return;
            loadedChatIds.add(newChatId);
            database.ref('chats/' + newChatId).once('value', function(chatSnap) {
                var chatData = chatSnap.val();
                if (chatData) {
                    var chatsList = document.getElementById('chats-list');
                    if (chatsList && chatsList.querySelector('.empty-chats')) {
                        chatsList.innerHTML = '';
                    }
                    createChatItem(newChatId, chatData, chatsList);
                }
            });
        });
    }
}

// ========== ОТРИСОВКА СПИСКА ЧАТОВ ==========
function renderChatsList(chatsData) {
    var chatsList = document.getElementById('chats-list');
    if (!chatsList) return;
    
    var chatIds = Object.keys(chatsData);
    if (chatIds.length === 0) {
        chatsList.innerHTML = '<div class="empty-chats">💬 Нет чатов</div>';
        return;
    }
    
    var chatsArray = [];
    for (var chatId in chatsData) {
        chatsArray.push({ id: chatId, data: chatsData[chatId] });
    }
    
    chatsArray.sort(function(a, b) {
        return (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0);
    });
    
    chatsList.innerHTML = '';
    
    chatsArray.forEach(function(chat) {
        createChatItem(chat.id, chat.data, chatsList);
    });
}

// ========== СОЗДАНИЕ ЭЛЕМЕНТА ЧАТА (С ВЕРИФИКАЦИЕЙ) ==========
async function createChatItem(chatId, chatData, container) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    div.setAttribute('data-chat-id', chatId);
    
    if (window.currentChatId === chatId) div.classList.add('active');
    
    var name = '';
    var avatarUrl = '';
    var badge = '';
    var isOnline = false;
    var isVerified = false;
    var preview = chatData.lastMessage || 'Нет сообщений';
    var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
    
    if (preview && preview.length > 50) preview = preview.substring(0, 47) + '...';
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatarUrl = chatData.avatar || '';
        badge = '<span class="chat-type-badge">👥</span>';
    } 
    else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatarUrl = chatData.avatar || '';
        badge = '<span class="chat-type-badge">📢</span>';
        isVerified = chatData.verified === true;  // ⭐ ДЛЯ ГАЛОЧКИ КАНАЛА
    }
    else {
        // Личный чат
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== window.currentUser.uid) {
                    otherUserId = chatData.participants[i];
                    break;
                }
            }
        }
        if (otherUserId) {
            var userData = await getUserData(otherUserId);
            name = userData.username;
            avatarUrl = userData.avatar;
            isOnline = userData.status.online === true;
            isVerified = userData.verified === true;
        } else {
            name = 'Пользователь';
        }
    }
    
    var hasAvatar = avatarUrl && avatarUrl !== '';
    var avatarStyle = hasAvatar ? 'background-image: url(' + avatarUrl + '); background-size: cover; background-position: center;' : '';
    var defaultClass = '';
    var avatarContent = '';
    
    if (!hasAvatar) {
        if (chatData.type === 'group') defaultClass = 'default-avatar-group';
        else if (chatData.type === 'channel') defaultClass = 'default-avatar-channel';
        else defaultClass = 'default-avatar-user';
    }
    
    // ГАЛОЧКА ДЛЯ КАНАЛОВ (и для пользователей)
    var verifiedBadge = isVerified ? '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:14px; height:14px; margin-left:4px; vertical-align:middle;">' : '';
    
    div.innerHTML = `
        <div class="chat-item-avatar">
            <div class="avatar ${defaultClass}" style="${avatarStyle}">${avatarContent}</div>
            ${isOnline ? '<div class="online-indicator"></div>' : ''}
            ${badge}
        </div>
        <div class="chat-item-info">
            <div class="chat-item-header">
                <span class="chat-item-name">${escapeHtml(name)}${verifiedBadge}</span>
                <span class="chat-item-time">${time}</span>
            </div>
            <div class="chat-item-preview">${escapeHtml(preview)}</div>
        </div>
    `;
    
    div.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        openChatById(chatId);
        return false;
    };
    
    container.appendChild(div);
}

// ========== ОТКРЫТИЕ ЧАТА ПО ID ==========
async function openChatById(chatId) {
    console.log('openChatById:', chatId);
    
    if (!chatId) return;
    if (!window.currentUser || !window.currentUser.uid) return;
    
    if (window.innerWidth <= 768) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('open')) sidebar.classList.remove('open');
    }
    
    try {
        var chatSnap = await database.ref('chats/' + chatId).once('value');
        var chatData = chatSnap.val();
        if (!chatData) {
            showNotification('Чат не найден', 'error');
            return;
        }
        openChatWithData(chatId, chatData);
    } catch (err) {
        console.error('Ошибка открытия чата:', err);
        showNotification('Ошибка открытия чата', 'error');
    }
}

// ========== ОТКРЫТИЕ ЧАТА С ДАННЫМИ ==========
async function openChatWithData(chatId, chatData) {
    console.log('openChatWithData:', chatId, chatData.type);
    
    window.currentChatId = chatId;
    window.currentChatData = chatData;
    window.currentChatData.chatId = chatId;
    
    if (chatData.type === 'private' && chatData.participants) {
        for (var i = 0; i < chatData.participants.length; i++) {
            if (chatData.participants[i] !== window.currentUser.uid) {
                window.currentChatData.otherUserId = chatData.participants[i];
                break;
            }
        }
    }
    
    document.querySelectorAll('.chat-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-chat-id') === chatId) item.classList.add('active');
    });
    
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    if (noChatElement) noChatElement.classList.add('hidden');
    if (activeChatElement) {
        activeChatElement.classList.remove('hidden');
        activeChatElement.style.display = 'flex';
    }
    
    await updateChatHeader(chatId, chatData);
    
    setTimeout(function() { setupChatHeaderClick(); }, 100);
    
    loadMessages(chatId);
}

// ========== ОБНОВЛЕНИЕ ШАПКИ ЧАТА (С ВЕРИФИКАЦИЕЙ) ==========
async function updateChatHeader(chatId, chatData) {
    var chatUsername = document.getElementById('chat-username');
    var chatStatus = document.getElementById('chat-status');
    var chatAvatar = document.getElementById('chat-avatar');
    var callButtons = document.querySelectorAll('.chat-actions .call-btn');
    var backBtn = document.querySelector('.chat-header .back-btn');
    
    if (!chatUsername) return;
    
    if (chatAvatar) {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.textContent = '';
        chatAvatar.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
    }
    
    callButtons.forEach(function(btn) {
        btn.style.display = 'none';
    });
    
    // ГРУППА
    if (chatData.type === 'group') {
        chatUsername.textContent = chatData.name || 'Группа';
        if (chatStatus) {
            var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
            chatStatus.textContent = membersCount + ' участников';
        }
        if (chatAvatar) {
            if (chatData.avatar) {
                chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                chatAvatar.style.backgroundSize = 'cover';
            } else {
                chatAvatar.classList.add('default-avatar-group');
            }
        }
    } 
    // КАНАЛ
else if (chatData.type === 'channel') {
    // ⭐ ДОБАВЛЯЕМ ГАЛОЧКУ ДЛЯ КАНАЛА В ШАПКУ
    if (chatData.verified === true) {
        chatUsername.innerHTML = escapeHtml(chatData.name || 'Канал') + 
            ' <img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:16px; height:16px; margin-left:4px; vertical-align:middle;">';
    } else {
        chatUsername.textContent = chatData.name || 'Канал';
    }
    
    if (chatStatus) {
        var subsCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        chatStatus.textContent = subsCount + ' подписчиков';
    }
    if (chatAvatar) {
        if (chatData.avatar) {
            chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
            chatAvatar.style.backgroundSize = 'cover';
        } else {
            chatAvatar.classList.add('default-avatar-channel');
        }
    }
}
    // ЛИЧНЫЙ ЧАТ
    else {
        callButtons.forEach(function(btn) {
            btn.style.display = 'flex';
        });
        
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== window.currentUser.uid) {
                    otherUserId = chatData.participants[i];
                    break;
                }
            }
        }
        
        if (otherUserId) {
            if (window.currentChatData) {
                window.currentChatData.otherUserId = otherUserId;
            }
            
            var userData = await getUserData(otherUserId);
            
            // Добавляем галочку верификации к имени
            var verifiedBadge = userData.verified ? 
                '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:16px; height:16px; margin-left:5px; vertical-align:middle;">' : '';
            chatUsername.innerHTML = escapeHtml(userData.username || 'Пользователь') + verifiedBadge;
            
            if (chatStatus) {
                if (userData.status && userData.status.online === true) {
                    chatStatus.innerHTML = '🟢 в сети';
                    chatStatus.style.color = '#32CD32';
                } else {
                    var lastSeenText = formatLastSeen(userData.status?.lastSeen);
                    chatStatus.innerHTML = '⚫ ' + lastSeenText;
                    chatStatus.style.color = '#888';
                }
            }
            
            if (chatAvatar) {
                if (userData.avatar) {
                    chatAvatar.style.backgroundImage = 'url(' + userData.avatar + ')';
                    chatAvatar.style.backgroundSize = 'cover';
                } else {
                    chatAvatar.classList.add('default-avatar-user');
                }
            }
        } else {
            chatUsername.textContent = 'Пользователь';
            if (chatStatus) chatStatus.textContent = 'неизвестно';
            if (chatAvatar) chatAvatar.classList.add('default-avatar-user');
        }
    }
    
    if (backBtn) {
        backBtn.onclick = function() {
            if (typeof closeChat === 'function') closeChat();
        };
    }
    
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (chatUserInfo) {
        var newUserInfo = chatUserInfo.cloneNode(true);
        chatUserInfo.parentNode.replaceChild(newUserInfo, chatUserInfo);
        newUserInfo.style.cursor = 'pointer';
        newUserInfo.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            openChatProfile();
        };
    }
}

function setupChatHeaderClick() {
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (!chatUserInfo) return;
    
    var newElement = chatUserInfo.cloneNode(true);
    chatUserInfo.parentNode.replaceChild(newElement, chatUserInfo);
    newElement.style.cursor = 'pointer';
    newElement.onclick = function(e) {
        e.preventDefault();
        openChatProfile();
    };
}

function openChatProfile() {
    if (!window.currentChatData) {
        showNotification('Сначала откройте чат', 'error');
        return;
    }
    
    var chatType = window.currentChatData.type;
    
    if (chatType === 'private') {
        var otherUserId = window.currentChatData.otherUserId;
        if (!otherUserId && window.currentChatData.participants) {
            for (var i = 0; i < window.currentChatData.participants.length; i++) {
                if (window.currentChatData.participants[i] !== window.currentUser.uid) {
                    otherUserId = window.currentChatData.participants[i];
                    break;
                }
            }
        }
        if (otherUserId && typeof window.openUserProfile === 'function') {
            window.openUserProfile(otherUserId);
        } else {
            showNotification('Не удалось определить пользователя', 'error');
        }
    } 
    else if (chatType === 'group' && typeof window.openGroupProfile === 'function') {
        window.openGroupProfile(window.currentChatId);
    } 
    else if (chatType === 'channel' && typeof window.openChannelProfile === 'function') {
        window.openChannelProfile(window.currentChatId);
    }
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    container.innerHTML = '';
    loadedMessageIds.clear();
    
    // Проверяем интернет
    if (!navigator.onLine) {
        // Загружаем из кэша
        var cached = offlineCache.messages[chatId];
        if (cached && cached.length > 0) {
            cached.forEach(function(message) {
                if (!loadedMessageIds.has(message.id)) {
                    loadedMessageIds.add(message.id);
                    appendMessage(message);
                }
            });
            showNotification('📱 Офлайн-режим: показаны сохранённые сообщения', 'info');
            return;
        } else {
            container.innerHTML = '<div class="empty-chats">📴 Нет интернета<br>Нет сохранённых сообщений</div>';
            return;
        }
    }
    
    // Если интернет есть - загружаем как обычно
    if (messagesListener) messagesListener.off();
    
    messagesListener = database.ref('messages/' + chatId)
        .orderByChild('timestamp')
        .limitToLast(50);
    
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        var messageId = snapshot.key;
        if (loadedMessageIds.has(messageId)) return;
        loadedMessageIds.add(messageId);
        message.id = messageId;
        appendMessage(message);
        // Кэшируем
        cacheMessage(chatId, message);
        if (message.type === 'image' || message.type === 'gif') {
            cacheImage(message.imageUrl || message.gifUrl);
        }
    });
}

function updateMessageElement(element, message) {
    var isSent = message.senderId === window.currentUser.uid;
    var textElement = element.querySelector('.message-text');
    if (textElement && message.text) {
        var textContent = escapeHtml(message.text);
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        textElement.innerHTML = textContent;
    }
}

// ========== ДОБАВЛЕНИЕ СООБЩЕНИЯ (С КОНТЕКСТНЫМ МЕНЮ) ==========
function appendMessage(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var isSent = message.senderId === window.currentUser.uid;
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    messageDiv.setAttribute('data-message-id', message.id);
    messageDiv.setAttribute('data-message-type', message.type || 'text');
    
    // Кэшируем сообщение для офлайн-доступа
    if (window.currentChatId && message.id) {
        cacheMessage(window.currentChatId, message);
    }
    
    // Добавляем контекстное меню
    messageDiv.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showMessageContextMenu(e, message, this);
    });
    
    var touchTimer = null;
    messageDiv.addEventListener('touchstart', function(e) {
        touchTimer = setTimeout(function() {
            showMessageContextMenu(e, message, messageDiv);
        }, 500);
    });
    messageDiv.addEventListener('touchend', function() { if (touchTimer) clearTimeout(touchTimer); });
    messageDiv.addEventListener('touchmove', function() { if (touchTimer) clearTimeout(touchTimer); });
    
    var content = '';
    
    if (message.replyTo) {
        var replyText = '';
        if (message.replyTo.type === 'image') replyText = '📷 Фото';
        else if (message.replyTo.type === 'gif') replyText = '🎬 GIF';
        else if (message.replyTo.type === 'audio') replyText = '🎤 Голосовое';
        else if (message.replyTo.type === 'video') replyText = '🎬 Видео';
        else if (message.replyTo.type === 'file') replyText = '📎 Файл';
        else replyText = message.replyTo.text;
        
        var displayReplyText = replyText.length > 50 ? replyText.substring(0, 47) + '...' : replyText;
        
        content += `
            <div class="message-reply" onclick="scrollToMessage('${message.replyTo.messageId}')" style="background: rgba(0,0,0,0.05); border-left: 3px solid var(--forest); padding: 6px 10px; border-radius: 10px; margin-bottom: 6px; cursor: pointer; font-size: 12px;">
                <div style="font-weight: 600; color: var(--forest);">↩️ ${escapeHtml(message.replyTo.senderName)}</div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayReplyText)}</div>
            </div>
        `;
    }
    
    if (message.type === 'image') {
        // Пытаемся загрузить из кэша сначала
        var imageUrl = message.imageUrl;
        content += `
            <div class="message-image" onclick="openLightbox('${imageUrl}')">
                <img src="${imageUrl}" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23ccc\'/%3E%3Ctext x=\'50\' y=\'50\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\'%3E📷%3C/text%3E%3C/svg%3E'">
            </div>
            ${message.caption ? '<div class="message-text">' + escapeHtml(message.caption) + '</div>' : ''}
        `;
        // Кэшируем изображение
        if (imageUrl) {
            cacheImage(imageUrl);
        }
    } 
    else if (message.type === 'gif') {
        var gifUrl = message.gifUrl;
        content += `
            <div class="gif-message" onclick="openLightbox('${gifUrl}')">
                <img src="${gifUrl}" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;">
                <span class="gif-badge">GIF</span>
            </div>
        `;
        if (gifUrl) {
            cacheImage(gifUrl);
        }
    }
    else if (message.type === 'audio') {
        var voiceId = message.voiceId;
        var duration = message.duration || '?';
        content = `<div class="audio-message">
            <button class="play-voice-btn" data-voice-id="${voiceId}">▶️</button>
            <span>🎤 Голосовое сообщение (${duration} сек)</span>
        </div>`;
    }
    else if (message.type === 'video') {
        content += `<div class="video-message"><video src="${message.videoUrl}" controls preload="metadata" style="max-width:250px; max-height:300px; border-radius:12px;"></video></div>`;
    }
    else if (message.type === 'file') {
        content += `<div class="file-message"><span style="font-size:24px;">📎</span><a href="${message.fileUrl}" target="_blank">${escapeHtml(message.fileName)}</a></div>`;
    }
    else {
        var textContent = escapeHtml(message.text || '');
        textContent = textContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">$1</a>');
        textContent = textContent.replace(/(^|\s)(www\.[^\s]+)/g, '$1<a href="http://$2" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">$2</a>');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text" style="word-break:break-word; white-space:normal;">' + textContent + '</div>';
    }
    
    var senderNameHtml = '';
    if (window.currentChatData && window.currentChatData.type !== 'private' && !isSent && message.senderId) {
        var senderName = userCache.names[message.senderId]?.value || 'Пользователь';
        senderNameHtml = '<div class="message-sender">' + escapeHtml(senderName) + '</div>';
    }
    
    messageDiv.innerHTML = `
        <div class="message-content" style="flex:1;">
            ${senderNameHtml}
            ${content}
            <div class="message-time">${formatTime(message.timestamp)}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// ========== КОНТЕКСТНОЕ МЕНЮ ДЛЯ СООБЩЕНИЙ ==========
function showMessageContextMenu(event, message, element) {
    event.preventDefault();
    event.stopPropagation();
    
    var oldMenu = document.getElementById('message-context-menu');
    if (oldMenu) oldMenu.remove();
    
    currentContextMessage = message;
    currentContextMessageElement = element;
    
    var isOwnMessage = message.senderId === window.currentUser.uid;
    var isAdmin = window.isSuperAdmin === true;
    var canDeleteForEveryone = isOwnMessage || isAdmin;
    
    var menu = document.createElement('div');
    menu.id = 'message-context-menu';
    menu.style.cssText = 'position:fixed; z-index:10001; background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2); min-width:200px; overflow:hidden;';
    
    var menuHtml = '';
    
    // Копировать текст (только для текстовых сообщений)
    if (message.type === 'text' && message.text) {
        menuHtml += '<div class="context-menu-item" onclick="copyMessageText()">📋 Копировать текст</div>';
    }
    
    // Ответить
    menuHtml += '<div class="context-menu-item" onclick="replyToMessage()">↩️ Ответить</div>';
    
    // Переслать
    menuHtml += '<div class="context-menu-item" onclick="forwardMessage()">📤 Переслать</div>';
    
    // Реакции
    menuHtml += '<div class="context-menu-item" onclick="showReactionPicker()">😊 Поставить реакцию</div>';
    
    // Разделитель
    menuHtml += '<div style="border-top:1px solid #eee; margin:5px 0;"></div>';
    
    // Удалить
    if (canDeleteForEveryone) {
        menuHtml += '<div class="context-menu-item" onclick="deleteMessageForEveryone()">🗑️ Удалить у всех</div>';
    }
    menuHtml += '<div class="context-menu-item" onclick="deleteMessageForMe()">🗑️ Удалить у меня</div>';
    
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    var x = event.clientX, y = event.clientY;
    if (event.touches) { x = event.touches[0].clientX; y = event.touches[0].clientY; }
    
    var menuRect = menu.getBoundingClientRect();
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    if (x + menuRect.width > windowWidth) x = windowWidth - menuRect.width - 10;
    if (y + menuRect.height > windowHeight) y = windowHeight - menuRect.height - 10;
    if (x < 10) x = 10; if (y < 10) y = 10;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    
    setTimeout(function() {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Функции контекстного меню
function copyMessageText() {
    if (currentContextMessage && currentContextMessage.text) {
        navigator.clipboard.writeText(currentContextMessage.text).then(function() {
            showNotification('Текст скопирован', 'success');
        }).catch(function() {
            showNotification('Не удалось скопировать', 'error');
        });
    }
    closeMessageContextMenu();
}

function replyToMessage() {
    if (!currentContextMessage || !window.currentChatId) return;
    
    // Сохраняем данные для ответа
    var replyData = {
        messageId: currentContextMessage.id,
        senderId: currentContextMessage.senderId,
        senderName: userCache.names[currentContextMessage.senderId]?.value || 'Пользователь',
        type: currentContextMessage.type || 'text',
        text: currentContextMessage.text || ''
    };
    
    if (currentContextMessage.type === 'image') replyData.text = '📷 Фото';
    else if (currentContextMessage.type === 'gif') replyData.text = '🎬 GIF';
    else if (currentContextMessage.type === 'audio') replyData.text = '🎤 Голосовое';
    else if (currentContextMessage.type === 'video') replyData.text = '🎬 Видео';
    else if (currentContextMessage.type === 'file') replyData.text = '📎 Файл';
    
    window.currentReplyTo = replyData;
    
    // Показываем индикатор ответа
    var inputArea = document.querySelector('.message-input-area');
    if (inputArea) {
        var existingIndicator = document.getElementById('reply-indicator');
        if (existingIndicator) existingIndicator.remove();
        
        var indicator = document.createElement('div');
        indicator.id = 'reply-indicator';
        indicator.style.cssText = 'background:#e8f5e9; padding:8px 12px; border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; font-size:12px;';
        indicator.innerHTML = '<span>↩️ Ответ <strong>' + escapeHtml(replyData.senderName) + '</strong>: ' + escapeHtml(replyData.text.substring(0, 50)) + '</span><button onclick="cancelReply()" style="background:none; border:none; font-size:16px; cursor:pointer;">×</button>';
        inputArea.insertBefore(indicator, inputArea.firstChild);
    }
    
    document.getElementById('message-input').focus();
    closeMessageContextMenu();
}

function cancelReply() {
    window.currentReplyTo = null;
    var indicator = document.getElementById('reply-indicator');
    if (indicator) indicator.remove();
}

function forwardMessage() {
    if (!currentContextMessage) return;
    
    // Создаем модальное окно для выбора чатов
    var modalHtml = `
        <div id="forward-modal" class="modal" style="z-index:10002;">
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3>📤 Переслать сообщение</h3>
                    <button onclick="closeForwardModal()" class="btn-close">×</button>
                </div>
                <div style="padding:10px;">
                    <input type="text" id="forward-search" placeholder="🔍 Поиск чатов..." style="width:100%; padding:10px; border:2px solid var(--border); border-radius:30px; margin-bottom:10px;">
                    <div id="forward-chats-list" style="max-height:400px; overflow-y:auto;"></div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('forward-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('forward-modal').classList.remove('hidden');
    
    loadForwardChatsList();
    closeMessageContextMenu();
}

async function loadForwardChatsList() {
    var container = document.getElementById('forward-chats-list');
    if (!container) return;
    
    var userChatsSnap = await database.ref('userChats/' + window.currentUser.uid).once('value');
    var userChats = userChatsSnap.val();
    
    if (!userChats) {
        container.innerHTML = '<div style="padding:20px;text-align:center;">Нет чатов</div>';
        return;
    }
    
    container.innerHTML = '';
    var chatIds = Object.keys(userChats);
    
    for (var chatId of chatIds) {
        var chatSnap = await database.ref('chats/' + chatId).once('value');
        var chatData = chatSnap.val();
        if (!chatData) continue;
        
        var name = '';
        if (chatData.type === 'group') name = chatData.name || 'Группа';
        else if (chatData.type === 'channel') name = chatData.name || 'Канал';
        else {
            var otherId = null;
            for (var uid of chatData.participants) {
                if (uid !== window.currentUser.uid) { otherId = uid; break; }
            }
            if (otherId) {
                var userData = await getUserData(otherId);
                name = userData.username;
            } else name = 'Пользователь';
        }
        
        var div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid var(--border); cursor:pointer;';
        div.onclick = (function(id) { return function() { sendForwardMessage(id); }; })(chatId);
        div.innerHTML = '<div class="avatar" style="width:45px;height:45px;"></div><div style="flex:1;"><strong>' + escapeHtml(name) + '</strong></div><div style="color:var(--forest);">→</div>';
        container.appendChild(div);
    }
}

function closeForwardModal() {
    var modal = document.getElementById('forward-modal');
    if (modal) modal.remove();
}

async function sendForwardMessage(chatId) {
    if (!currentContextMessage) return;
    
    var forwardMessage = {
        type: currentContextMessage.type || 'text',
        senderId: window.currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        forwarded: true,
        originalSenderId: currentContextMessage.senderId,
        originalSenderName: userCache.names[currentContextMessage.senderId]?.value || 'Пользователь'
    };
    
    if (currentContextMessage.type === 'text') {
        forwardMessage.text = currentContextMessage.text;
    } else if (currentContextMessage.type === 'image') {
        forwardMessage.imageUrl = currentContextMessage.imageUrl;
        forwardMessage.caption = currentContextMessage.caption || '';
    } else if (currentContextMessage.type === 'gif') {
        forwardMessage.gifUrl = currentContextMessage.gifUrl;
    } else if (currentContextMessage.type === 'audio') {
        forwardMessage.audioUrl = currentContextMessage.audioUrl;
        forwardMessage.duration = currentContextMessage.duration;
    } else if (currentContextMessage.type === 'file') {
        forwardMessage.fileUrl = currentContextMessage.fileUrl;
        forwardMessage.fileName = currentContextMessage.fileName;
    }
    
    await database.ref('messages/' + chatId).push(forwardMessage);
    await database.ref('chats/' + chatId).update({
        lastMessage: '📨 Пересланное сообщение',
        lastMessageTime: firebase.database.ServerValue.TIMESTAMP
    });
    
    showNotification('Сообщение переслано!', 'success');
    closeForwardModal();
}

function showReactionPicker() {
    if (!currentContextMessage) return;
    
    var reactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '🥒'];
    var modalHtml = `
        <div id="reaction-modal" class="modal" style="z-index:10002;">
            <div class="modal-content" style="max-width:300px; text-align:center;">
                <div class="modal-header">
                    <h3>Выберите реакцию</h3>
                    <button onclick="closeReactionModal()" class="btn-close">×</button>
                </div>
                <div style="padding:15px; display:flex; flex-wrap:wrap; gap:12px; justify-content:center;">
                    ${reactions.map(r => `<span style="font-size:32px; cursor:pointer; padding:8px; border-radius:50%; transition:background 0.2s;" onclick="addReaction('${r}')">${r}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('reaction-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('reaction-modal').classList.remove('hidden');
    closeMessageContextMenu();
}

function closeReactionModal() {
    var modal = document.getElementById('reaction-modal');
    if (modal) modal.remove();
}

async function addReaction(emoji) {
    if (!currentContextMessage || !window.currentChatId) return;
    
    var reactionRef = database.ref('messageReactions/' + currentContextMessage.id + '/' + window.currentUser.uid);
    var currentReaction = await reactionRef.once('value');
    
    if (currentReaction.val() === emoji) {
        await reactionRef.remove();
        showNotification('Реакция убрана', 'info');
    } else {
        await reactionRef.set(emoji);
        showNotification('Реакция добавлена!', 'success');
    }
    
    // Обновляем отображение реакции в сообщении
    updateMessageReactionsDisplay(currentContextMessage.id);
    
    closeReactionModal();
}

async function updateMessageReactionsDisplay(messageId) {
    var messageElement = document.querySelector('.message[data-message-id="' + messageId + '"]');
    if (!messageElement) return;
    
    var reactionsSnap = await database.ref('messageReactions/' + messageId).once('value');
    var reactions = reactionsSnap.val();
    
    if (!reactions) {
        var existingReactions = messageElement.querySelector('.message-reactions');
        if (existingReactions) existingReactions.remove();
        return;
    }
    
    var reactionCounts = {};
    for (var uid in reactions) {
        var emoji = reactions[uid];
        reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    }
    
    var reactionsHtml = '<div class="message-reactions" style="display:flex; gap:6px; margin-top:5px; font-size:14px;">';
    for (var emoji in reactionCounts) {
        reactionsHtml += `<span style="background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:12px; cursor:pointer;">${emoji} ${reactionCounts[emoji]}</span>`;
    }
    reactionsHtml += '</div>';
    
    var existingReactions = messageElement.querySelector('.message-reactions');
    if (existingReactions) existingReactions.remove();
    messageElement.querySelector('.message-content')?.insertAdjacentHTML('beforeend', reactionsHtml);
}

async function deleteMessageForEveryone() {
    if (!currentContextMessage || !window.currentChatId) return;
    
    if (!confirm('Удалить это сообщение у ВСЕХ? Отменить будет невозможно.')) return;
    
    await database.ref('messages/' + window.currentChatId + '/' + currentContextMessage.id).remove();
    showNotification('Сообщение удалено у всех', 'success');
    closeMessageContextMenu();
}

async function deleteMessageForMe() {
    if (!currentContextMessage || !window.currentChatId) return;
    
    // Для удаления только у себя - просто скрываем локально
    var messageElement = document.querySelector('.message[data-message-id="' + currentContextMessage.id + '"]');
    if (messageElement) messageElement.remove();
    
    // Также можно сохранить в localStorage что это сообщение скрыто
    var hiddenMessages = JSON.parse(localStorage.getItem('hidden_messages') || '{}');
    if (!hiddenMessages[window.currentChatId]) hiddenMessages[window.currentChatId] = [];
    hiddenMessages[window.currentChatId].push(currentContextMessage.id);
    localStorage.setItem('hidden_messages', JSON.stringify(hiddenMessages));
    
    showNotification('Сообщение скрыто у вас', 'info');
    closeMessageContextMenu();
}

function closeMessageContextMenu() {
    var menu = document.getElementById('message-context-menu');
    if (menu) menu.remove();
}

window.scrollToMessage = function(messageId) {
    var messageElement = document.querySelector('.message[data-message-id="' + messageId + '"]');
    if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageElement.style.backgroundColor = 'rgba(34,139,34,0.2)';
        setTimeout(function() {
            messageElement.style.backgroundColor = '';
        }, 2000);
    }
};

// ========== ОТПРАВКА СООБЩЕНИЯ (С ОТВЕТОМ) ==========
function sendMessage() {
    var input = document.getElementById('message-input');
    if (!input) return;
    
    var text = input.value.trim();
    if (!text) return;
    if (!currentChatId) return;
    
    var message = {
        type: 'text',
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    if (window.currentReplyTo) {
        message.replyTo = window.currentReplyTo;
        window.currentReplyTo = null;
        var indicator = document.getElementById('reply-indicator');
        if (indicator) indicator.remove();
    }
    
    input.value = '';
    
    // Сохраняем в кэш для офлайн-доступа (но НЕ показываем)
    cacheMessage(currentChatId, message);
    
    database.ref('messages/' + currentChatId).push(message).then(async function(snapshot) {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        await sendPushForMessage(currentChatId, text);
        
        if (typeof KukumberSounds !== 'undefined') KukumberSounds.playSend();
    }).catch(function(err) {
        console.error('Ошибка отправки:', err);
        showNotification('Ошибка отправки', 'error');
        input.value = text;
    });
}
// Отправка push-уведомления
async function sendPushForMessage(chatId, messageText) {
    try {
        var chatSnap = await database.ref('chats/' + chatId).once('value');
        var chatData = chatSnap.val();
        if (!chatData) return;
        
        var recipientId = null;
        var senderName = currentUserData?.username || 'Пользователь';
        
        if (chatData.type === 'private') {
            for (var uid of chatData.participants) {
                if (uid !== currentUser.uid) {
                    recipientId = uid;
                    break;
                }
            }
        } else {
            return;
        }
        
        if (!recipientId) return;
        
        var tokenSnap = await database.ref('users/' + recipientId + '/fcmToken').once('value');
        var token = tokenSnap.val();
        
        if (!token) return;
        
        var shortText = messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText;
        
        var response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=AAAAvNcyvSU:APA91bE2G-ybuDgJLvKv2rJghVQVYOE74w3Jq6yLdgpQv9YGlJ__P21hUq70dMsQ15cBPG0OZ1-JnMj0v3c6K7OQthRdua2RkS5MQe5N2ypAt4ooScdrBWY5VrHD-K4pO-0SeWXh33MF'
            },
            body: JSON.stringify({
                to: token,
                priority: 'high',
                notification: {
                    title: senderName,
                    body: shortText,
                    icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png',
                    badge: 'https://i.ibb.co/23pNfd0W/F449-F920-46-E7-4-E73-85-EF-26-CFF5-CAD938.jpg',
                    sound: 'default'
                },
                data: {
                    chatId: chatId,
                    senderId: currentUser.uid,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                }
            })
        });
    } catch (err) {
        console.error('Ошибка отправки push:', err);
    }
}

// ========== ОСТАЛЬНЫЕ ФУНКЦИИ ==========
function closeChat() {
    if (messagesListener) messagesListener.off();
    window.currentChatId = null;
    window.currentChatData = null;
    loadedMessageIds.clear();
    
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    if (noChatElement) noChatElement.classList.remove('hidden');
    if (activeChatElement) activeChatElement.classList.add('hidden');
    
    var container = document.getElementById('messages-container');
    if (container) container.innerHTML = '';
}

function handleMessageKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function onTyping() {
    if (!window.currentChatId) return;
    database.ref('typing/' + window.currentChatId + '/' + window.currentUser.uid).set(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
        database.ref('typing/' + window.currentChatId + '/' + window.currentUser.uid).remove();
    }, 1000);
}

function openLightbox(url) {
    var lightbox = document.getElementById('image-lightbox');
    var lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        lightboxImg.src = url;
        lightbox.classList.remove('hidden');
    }
}

function closeLightbox() {
    var lightbox = document.getElementById('image-lightbox');
    if (lightbox) lightbox.classList.add('hidden');
}

function playAudio(voiceId) {
    console.log('▶️ Воспроизведение:', voiceId);
    
    if (!voiceId) {
        showNotification('Ошибка: ID не указан', 'error');
        return;
    }
    
    database.ref('voiceMessages/' + voiceId).once('value').then(function(snapshot) {
        var voiceData = snapshot.val();
        
        if (voiceData && voiceData.data) {
            // Создаём аудио элемент
            var audio = new Audio();
            audio.src = voiceData.data;
            audio.volume = 1.0;
            
            // Пробуем воспроизвести
            var playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(function() {
                    console.log('✅ Воспроизведение успешно');
                }).catch(function(error) {
                    console.error('Ошибка:', error);
                    // Показываем кнопку "Разрешить звук"
                    showNotification('🔊 Нажмите на страницу, затем снова на ▶️', 'info');
                });
            }
        } else {
            showNotification('Голосовое не найдено', 'error');
        }
    }).catch(function(err) {
        console.error('Ошибка:', err);
        showNotification('Ошибка загрузки', 'error');
    });
}
// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initChat() {
    window.loadChats = loadChats;
    window.openChatById = openChatById;
    window.closeChat = closeChat;
    window.sendMessage = sendMessage;
    window.handleMessageKeyPress = handleMessageKeyPress;
    window.onTyping = onTyping;
    window.openLightbox = openLightbox;
    window.closeLightbox = closeLightbox;
    window.playAudio = playAudio;
    window.openChatProfile = openChatProfile;
    window.cancelReply = cancelReply;
    window.closeForwardModal = closeForwardModal;
    window.closeReactionModal = closeReactionModal;
    
    setTimeout(function() {
        if (window.currentUser && window.currentUser.uid) loadChats();
    }, 1000);
}

setTimeout(initChat, 1000);
// Функция для преобразования текста с ссылками в HTML
function linkifyText(text) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    // Ссылки http:// и https://
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">$1</a>');
    // Ссылки вида www.example.com
    escaped = escaped.replace(/(^|\s)(www\.[^\s]+)/g, '$1<a href="http://$2" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">$2</a>');
    return escaped;
}
// Обработчик для голосовых сообщений (делегирование)
document.addEventListener('click', function(e) {
    var btn = e.target.closest('.play-voice-btn');
    if (btn) {
        var voiceId = btn.getAttribute('data-voice-id');
        if (voiceId) {
            playAudio(voiceId);
        }
    }
});
// Добавь в конец chat.js, перед console.log
function reloadCurrentChat() {
    if (window.currentChatId && typeof loadMessages === 'function') {
        loadMessages(window.currentChatId);
    }
}
// ========== ОТОБРАЖЕНИЕ БОТА "ИЗБРАННОЕ" В CHAT.JS ==========

// Переопределяем createChatItem для поддержки бота
var originalCreateChatItem = window.createChatItem;
if (originalCreateChatItem) {
    window.createChatItem = async function(chatId, chatData, container) {
        if (chatData.isBot && chatData.botType === 'favorites') {
            var div = document.createElement('div');
            div.className = 'chat-item';
            div.setAttribute('data-chat-id', chatId);
            
            if (window.currentChatId === chatId) div.classList.add('active');
            
            var preview = chatData.lastMessage || 'Нет сообщений';
            var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
            if (preview && preview.length > 50) preview = preview.substring(0, 47) + '...';
            
            var botAvatar = typeof getBotAvatarByTheme === 'function' ? getBotAvatarByTheme() : 'https://i.ibb.co/JjFWkgsP/AF49-D677-0-D26-4-EB1-99-FC-EF7-E2962-C0-A6.png';
            
            div.innerHTML = `
                <div class="chat-item-avatar">
                    <div class="avatar" style="background-image: url(${botAvatar}); background-size: cover;"></div>
                    <span class="chat-type-badge">⭐</span>
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-header">
                        <span class="chat-item-name">📌 Избранное <img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:14px; height:14px; margin-left:4px; vertical-align:middle;"></span>
                        <span class="chat-item-time">${time}</span>
                    </div>
                    <div class="chat-item-preview">${escapeHtml(preview)}</div>
                </div>
            `;
            
            div.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                openChatById(chatId);
                return false;
            };
            
            container.appendChild(div);
            return;
        }
        
        if (originalCreateChatItem) {
            return originalCreateChatItem(chatId, chatData, container);
        }
    };
}

// Переопределяем updateChatHeader для поддержки бота
var originalUpdateChatHeader = window.updateChatHeader;
if (originalUpdateChatHeader) {
    window.updateChatHeader = async function(chatId, chatData) {
        if (chatData.isBot && chatData.botType === 'favorites') {
            var chatUsername = document.getElementById('chat-username');
            var chatStatus = document.getElementById('chat-status');
            var chatAvatar = document.getElementById('chat-avatar');
            var callButtons = document.querySelectorAll('.chat-actions .call-btn');
            
            if (chatUsername) {
                chatUsername.innerHTML = '📌 Избранное <img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:16px; height:16px; margin-left:4px; vertical-align:middle;">';
            }
            if (chatStatus) {
                chatStatus.textContent = 'Бот · Сохраняйте важное';
            }
            if (chatAvatar) {
                var botAvatar = typeof getBotAvatarByTheme === 'function' ? getBotAvatarByTheme() : 'https://i.ibb.co/JjFWkgsP/AF49-D677-0-D26-4-EB1-99-FC-EF7-E2962-C0-A6.png';
                chatAvatar.style.backgroundImage = 'url(' + botAvatar + ')';
                chatAvatar.style.backgroundSize = 'cover';
                chatAvatar.textContent = '';
            }
            callButtons.forEach(function(btn) {
                btn.style.display = 'none';
            });
            return;
        }
        
        if (originalUpdateChatHeader) {
            return originalUpdateChatHeader(chatId, chatData);
        }
    };
}

console.log('✅ Бот "Избранное" интегрирован в chat.js');
window.reloadCurrentChat = reloadCurrentChat;
console.log('✅ chat.js исправлен (контекстное меню + верификация)');
