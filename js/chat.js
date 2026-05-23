// KUKUMBER MESSENGER - CHAT.JS (ИСПРАВЛЕННАЯ ВЕРСИЯ)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var currentUser = null;
var currentUserData = null;
var currentChatId = null;
var currentChatData = null;
var messagesListener = null;
var chatsListener = null;
var typingTimeout = null;
var loadedMessageIds = new Set();

// Кэши для оптимизации
var userCache = {
    names: {},
    avatars: {},
    statuses: {}
};

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

// ========== ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ==========
async function getUserData(userId) {
    if (!userId) return null;
    
    if (userCache.names[userId] && Date.now() - (userCache.names[userId]._time || 0) < 60000) {
        return {
            username: userCache.names[userId].value,
            avatar: userCache.avatars[userId]?.value || '',
            status: userCache.statuses[userId]?.value || { online: false }
        };
    }
    
    try {
        var snapshot = await database.ref('users/' + userId).once('value');
        var data = snapshot.val();
        if (data) {
            userCache.names[userId] = { value: data.username || 'Пользователь', _time: Date.now() };
            userCache.avatars[userId] = { value: data.avatar || '', _time: Date.now() };
            userCache.statuses[userId] = { value: data.status || { online: false }, _time: Date.now() };
            return {
                username: data.username || 'Пользователь',
                avatar: data.avatar || '',
                status: data.status || { online: false }
            };
        }
    } catch (err) {
        console.error('Ошибка получения данных пользователя:', err);
    }
    return { username: 'Пользователь', avatar: '', status: { online: false } };
}

// ========== ЗАГРУЗКА СПИСКА ЧАТОВ ==========
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
            database.ref('chats/' + chatId).once('value', function(chatSnap) {
                var chat = chatSnap.val();
                if (chat) chatsData[chatId] = chat;
                loadedCount++;
                if (loadedCount === chatIds.length) renderChatsList(chatsData);
            });
        });
    });
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

