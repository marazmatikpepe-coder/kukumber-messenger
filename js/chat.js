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
    var callButtons = document.querySelectorAll('.chat-actions .call-btn');
    var backBtn = document.querySelector('.chat-header .back-btn');
    
    if (!chatUsername) return;
    
    // Сбрасываем аватар
    if (chatAvatar) {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.textContent = '';
        chatAvatar.classList.remove('default-avatar-user', 'default-avatar-group', 'default-avatar-channel');
    }
    
    // Скрываем кнопки звонков по умолчанию
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
                chatAvatar.classList.add('default-avatar-channel');
            }
        }
    } 
    // ЛИЧНЫЙ ЧАТ
    else {
        // ПОКАЗЫВАЕМ КНОПКИ ЗВОНКОВ
        callButtons.forEach(function(btn) {
            btn.style.display = 'flex';
        });
        
        // Находим ID собеседника
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
            // Сохраняем ID собеседника в глобальную переменную
            if (window.currentChatData) {
                window.currentChatData.otherUserId = otherUserId;
            }
            
            // Получаем данные пользователя
            var userData = await getUserData(otherUserId);
            chatUsername.textContent = userData.username || 'Пользователь';
            
            // Статус (онлайн/оффлайн)
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
            
            // Аватар
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
    
    // Настраиваем клик по шапке для открытия профиля
    if (backBtn) {
        backBtn.onclick = function() {
            if (typeof closeChat === 'function') closeChat();
        };
    }
    
    var chatUserInfo = document.querySelector('.chat-user-info');
    if (chatUserInfo) {
        // Убираем старый обработчик
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
        
        // Добавляем разделитель после загрузки всех сообщений
        setTimeout(function() {
            addMessagesDivider();
            countNewMessages();
        }, 100);
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
    
    database.ref('messages/' + currentChatId).push(message).then(async function() {
        var lastMsg = text.length > 100 ? text.substring(0, 97) + '...' : text;
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        // ========== ОТПРАВКА PUSH-УВЕДОМЛЕНИЯ ==========
        await sendPushForMessage(currentChatId, text);
        // =============================================
        
        if (typeof KukumberSounds !== 'undefined') KukumberSounds.playSend();
    }).catch(function(err) {
        console.error('Ошибка отправки:', err);
        showNotification('Ошибка отправки', 'error');
        input.value = text;
    });
}

// Функция отправки push-уведомления
async function sendPushForMessage(chatId, messageText) {
    try {
        // Получаем данные чата
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnap.val();
        if (!chatData) return;
        
        // Определяем получателя (не отправителя)
        let recipientId = null;
        let senderName = currentUserData?.username || 'Пользователь';
        
        if (chatData.type === 'private') {
            // Личный чат - отправляем второму участнику
            for (const uid of chatData.participants) {
                if (uid !== currentUser.uid) {
                    recipientId = uid;
                    break;
                }
            }
        } else if (chatData.type === 'group') {
            // Группа - отправляем всем, кроме отправителя (если уведомления включены)
            // Пока отправляем только если пользователь подписан на уведомления группы
            return;
        } else if (chatData.type === 'channel') {
            // Канал - отправляем подписчикам
            return;
        }
        
        if (!recipientId) return;
        
        // Получаем токен получателя
        const tokenSnap = await database.ref('users/' + recipientId + '/fcmToken').once('value');
        const token = tokenSnap.val();
        
        if (!token) {
            console.log('Нет токена у пользователя', recipientId);
            return;
        }
        
        // Короткий текст для уведомления
        const shortText = messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText;
        
        // Отправляем через Firebase Cloud Messaging
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=AAAAvNcyvSU:APA91bE2G-ybuDgJLvKv2rJghVQVYOE74w3Jq6yLdgpQv9YGlJ__P21hUq70dMsQ15cBPG0OZ1-JnMj0v3c6K7OQthRdua2RkS5MQe5N2ypAt4ooScdrBWY5VrHD-K4pO-0SeWXh33MF'
            },
            body: JSON.stringify({
                to: token,
                priority: 'high',
                content_available: true,
                notification: {
                    title: senderName,
                    body: shortText,
                    icon: 'https://i.ibb.co/jPd3zD4K/039-C01-D0-CD06-45-F1-8151-5-B9634-D4-CBFA.png',
                    badge: 'https://i.ibb.co/23pNfd0W/F449-F920-46-E7-4-E73-85-EF-26-CFF5-CAD938.jpg',
                    sound: 'default',
                    vibrate: [200, 100, 200],
                    tag: chatId,
                    renotify: true
                },
                data: {
                    chatId: chatId,
                    senderId: currentUser.uid,
                    senderName: senderName,
                    message: shortText,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK',
                    channelId: 'kukumber_messages'
                }
            })
        });
        
        const data = await response.json();
        console.log('Push отправлен:', data);
        
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
