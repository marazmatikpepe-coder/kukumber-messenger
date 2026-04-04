// ========================================
// KUKUMBER MESSENGER - CHAT
// ========================================

// ========================================
// ЗАГРУЗКА СПИСКА ЧАТОВ
// ========================================

function loadChats() {
    if (!currentUser) return;
    
    const chatsRef = database.ref('userChats/' + currentUser.uid);
    
    chatsRef.on('value', async snapshot => {
        const chatsData = snapshot.val();
        const chatsList = document.getElementById('chats-list');
        
        if (!chatsData) {
            chatsList.innerHTML = `
                <div class="empty-chats">
                    <p>Пока нет чатов</p>
                    <p>Нажмите "+ Новый чат" чтобы начать</p>
                </div>
            `;
            return;
        }
        
        // Получаем информацию о всех чатах
        const chatIds = Object.keys(chatsData);
        const chatPromises = chatIds.map(chatId => loadChatInfo(chatId));
        
        try {
            const chats = await Promise.all(chatPromises);
            const validChats = chats.filter(c => c !== null);
            
            // Сортировка по времени последнего сообщения
            validChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
            
            // Отрисовка
            chatsList.innerHTML = '';
            validChats.forEach(chat => {
                const chatItem = createChatItem(chat);
                chatsList.appendChild(chatItem);
            });
            
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
        }
    });
}

// Загрузка информации о чате
async function loadChatInfo(chatId) {
    try {
        const chatSnapshot = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnapshot.val();
        
        if (!chatData || !chatData.participants) return null;
        
        // Находим ID другого пользователя
        const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
        if (!otherUserId) return null;
        
        // Получаем данные другого пользователя
        const userSnapshot = await database.ref('users/' + otherUserId).once('value');
        const userData = userSnapshot.val();
        
        if (!userData) return null;
        
        return {
            chatId: chatId,
            otherUserId: otherUserId,
            otherUser: userData,
            lastMessage: chatData.lastMessage || '',
            lastMessageTime: chatData.lastMessageTime || 0
        };
        
    } catch (error) {
        console.error('Ошибка загрузки чата:', error);
        return null;
    }
}

// Создание элемента чата
function createChatItem(chat) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChatId === chat.chatId) {
        div.classList.add('active');
    }
    
    div.onclick = () => openChat(chat.chatId, chat.otherUser, chat.otherUserId);
    
    const isOnline = chat.otherUser.status && chat.otherUser.status.online;
    const timeStr = chat.lastMessageTime ? formatTime(chat.lastMessageTime) : '';
    
    // Аватарка
    let avatarContent = '👤';
    let avatarStyle = '';
    if (chat.otherUser.avatar) {
        avatarContent = '';
        avatarStyle = `background-image: url(${chat.otherUser.avatar}); background-size: cover;`;
    }
    
    div.innerHTML = `
        <div class="chat-item-avatar">
            <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
            ${isOnline ? '<div class="online-indicator"></div>' : ''}
        </div>
        <div class="chat-item-info">
            <div class="chat-item-header">
                <span class="chat-item-name">${escapeHtml(chat.otherUser.username || 'Пользователь')}</span>
                <span class="chat-item-time">${timeStr}</span>
            </div>
            <div class="chat-item-preview">${escapeHtml(chat.lastMessage || 'Начните общение')}</div>
        </div>
    `;
    
    return div;
}

// ========================================
// ОТКРЫТИЕ ЧАТА
// ========================================