// ========== СОЗДАНИЕ ЭЛЕМЕНТА ЧАТА ==========
async function createChatItem(chatId, chatData, container) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    div.setAttribute('data-chat-id', chatId);
    
    if (window.currentChatId === chatId) div.classList.add('active');
    
    var name = '';
    var avatarUrl = '';
    var badge = '';
    var isOnline = false;
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
    } 
    else {
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
    
    div.innerHTML = `
        <div class="chat-item-avatar">
            <div class="avatar ${defaultClass}" style="${avatarStyle}">${avatarContent}</div>
            ${isOnline ? '<div class="online-indicator"></div>' : ''}
            ${badge}
        </div>
        <div class="chat-item-info">
            <div class="chat-item-header">
                <span class="chat-item-name">${escapeHtml(name)}</span>
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

// ========== ОТКРЫТИЕ ЧАТА С ДАННЫМИ (ГЛАВНАЯ ФУНКЦИЯ) ==========
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
    
    // Обновляем активный класс
    document.querySelectorAll('.chat-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-chat-id') === chatId) item.classList.add('active');
    });
    
    // Показываем область чата
    var noChatElement = document.getElementById('no-chat-selected');
    var activeChatElement = document.getElementById('active-chat');
    if (noChatElement) noChatElement.classList.add('hidden');
    if (activeChatElement) {
        activeChatElement.classList.remove('hidden');
        activeChatElement.style.display = 'flex';
    }
    
    // Обновляем шапку
    await updateChatHeader(chatId, chatData);
    
    // Настраиваем клик по шапке
    setTimeout(function() { setupChatHeaderClick(); }, 100);
    
    // Загружаем сообщения
    loadMessages(chatId);
}

// ========== ОБНОВЛЕНИЕ ШАПКИ ЧАТА ==========
async function updateChatHeader(chatId, chatData) {
    var chatUsername = document.getElementById('chat-username');
    var chatStatus = document.getElementById('chat-status');
    var chatAvatar = document.getElementById('chat-avatar');
    
    if (!chatUsername) return;
    
    if (chatAvatar) {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.textContent = '';
        chatAvatar.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
    }
    
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
                chatAvatar.textContent = '👥';
                chatAvatar.classList.add('default-avatar-group');
            }
        }
    } 
    else if (chatData.type === 'channel') {
        chatUsername.textContent = chatData.name || 'Канал';
        if (chatStatus) {
            var subsCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
            chatStatus.textContent = subsCount + ' подписчиков';
        }
        if (chatAvatar) {
            if (chatData.avatar) {
                chatAvatar.style.backgroundImage = 'url(' + chatData.avatar + ')';
                chatAvatar.style.backgroundSize = 'cover';
            } else {
                chatAvatar.textContent = '📢';
                chatAvatar.classList.add('default-avatar-channel');
            }
        }
    } 
    else {
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
            window.currentChatData.otherUserId = otherUserId;
            var userData = await getUserData(otherUserId);
            chatUsername.textContent = userData.username;
            if (chatStatus) {
                chatStatus.innerHTML = userData.status.online ? 'в сети' : formatLastSeen(userData.status.lastSeen);
            }
            if (chatAvatar) {
                if (userData.avatar) {
                    chatAvatar.style.backgroundImage = 'url(' + userData.avatar + ')';
                    chatAvatar.style.backgroundSize = 'cover';
                } else {
                    chatAvatar.textContent = '👤';
                    chatAvatar.classList.add('default-avatar-user');
                }
            }
        } else {
            chatUsername.textContent = 'Пользователь';
            if (chatStatus) chatStatus.textContent = 'неизвестно';
            if (chatAvatar) {
                chatAvatar.textContent = '👤';
                chatAvatar.classList.add('default-avatar-user');
            }
        }
    }
}

// ========== НАСТРОЙКА КЛИКА ПО ШАПКЕ ==========
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

// ========== ОТКРЫТИЕ ПРОФИЛЯ ==========
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
        setTimeout(function() { container.scrollTop = container.scrollHeight; }, 100);
    });
}

// ========== ДОБАВЛЕНИЕ СООБЩЕНИЯ ==========
function appendMessage(message) {
    var container = document.getElementById('messages-container');
    if (!container) return;
    
    var isSent = message.senderId === window.currentUser.uid;
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    messageDiv.setAttribute('data-message-id', message.id);
    
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
            <div class="message-reply" onclick="window.scrollToMessage && window.scrollToMessage('${message.replyTo.messageId}')" style="background: rgba(0,0,0,0.05); border-left: 3px solid var(--forest); padding: 6px 10px; border-radius: 10px; margin-bottom: 6px; cursor: pointer; font-size: 12px;">
                <div style="font-weight: 600; color: var(--forest);">↩️ ${escapeHtml(message.replyTo.senderName)}</div>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayReplyText)}</div>
            </div>
        `;
    }
    
    if (message.type === 'image') {
        content += `
            <div class="message-image" onclick="openLightbox('${message.imageUrl}')">
                <img src="${message.imageUrl}" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;">
            </div>
            ${message.caption ? '<div class="message-text">' + escapeHtml(message.caption) + '</div>' : ''}
        `;
    } 
    else if (message.type === 'gif') {
        content += `
            <div class="gif-message" onclick="openLightbox('${message.gifUrl}')">
                <img src="${message.gifUrl}" loading="lazy" style="max-width:250px; max-height:250px; border-radius:12px;">
                <span class="gif-badge">GIF</span>
            </div>
        `;
    }
    else if (message.type === 'audio') {
        content += `<div class="audio-message"><button onclick="playAudio('${message.audioUrl}')">▶️</button><span>Голосовое сообщение ${message.duration ? '(' + message.duration + ' сек)' : ''}</span></div>`;
    }
    else if (message.type === 'video') {
        content += `<div class="video-message"><video src="${message.videoUrl}" controls preload="metadata" style="max-width:250px; max-height:300px; border-radius:12px;"></video></div>`;
    }
    else if (message.type === 'file') {
        content += `<div class="file-message"><span style="font-size:24px;">📎</span><a href="${message.fileUrl}" target="_blank">${escapeHtml(message.fileName)}</a></div>`;
    }
    else {
        var textContent = escapeHtml(message.text || '');
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

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
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
    
    input.value = '';
    
    database.ref('messages/' + currentChatId).push(message).then(function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        if (typeof KukumberSounds !== 'undefined') KukumberSounds.playSend();
    }).catch(function(err) {
        console.error('Ошибка отправки:', err);
        showNotification('Ошибка отправки', 'error');
        input.value = text;
    });
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

