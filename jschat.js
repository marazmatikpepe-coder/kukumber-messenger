// Загрузка списка чатов
function loadChats() {
    const chatsRef = database.ref('userChats/' + currentUser.uid);
    
    chatsRef.on('value', snapshot => {
        const chats = snapshot.val() || {};
        const chatsList = document.getElementById('chats-list');
        chatsList.innerHTML = '';

        const chatPromises = Object.keys(chats).map(chatId => {
            return database.ref('chats/' + chatId).once('value')
                .then(chatSnapshot => {
                    const chatData = chatSnapshot.val();
                    if (chatData) {
                        const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
                        return database.ref('users/' + otherUserId).once('value')
                            .then(userSnapshot => {
                                return {
                                    chatId: chatId,
                                    chatData: chatData,
                                    otherUser: userSnapshot.val(),
                                    otherUserId: otherUserId
                                };
                            });
                    }
                });
        });

        Promise.all(chatPromises).then(chatDataArray => {
            chatDataArray
                .filter(data => data)
                .sort((a, b) => (b.chatData.lastMessageTime || 0) - (a.chatData.lastMessageTime || 0))
                .forEach(data => {
                    const chatItem = createChatItem(data.chatId, data.otherUser, data.chatData);
                    chatsList.appendChild(chatItem);
                });
        });
    });
}

// Создание элемента чата
function createChatItem(chatId, otherUser, chatData) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat(chatId, otherUser);
    
    const lastMessage = chatData.lastMessage || 'Начните общение';
    const time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
    
    div.innerHTML = `
        <div class="avatar">👤</div>
        <div class="chat-item-info">
            <div class="chat-item-header">
                <span class="chat-item-name">${otherUser.username}</span>
                <span class="chat-item-time">${time}</span>
            </div>
            <div class="chat-item-preview">${lastMessage}</div>
        </div>
    `;
    
    return div;
}

// Открыть чат
function openChat(chatId, otherUser) {
    currentChatId = chatId;
    
    // Обновить UI
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('active-chat').classList.remove('hidden');
    document.getElementById('chat-username').textContent = otherUser.username;
    
    // Обновить активный чат в списке
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Загрузить сообщения
    loadMessages(chatId);
    
    // Отслеживать статус пользователя
    trackUserStatus(otherUser);
}

// Загрузка сообщений
function loadMessages(chatId) {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.innerHTML = '';
    
    // Отписаться от предыдущего чата
    if (messagesListener) {
        messagesListener.off();
    }
    
    // Подписаться на новые сообщения
    messagesListener = database.ref('messages/' + chatId);
    messagesListener.on('child_added', snapshot => {
        const message = snapshot.val();
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Создание элемента сообщения
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = message.senderId === currentUser.uid ? 'message sent' : 'message received';
    
    div.innerHTML = `
        <div class="message-content">
            <div class="message-text">${escapeHtml(message.text)}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
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
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Сохранить сообщение
    database.ref('messages/' + currentChatId).push(message)
        .then(() => {
            // Обновить информацию о чате
            return database.ref('chats/' + currentChatId).update({
                lastMessage: text,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => {
            input.value = '';
        })
        .catch(error => {
            console.error('Ошибка отправки сообщения:', error);
            showNotification('Ошибка отправки сообщения', 'error');
        });
}

// Обработка Enter
function handleMessageKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Поиск чатов
function searchChats() {
    const searchText = document.getElementById('search-chats').value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        const username = item.querySelector('.chat-item-name').textContent.toLowerCase();
        item.style.display = username.includes(searchText) ? 'flex' : 'none';
    });
}

// Показать диалог нового чата
function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    loadAllUsers();
}

// Закрыть диалог нового чата
function closeNewChatDialog() {
    document.getElementById('new-chat-modal').classList.add('hidden');
}

// Загрузка всех пользователей
function loadAllUsers() {
    database.ref('users').once('value')
        .then(snapshot => {
            const users = snapshot.val();
            const usersList = document.getElementById('users-list');
            usersList.innerHTML = '';
            
            Object.keys(users).forEach(userId => {
                if (userId !== currentUser.uid) {
                    const user = users[userId];
                    const userItem = createUserItem(userId, user);
                    usersList.appendChild(userItem);
                }
            });
        });
}

// Создание элемента пользователя
function createUserItem(userId, user) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.onclick = () => startNewChat(userId, user);
    
    div.innerHTML = `
        <div class="avatar">👤</div>
        <div>
            <div style="font-weight: bold;">${user.username}</div>
            <div style="font-size: 14px; color: var(--text-light);">${user.email}</div>
        </div>
    `;
    
    return div;
}

// Начать новый чат
async function startNewChat(otherUserId, otherUser) {
    const chatId = generateChatId(currentUser.uid, otherUserId);
    
    try {
        // Проверить, существует ли чат
        const chatSnapshot = await database.ref('chats/' + chatId).once('value');
        
        if (!chatSnapshot.exists()) {
            // Создать новый чат
            await database.ref('chats/' + chatId).set({
                participants: [currentUser.uid, otherUserId],
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Добавить чат обоим пользователям
            await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
            await database.ref('userChats/' + otherUserId + '/' + chatId).set(true);
        }
        
        closeNewChatDialog();
        openChat(chatId, otherUser);
        
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        showNotification('Ошибка создания чата', 'error');
    }
}

// Поиск пользователей
function searchUsers() {
    const searchText = document.getElementById('new-chat-search').value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const username = item.textContent.toLowerCase();
        item.style.display = username.includes(searchText) ? 'flex' : 'none';
    });
}

// Отслеживание статуса пользователя
function trackUserStatus(otherUser) {
    // Реализация отслеживания онлайн статуса
    const statusElement = document.getElementById('chat-status');
    // Можно подписаться на изменения статуса в реальном времени
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}