function openChat(chatId, otherUser, otherUserId) {
    currentChatId = chatId;
    currentChatUser = { ...otherUser, odUserId };
    
    // Закрываем боковую панель на мобильных
    closeSidebar();
    
    // Обновляем UI
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('active-chat').classList.remove('hidden');
    
    // Заполняем информацию о пользователе
    document.getElementById('chat-username').textContent = otherUser.username || 'Пользователь';
    
    // Аватарка
    const chatAvatar = document.getElementById('chat-avatar');
    if (otherUser.avatar) {
        chatAvatar.style.backgroundImage = `url(${otherUser.avatar})`;
        chatAvatar.textContent = '';
    } else {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.textContent = '👤';
    }
    
    // Обновляем активный чат в списке
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Отслеживаем статус пользователя
    trackUserStatus(otherUserId);
    
    // Загружаем сообщения
    loadMessages(chatId);
    
    // Скрываем emoji picker
    document.getElementById('emoji-picker').classList.add('hidden');
}

// Закрыть чат (для мобильных)
function closeChat() {
    document.getElementById('active-chat').classList.add('hidden');
    document.getElementById('no-chat-selected').classList.remove('hidden');
    currentChatId = null;
    currentChatUser = null;
    
    if (messagesListener) {
        messagesListener.off();
        messagesListener = null;
    }
}

// Отслеживание статуса пользователя
function trackUserStatus(userId) {
    database.ref('users/' + userId + '/status').on('value', snapshot => {
        const status = snapshot.val();
        const statusElement = document.getElementById('chat-status');
        
        if (status && status.online) {
            statusElement.textContent = 'в сети';
            statusElement.classList.add('online');
        } else {
            statusElement.textContent = formatStatus(status);
            statusElement.classList.remove('online');
        }
    });
}

// ========================================
// СООБЩЕНИЯ
// ========================================

function loadMessages(chatId) {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.innerHTML = '';
    
    // Отписываемся от предыдущего чата
    if (messagesListener) {
        messagesListener.off();
    }
    
    // Подписываемся на сообщения
    messagesListener = database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(100);
    
    messagesListener.on('child_added', snapshot => {
        const message = snapshot.val();
        message.id = snapshot.key;
        
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
        
        // Прокручиваем вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Создание элемента сообщения
function createMessageElement(message) {
    const div = document.createElement('div');
    const isSent = message.senderId === currentUser.uid;
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    
    let content = '';
    
    // Если это изображение
    if (message.type === 'image') {
        content = `
            <div class="message-image" onclick="openLightbox('${message.imageUrl}')">
                <img src="${message.imageUrl}" alt="Изображение" loading="lazy">
            </div>
            ${message.caption ? `<div class="message-caption">${escapeHtml(message.caption)}</div>` : ''}
        `;
    } else {
        // Текстовое сообщение
        content = `<div class="message-text">${escapeHtml(message.text || '')}</div>`;
    }
    
    div.innerHTML = `
        <div class="message-content">
            ${content}
            <div class="message-time">
                ${formatTime(message.timestamp)}
                ${isSent ? '<span class="message-status">✓</span>' : ''}
            </div>
        </div>
    `;
    
    return div;
}

// Отправка сообщения
function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text || !currentChatId) return;
    
    const message = {
        type: 'text',
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Очищаем поле сразу для лучшего UX
    input.value = '';
    
    // Отправляем сообщение
    database.ref('messages/' + currentChatId).push(message)
        .then(() => {
            // Обновляем последнее сообщение в чате
            return database.ref('chats/' + currentChatId).update({
                lastMessage: text.length > 50 ? text.substring(0, 50) + '...' : text,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .catch(error => {
            console.error('Ошибка отправки:', error);
            showNotification('Ошибка отправки сообщения', 'error');
            input.value = text; // Возвращаем текст обратно
        });
    
    // Скрываем emoji picker
    document.getElementById('emoji-picker').classList.add('hidden');
}

// Обработка нажатия Enter
function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Индикатор набора текста
function handleTyping() {
    if (!currentChatId) return;
    
    // Устанавливаем статус "печатает"
    database.ref('typing/' + currentChatId + '/' + currentUser.uid).set(true);
    
    // Сбрасываем таймер
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // Убираем статус через 2 секунды
    typingTimeout = setTimeout(() => {
        database.ref('typing/' + currentChatId + '/' + currentUser.uid).remove();
    }, 2000);
}

// ========================================
// ПОИСК И НОВЫЙ ЧАТ
// ========================================

function searchChats() {
    const searchText = document.getElementById('search-chats').value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        const name = item.querySelector('.chat-item-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(searchText) ? 'flex' : 'none';
    });
}

function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    document.getElementById('new-chat-search').value = '';
    loadAllUsers();
}

function closeNewChatDialog() {
    document.getElementById('new-chat-modal').classList.add('hidden');
}

// Загрузка всех пользователей
async function loadAllUsers() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<div class="loading-users">Загрузка пользователей...</div>';
    
    try {
        const snapshot = await database.ref('users').once('value');
        const users = snapshot.val();
        
        if (!users) {
            usersList.innerHTML = '<div class="no-users">Пользователи не найдены</div>';
            return;
        }
        
        usersList.innerHTML = '';
        
        Object.keys(users).forEach(userId => {
            // Не показываем себя
            if (userId === currentUser.uid) return;
            
            const user = users[userId];
            const userItem = createUserItem(userId, user);
            usersList.appendChild(userItem);
        });
        
        if (usersList.children.length === 0) {
            usersList.innerHTML = '<div class="no-users">Других пользователей пока нет</div>';
        }
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        usersList.innerHTML = '<div class="no-users">Ошибка загрузки</div>';
    }
}

// Создание элемента пользователя
function createUserItem(userId, user) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.onclick = () => startNewChat(userId, user);
    
    let avatarContent = '👤';
    let avatarStyle = '';
    if (user.avatar) {
        avatarContent = '';
        avatarStyle = `background-image: url(${user.avatar}); background-size: cover;`;
    }
    
    div.innerHTML = `
        <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
        <div class="user-item-info">
            <h4>${escapeHtml(user.username || 'Пользователь')}</h4>
            <p>${escapeHtml(user.email || '')}</p>
        </div>
    `;
    
    return div;
}

// Поиск пользователей
function searchUsers() {
    const searchText = document.getElementById('new-chat-search').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchText) ? 'flex' : 'none';
    });
}