function playAudio(url) {
    var audio = new Audio(url);
    audio.play().catch(function(e) { console.log('Ошибка воспроизведения аудио:', e); });
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
    
    setTimeout(function() {
        if (window.currentUser && window.currentUser.uid) loadChats();
    }, 1000);
}

setTimeout(initChat, 1000);
console.log('✅ chat.js исправлен и загружен');
// ========== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (ПОЛНАЯ ВЕРСИЯ) ==========
window.openUserProfile = async function(userId) {
    console.log('openUserProfile:', userId);
    
    if (!userId) {
        showNotification('ID пользователя не указан', 'error');
        return;
    }
    
    try {
        const userSnap = await database.ref('users/' + userId).once('value');
        const userData = userSnap.val();
        
        if (!userData) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        const isOwnProfile = (userId === window.currentUser?.uid);
        const isAdmin = window.isSuperAdmin === true;
        const canEdit = isOwnProfile || isAdmin;
        
        // Получаем статус
        const statusData = userData.status || {};
        const isOnline = statusData.online === true;
        const lastSeen = statusData.lastSeen;
        
        // Подписчики
        const subsSnap = await database.ref('subscriptions').orderByChild(userId).equalTo(true).once('value');
        const subscribersCount = subsSnap.val() ? Object.keys(subsSnap.val()).length : 0;
        
        // Проверяем подписку
        let isSubscribed = false;
        let notificationsEnabled = false;
        if (!isOwnProfile) {
            const subSnap = await database.ref('subscriptions/' + window.currentUser.uid + '/' + userId).once('value');
            isSubscribed = subSnap.exists();
            const notifSnap = await database.ref('subscriptionNotifications/' + window.currentUser.uid + '/' + userId).once('value');
            notificationsEnabled = notifSnap.val() === true;
        }
        
        const userName = userData.username || 'Пользователь';
        const userTag = userData.userTag || '@' + userName.toLowerCase().replace(/\s/g, '');
        const userAvatar = userData.avatar || '';
        const userBio = userData.bio || 'Нет описания';
        const userBanner = userData.banner || null;
        const userVerified = userData.verified === true;
        
        // Баннер
        let bannerStyle = '';
        if (userBanner) {
            if (userBanner.startsWith('#')) {
                bannerStyle = `background: ${userBanner};`;
            } else {
                bannerStyle = `background-image: url(${userBanner}); background-size: cover; background-position: center;`;
            }
        } else {
            bannerStyle = 'background: linear-gradient(135deg, #228B22, #556B2F);';
        }
        
        // Статус текст
        let statusText = '';
        if (isOnline) {
            statusText = '<span style="color: #32CD32;">● В сети</span>';
        } else if (lastSeen) {
            const lastSeenDate = new Date(lastSeen);
            const now = new Date();
            const diff = Math.floor((now - lastSeenDate) / 1000);
            if (diff < 60) statusText = 'был(а) только что';
            else if (diff < 3600) statusText = `был(а) ${Math.floor(diff / 60)} мин назад`;
            else if (diff < 86400) statusText = `был(а) сегодня в ${lastSeenDate.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}`;
            else statusText = `был(а) ${lastSeenDate.toLocaleDateString('ru-RU')}`;
        } else {
            statusText = 'неизвестно';
        }
        
        // Удаляем старое окно
        const oldModal = document.getElementById('user-profile-modal');
        if (oldModal) oldModal.remove();
        
        // Создаём модальное окно
        const modal = document.createElement('div');
        modal.id = 'user-profile-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10003';
        modal.innerHTML = `
            <div class="profile-modal-content" style="max-width: 450px; border-radius: 24px; overflow: hidden; background: white; position: relative;">
                <!-- Баннер -->
                <div class="profile-banner" id="profile-banner" style="height: 140px; position: relative; ${bannerStyle}">
                    ${canEdit ? '<button id="edit-banner-btn" class="profile-banner-edit-btn" style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px;">✏️</button>' : ''}
                    <button class="profile-close-btn" onclick="closeUserProfileModal()" style="position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.5); border: none; color: white; font-size: 20px; cursor: pointer;">×</button>
                </div>
                
                <!-- Аватар (накрывает баннер) -->
                <div style="display: flex; justify-content: center; margin-top: -50px; position: relative; z-index: 5;">
                    <div class="profile-avatar" id="profile-avatar" style="width: 100px; height: 100px; border-radius: 50%; border: 4px solid white; background: var(--sage); display: flex; align-items: center; justify-content: center; font-size: 45px; ${userAvatar ? 'background-image: url(' + userAvatar + '); background-size: cover; background-position: center;' : ''} cursor: pointer;">
                        ${userAvatar ? '' : '👤'}
                        ${canEdit ? '<button id="edit-avatar-btn" class="profile-avatar-edit-btn" style="position: absolute; bottom: 0; right: 0; background: var(--forest); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px;">✏️</button>' : ''}
                    </div>
                </div>
                
                <!-- Информация -->
                <div style="text-align: center; padding: 15px 20px 20px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                        <h2 id="profile-name" style="margin: 0; cursor: ${canEdit ? 'pointer' : 'default'};">${escapeHtml(userName)}</h2>
                        ${userVerified ? '<img id="verified-badge" src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width: 20px; height: 20px; cursor: pointer;" onclick="showVerifiedInfo()">' : ''}
                        ${isAdmin ? '<button id="toggle-verified-btn" class="btn-small" style="background: none; border: none; cursor: pointer; font-size: 14px;">🔘 ' + (userVerified ? 'Снять' : 'Выдать') + '</button>' : ''}
                        ${canEdit ? '<span id="edit-name-icon" style="cursor: pointer; font-size: 16px;">✏️</span>' : ''}
                    </div>
                    <div class="profile-username" style="color: var(--text-muted); margin: 5px 0;">${escapeHtml(userTag)}</div>
                    <div class="profile-subscribers" style="margin: 5px 0;">👥 ${subscribersCount} подписчиков</div>
                    <div class="profile-status" style="margin: 5px 0; font-size: 13px;">${statusText}</div>
                    
                    ${!isOwnProfile ? `
                        <div style="display: flex; gap: 10px; justify-content: center; margin: 15px 0;">
                            <button id="profile-subscribe-btn" class="btn-primary" style="padding: 10px 20px; background: ${isSubscribed ? '#555' : 'var(--forest)'};">${isSubscribed ? 'Отписаться' : 'Подписаться'}</button>
                            <button id="profile-notify-btn" class="btn-secondary" style="padding: 10px 20px; opacity: ${notificationsEnabled ? '1' : '0.5'};">🔔</button>
                            <button id="profile-chat-btn" class="btn-secondary" style="padding: 10px 20px;" onclick="startPrivateChatFromProfile('${userId}')">💬 Написать</button>
                        </div>
                    ` : ''}
                    
                    <div class="profile-bio" style="margin-top: 10px; padding: 10px; background: var(--background); border-radius: 16px; text-align: left;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600;">📝 О себе</span>
                            ${canEdit ? '<button id="edit-bio-btn" style="background: none; border: none; cursor: pointer;">✏️</button>' : ''}
                        </div>
                        <p id="profile-bio-text" style="margin: 8px 0 0 0; color: var(--text-light);">${escapeHtml(userBio)}</p>
                    </div>
                </div>
                
                <!-- Вкладки -->
                <div style="display: flex; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
                    <button id="profile-tab-posts" class="profile-tab-btn active" style="flex: 1; padding: 12px; background: none; border: none; cursor: pointer; font-weight: 600; color: var(--forest); border-bottom: 2px solid var(--forest);">📷 Посты</button>
                    <button id="profile-tab-reposts" class="profile-tab-btn" style="flex: 1; padding: 12px; background: none; border: none; cursor: pointer;">🔄 Репосты</button>
                </div>
                
                <!-- Контент вкладок -->
                <div id="profile-posts-container" style="padding: 15px; max-height: 400px; overflow-y: auto;">
                    <div class="profile-loading">Загрузка постов...</div>
                </div>
                <div id="profile-reposts-container" style="padding: 15px; max-height: 400px; overflow-y: auto; display: none;">
                    <div class="profile-loading">Загрузка репостов...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        // Сохраняем ID для использования в других функциях
        window.viewingProfileUserId = userId;
        window.viewingProfileUserData = userData;
        
        // Загружаем посты и репосты
        await loadUserPosts(userId);
        await loadUserReposts(userId);
        
        // Привязываем обработчики
        bindUserProfileEvents(userId, userData, isOwnProfile, isAdmin, canEdit, isSubscribed, notificationsEnabled);
        
    } catch (err) {
        console.error('Ошибка открытия профиля:', err);
        showNotification('Ошибка загрузки профиля', 'error');
    }
};

// Загрузка постов пользователя
async function loadUserPosts(userId) {
    const container = document.getElementById('profile-posts-container');
    if (!container) return;
    
    container.innerHTML = '<div class="profile-loading">Загрузка постов...</div>';
    
    const slicesSnap = await database.ref('slices').orderByChild('authorId').equalTo(userId).once('value');
    const slices = slicesSnap.val();
    
    if (!slices) {
        container.innerHTML = '<div class="profile-empty">Нет постов</div>';
        return;
    }
    
    let postsHtml = '';
    const slicesArray = [];
    for (let id in slices) {
        const slice = slices[id];
        if (slice.type !== 'repost') {
            slicesArray.push({ id: id, data: slice });
        }
    }
    slicesArray.sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
    
    for (const slice of slicesArray) {
        const mediaHtml = slice.data.mediaUrl ? 
            `<div class="slice-media" style="margin-bottom: 10px;"><img src="${slice.data.mediaUrl}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; cursor: pointer;" onclick="openSliceLightbox('${slice.data.mediaUrl}')"></div>` : '';
        
        postsHtml += `
            <div class="profile-slice-card" style="background: var(--background); border-radius: 16px; margin-bottom: 15px; overflow: hidden;">
                ${mediaHtml}
                <div style="padding: 12px;">
                    <div style="font-size: 14px; color: var(--text-light); margin-bottom: 8px;">${escapeHtml(slice.data.text || '')}</div>
                    <div style="display: flex; gap: 15px; font-size: 12px; color: var(--text-muted);">
                        <span>❤️ ${slice.data.likesCount || 0}</span>
                        <span>💬 ${slice.data.commentsCount || 0}</span>
                        <span>🔄 ${slice.data.repostsCount || 0}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = postsHtml || '<div class="profile-empty">Нет постов</div>';
}

// Загрузка репостов пользователя
async function loadUserReposts(userId) {
    const container = document.getElementById('profile-reposts-container');
    if (!container) return;
    
    container.innerHTML = '<div class="profile-loading">Загрузка репостов...</div>';
    
    const slicesSnap = await database.ref('slices').orderByChild('authorId').equalTo(userId).once('value');
    const slices = slicesSnap.val();
    
    if (!slices) {
        container.innerHTML = '<div class="profile-empty">Нет репостов</div>';
        return;
    }
    
    let repostsHtml = '';
    const repostsArray = [];
    for (let id in slices) {
        const slice = slices[id];
        if (slice.type === 'repost') {
            repostsArray.push({ id: id, data: slice });
        }
    }
    repostsArray.sort((a, b) => (b.data.createdAt || 0) - (a.data.createdAt || 0));
    
    for (const repost of repostsArray) {
        repostsHtml += `
            <div class="profile-slice-card" style="background: var(--background); border-radius: 16px; margin-bottom: 15px; overflow: hidden; padding: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span>🔄</span>
                    <span style="font-size: 12px; color: var(--text-muted);">Репост от @${escapeHtml(repost.data.originalAuthorName || 'пользователя')}</span>
                </div>
                <div style="font-size: 14px;">${escapeHtml(repost.data.originalText || '')}</div>
                <button class="btn-small" style="margin-top: 8px; padding: 4px 12px;" onclick="deleteRepost('${repost.id}')">Удалить репост</button>
            </div>
        `;
    }
    
    container.innerHTML = repostsHtml || '<div class="profile-empty">Нет репостов</div>';
}

// Удаление репоста
window.deleteRepost = async function(repostId) {
    if (!confirm('Удалить репост?')) return;
    
    const repostSnap = await database.ref('slices/' + repostId).once('value');
    const repostData = repostSnap.val();
    const originalId = repostData?.originalId;
    
    await database.ref('slices/' + repostId).remove();
    await database.ref('userReposts/' + window.currentUser.uid + '/' + originalId).remove();
    if (originalId) {
        await database.ref('slices/' + originalId + '/repostsCount').transaction(c => Math.max((c || 1) - 1, 0));
    }
    
    showNotification('Репост удалён', 'success');
    if (window.viewingProfileUserId) {
        loadUserReposts(window.viewingProfileUserId);
    }
};

// Привязка событий профиля
function bindUserProfileEvents(userId, userData, isOwnProfile, isAdmin, canEdit, isSubscribed, notificationsEnabled) {
    // Переключение вкладок
    const postsTab = document.getElementById('profile-tab-posts');
    const repostsTab = document.getElementById('profile-tab-reposts');
    const postsContainer = document.getElementById('profile-posts-container');
    const repostsContainer = document.getElementById('profile-reposts-container');
    
    if (postsTab) {
        postsTab.onclick = () => {
            postsTab.classList.add('active');
            postsTab.style.color = 'var(--forest)';
            postsTab.style.borderBottom = '2px solid var(--forest)';
            repostsTab.classList.remove('active');
            repostsTab.style.color = '';
            repostsTab.style.borderBottom = 'none';
            postsContainer.style.display = 'block';
            repostsContainer.style.display = 'none';
        };
    }
    
    if (repostsTab) {
        repostsTab.onclick = () => {
            repostsTab.classList.add('active');
            repostsTab.style.color = 'var(--forest)';
            repostsTab.style.borderBottom = '2px solid var(--forest)';
            postsTab.classList.remove('active');
            postsTab.style.color = '';
            postsTab.style.borderBottom = 'none';
            postsContainer.style.display = 'none';
            repostsContainer.style.display = 'block';
        };
    }
    
    // Редактирование имени
    if (canEdit) {
        const editNameIcon = document.getElementById('edit-name-icon');
        const nameElement = document.getElementById('profile-name');
        if (editNameIcon) {
            editNameIcon.onclick = async () => {
                const newName = prompt('Введите новое имя:', userData.username || '');
                if (newName && newName.trim()) {
                    await database.ref('users/' + userId + '/username').set(newName.trim());
                    showNotification('Имя обновлено', 'success');
                    nameElement.textContent = newName.trim();
                }
            };
        }
        if (nameElement) {
            nameElement.ondblclick = () => editNameIcon?.onclick();
        }
    }
    
    // Редактирование био
    if (canEdit) {
        const editBioBtn = document.getElementById('edit-bio-btn');
        const bioText = document.getElementById('profile-bio-text');
        if (editBioBtn) {
            editBioBtn.onclick = async () => {
                const newBio = prompt('Введите новое описание:', userData.bio || '');
                if (newBio !== null) {
                    await database.ref('users/' + userId + '/bio').set(newBio.trim());
                    showNotification('Описание обновлено', 'success');
                    bioText.textContent = newBio.trim() || 'Нет описания';
                }
            };
        }
    }
    
    // Редактирование аватара
    if (canEdit) {
        const editAvatarBtn = document.getElementById('edit-avatar-btn');
        if (editAvatarBtn) {
            editAvatarBtn.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    showNotification('Загрузка аватара...', 'info');
                    try {
                        const url = await uploadToImgBB(file);
                        await database.ref('users/' + userId + '/avatar').set(url);
                        showNotification('Аватар обновлён', 'success');
                        const avatarDiv = document.getElementById('profile-avatar');
                        if (avatarDiv) {
                            avatarDiv.style.backgroundImage = `url(${url})`;
                            avatarDiv.style.backgroundSize = 'cover';
                            avatarDiv.textContent = '';
                        }
                    } catch (err) {
                        showNotification('Ошибка загрузки', 'error');
                    }
                };
                input.click();
            };
        }
    }
    
    // Редактирование баннера
    if (canEdit) {
        const editBannerBtn = document.getElementById('edit-banner-btn');
        if (editBannerBtn) {
            editBannerBtn.onclick = () => {
                const colors = ['#228B22', '#556B2F', '#1a5c1a', '#32CD32', '#6b8e6b', '#000000', '#1E90FF', '#FFD700', '#FFA500', '#FF69B4'];
                let colorPickerHtml = '<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; padding: 10px;">';
                colors.forEach(color => {
                    colorPickerHtml += `<div style="width: 45px; height: 45px; border-radius: 50%; background: ${color}; cursor: pointer;" onclick="setUserBanner('${userId}', '${color}')"></div>`;
                });
                colorPickerHtml += '</div><div style="text-align:center;"><button onclick="uploadUserBannerImage(\'' + userId + '\')" class="btn-primary">📷 Загрузить картинку</button></div>';
                showCustomModal('Выберите баннер', colorPickerHtml);
            };
        }
    }
    
    // Подписка
    if (!isOwnProfile) {
        const subBtn = document.getElementById('profile-subscribe-btn');
        if (subBtn) {
            subBtn.onclick = async () => {
                const subRef = database.ref('subscriptions/' + window.currentUser.uid + '/' + userId);
                const snap = await subRef.once('value');
                if (snap.exists()) {
                    await subRef.remove();
                    showNotification('Вы отписались', 'info');
                    subBtn.textContent = 'Подписаться';
                    subBtn.style.background = 'var(--forest)';
                } else {
                    await subRef.set(true);
                    showNotification('Вы подписались', 'success');
                    subBtn.textContent = 'Отписаться';
                    subBtn.style.background = '#555';
                }
                // Обновляем счётчик
                const newSubsSnap = await database.ref('subscriptions').orderByChild(userId).equalTo(true).once('value');
                const newCount = newSubsSnap.val() ? Object.keys(newSubsSnap.val()).length : 0;
                const subsDiv = document.querySelector('.profile-subscribers');
                if (subsDiv) subsDiv.textContent = `👥 ${newCount} подписчиков`;
            };
        }
        
        // Уведомления
        const notifBtn = document.getElementById('profile-notify-btn');
        if (notifBtn) {
            notifBtn.onclick = async () => {
                const notifRef = database.ref('subscriptionNotifications/' + window.currentUser.uid + '/' + userId);
                const snap = await notifRef.once('value');
                if (snap.val() === true) {
                    await notifRef.remove();
                    showNotification('Уведомления выключены', 'info');
                    notifBtn.style.opacity = '0.5';
                } else {
                    await notifRef.set(true);
                    showNotification('Уведомления включены', 'success');
                    notifBtn.style.opacity = '1';
                }
            };
        }
    }
    
    // Верификация (только для админов)
    if (isAdmin) {
        const toggleVerifiedBtn = document.getElementById('toggle-verified-btn');
        if (toggleVerifiedBtn) {
            toggleVerifiedBtn.onclick = async () => {
                const newVerified = !userData.verified;
                await database.ref('users/' + userId + '/verified').set(newVerified);
                showNotification(newVerified ? 'Галочка выдана' : 'Галочка снята', 'success');
                location.reload();
            };
        }
    }
}