// Начать новый чат
async function startNewChat(otherUserId, otherUser) {
    const chatId = generateChatId(currentUser.uid, otherUserId);
    
    try {
        // Проверяем, существует ли чат
        const chatSnapshot = await database.ref('chats/' + chatId).once('value');
        
        if (!chatSnapshot.exists()) {
            // Создаём новый чат
            await database.ref('chats/' + chatId).set({
                participants: [currentUser.uid, otherUserId],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: '',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Добавляем чат обоим пользователям
            await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
            await database.ref('userChats/' + otherUserId + '/' + chatId).set(true);
        }
        
        closeNewChatDialog();
        
        // Открываем чат
        // Симулируем клик для правильной работы
        const fakeEvent = { currentTarget: document.createElement('div') };
        window.event = fakeEvent;
        openChat(chatId, otherUser, otherUserId);
        
        showNotification('Чат создан!', 'success');
        
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        showNotification('Ошибка создания чата', 'error');
    }
}

// ========================================
// ЭМОДЗИ
// ========================================

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('hidden');
}

function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    input.value += emoji;
    input.focus();
}

// Закрыть emoji при клике вне
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emoji-picker');
    const emojiBtn = document.querySelector('.message-input-area .btn-icon[title="Эмодзи"]');
    
    if (!picker.contains(e.target) && !emojiBtn?.contains(e.target)) {
        picker.classList.add('hidden');
    }
});

// ========================================
// ПРОСМОТР ИЗОБРАЖЕНИЙ
// ========================================

function openLightbox(imageUrl) {
    const lightbox = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-image');
    img.src = imageUrl;
    lightbox.classList.remove('hidden');
}

function closeLightbox() {
    document.getElementById('image-lightbox').classList.add('hidden');
}

// Закрыть по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLightbox();
        closeImagePreview();
        document.getElementById('emoji-picker').classList.add('hidden');
    }
});