// Установка баннера пользователя
window.setUserBanner = async function(userId, color) {
    await database.ref('users/' + userId + '/banner').set(color);
    showNotification('Баннер обновлён', 'success');
    closeCustomModal();
    const bannerDiv = document.getElementById('profile-banner');
    if (bannerDiv) {
        bannerDiv.style.background = color;
        bannerDiv.style.backgroundImage = 'none';
    }
};

window.uploadUserBannerImage = async function(userId) {
    closeCustomModal();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка баннера...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('users/' + userId + '/banner').set(url);
            showNotification('Баннер обновлён', 'success');
            const bannerDiv = document.getElementById('profile-banner');
            if (bannerDiv) {
                bannerDiv.style.backgroundImage = `url(${url})`;
                bannerDiv.style.backgroundSize = 'cover';
                bannerDiv.style.backgroundPosition = 'center';
            }
        } catch (err) {
            showNotification('Ошибка загрузки', 'error');
        }
    };
    input.click();
};

window.showCustomModal = function(title, contentHtml) {
    const oldModal = document.getElementById('custom-modal');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'custom-modal';
    modal.className = 'modal';
    modal.style.zIndex = '10005';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px; border-radius: 24px;">
            <div class="modal-header">
                <h3>${title}</h3>
                <button onclick="closeCustomModal()" class="btn-close">×</button>
            </div>
            <div style="padding: 10px 20px 20px;">
                ${contentHtml}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
};

window.closeCustomModal = function() {
    const modal = document.getElementById('custom-modal');
    if (modal) modal.remove();
};

window.showVerifiedInfo = function() {
    alert('Этот пользователь имеет подтверждённый, верифицированный аккаунт 🌟');
};

window.closeUserProfileModal = function() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.remove();
    window.viewingProfileUserId = null;
};

window.openSlicesProfile = function() {
    if (window.currentUser && window.currentUser.uid) {
        window.openUserProfile(window.currentUser.uid);
    } else {
        showNotification('Авторизуйтесь', 'error');
    }
};

console.log('✅ Полный профиль пользователя загружен');
