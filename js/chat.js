// ========================================
// KUKUMBER MESSENGER - CHAT (С ГРУППАМИ И КАНАЛАМИ)
// ========================================

let currentTab = 'all';
let selectedGroupMembers = [];
let groupAvatarFile = null;
let channelAvatarFile = null;

// ========================================
// ЗАГРУЗКА ЧАТОВ
// ========================================

function loadChats() {
    if (!currentUser) return;
    
    database.ref('userChats/' + currentUser.uid).on('value', async snapshot => {
        const chatsData = snapshot.val();
        const chatsList = document.getElementById('chats-list');
        
        if (!chatsData) {
            chatsList.innerHTML = `
                <div class="empty-chats">
                    <p>Пока нет чатов</p>
                    <p>Создайте чат, группу или канал</p>
                </div>
            `;
            return;
        }
        
        const chatIds = Object.keys(chatsData);
        const chats = [];
        
        for (const chatId of chatIds) {
            try {
                const chatSnapshot = await database.ref('chats/' + chatId).once('value');
                const chatData = chatSnapshot.val();
                if (chatData) {
                    chats.push({ chatId, ...chatData });
                }
            } catch (e) {
                console.error('Ошибка загрузки чата:', e);
            }
        }
        
        chats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        renderChatsList(chats);
    });
}

function renderChatsList(chats) {
    const chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '';
    
    const filtered = chats.filter(chat => {
        if (currentTab === 'all') return true;
        if (currentTab === 'private') return chat.type === 'private' || !chat.type;
        if (currentTab === 'groups') return chat.type === 'group';
        if (currentTab === 'channels') return chat.type === 'channel';
        return true;
    });
    
    if (filtered.length === 0) {
        chatsList.innerHTML = '<div class="empty-chats"><p>Нет чатов в этой категории</p></div>';
        return;
    }
    
    filtered.forEach(chat => {
        const chatItem = createChatItemElement(chat);
        chatsList.appendChild(chatItem);
    });
}

async function createChatItemElement(chat) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChatId === chat.chatId) div.classList.add('active');
    
    let name = '';
    let avatar = '';
    let badge = '';
    let isOnline = false;
    
    if (chat.type === 'group') {
        name = chat.name || 'Группа';
        avatar = chat.avatar || '👥';
        badge = '<span class="chat-type-badge">👥</span>';
    } else if (chat.type === 'channel') {
        name = chat.name || 'Канал';
        avatar = chat.avatar || '📢';
        badge = '<span class="chat-type-badge">📢</span>';
    } else {
        const otherUserId = chat.participants?.find(id => id !== currentUser.uid);
        if (otherUserId) {
            try {
                const userSnap = await database.ref('users/' + otherUserId).once('value');
                const userData = userSnap.val();
                name = userData?.username || 'Пользователь';
                avatar = userData?.avatar || '👤';
                isOnline = userData?.status?.online || false;
                chat.otherUserId = otherUserId;
                chat.otherUser = userData;
            } catch (e) {
                name = 'Пользователь';
                avatar = '👤';
            }
        }
    }
    
    const avatarStyle = avatar.startsWith('http') ? `background-image: url(${avatar}); font-size: 0;` : '';
    const avatarContent = avatar.startsWith('http') ? '' : avatar;
    const time = chat.lastMessageTime ? formatTime(chat.lastMessageTime) : '';
    const preview = chat.lastMessage || 'Нет сообщений';
    
    div.innerHTML = `
        <div class="chat-item-avatar">
            <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
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
    
    div.onclick = () => openChat(chat);
    
    return div;
}

// ========================================
// ВКЛАДКИ
// ========================================

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');
    loadChats();
}

// ========================================
// ОТКРЫТИЕ ЧАТА
// ========================================

async function openChat(chat) {
    currentChatId = chat.chatId;
    currentChatUser = chat;
    
    closeSidebar();
    
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('active-chat').classList.remove('hidden');
    
    let name = '';
    let avatar = '';
    let status = '';
    
    if (chat.type === 'group') {
        name = chat.name;
        avatar = chat.avatar || '👥';
        const membersCount = chat.members ? Object.keys(chat.members).length : 0;
        status = `${membersCount} участник(ов)`;
        document.querySelectorAll('.call-btn').forEach(btn => btn.style.display = 'none');
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    } else if (chat.type === 'channel') {
        name = chat.name;
        avatar = chat.avatar || '📢';
        const subsCount = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
        status = `${subsCount} подписчик(ов)`;
        document.querySelectorAll('.call-btn').forEach(btn => btn.style.display = 'none');
        
        const isAdmin = chat.admins && chat.admins[currentUser.uid];
        if (isAdmin) {
            document.getElementById('message-input-area').classList.remove('hidden');
            document.getElementById('channel-footer').classList.add('hidden');
        } else {
            document.getElementById('message-input-area').classList.add('hidden');
            document.getElementById('channel-footer').classList.remove('hidden');
        }
    } else {
        name = chat.otherUser?.username || 'Пользователь';
        avatar = chat.otherUser?.avatar || '👤';
        status = chat.otherUser?.status?.online ? 'в сети' : 'был(а) недавно';
        document.querySelectorAll('.call-btn').forEach(btn => btn.style.display = '');
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    }
    
    document.getElementById('chat-username').textContent = name;
    document.getElementById('chat-status').textContent = status;
    
    const chatAvatar = document.getElementById('chat-avatar');
    if (avatar.startsWith('http')) {
        chatAvatar.style.backgroundImage = `url(${avatar})`;
        chatAvatar.textContent = '';
    } else {
        chatAvatar.style.backgroundImage = '';
        chatAvatar.textContent = avatar;
    }
    
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    
    loadMessages(chat.chatId);
}

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

// ========================================
// СООБЩЕНИЯ
// ========================================

function loadMessages(chatId) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    
    if (messagesListener) {
        messagesListener.off();
    }
    
    messagesListener = database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(100);
    
    messagesListener.on('child_added', async snapshot => {
        const message = snapshot.val();
        message.id = snapshot.key;
        
        const messageEl = await createMessageElement(message);
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    });
}

async function createMessageElement(message) {
    const div = document.createElement('div');
    const isSent = message.senderId === currentUser.uid;
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    
    let senderName = '';
    if (!isSent && (currentChatUser?.type === 'group' || currentChatUser?.type === 'channel')) {
        try {
            const userSnap = await database.ref('users/' + message.senderId + '/username').once('value');
            senderName = userSnap.val() || 'Пользователь';
        } catch (e) {
            senderName = 'Пользователь';
        }
    }
    
    let content = '';
    if (message.type === 'image') {
        content = `
            <div class="message-image" onclick="openLightbox('${message.imageUrl}')">
                <img src="${message.imageUrl}" alt="Image" loading="lazy">
            </div>
            ${message.caption ? `<div class="message-text">${escapeHtml(message.caption)}</div>` : ''}
        `;
    } else {
        content = `<div class="message-text">${escapeHtml(message.text || '')}</div>`;
    }
    
    div.innerHTML = `
        <div class="message-content">
            ${senderName ? `<div class="message-sender">${escapeHtml(senderName)}</div>` : ''}
            ${content}
            <div class="message-time">${formatTime(message.timestamp)}</div>
        </div>
    `;
    
    return div;
}

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
    
    input.value = '';
    
    database.ref('messages/' + currentChatId).push(message)
        .then(() => {
            return database.ref('chats/' + currentChatId).update({
                lastMessage: text.length > 50 ? text.substring(0, 50) + '...' : text,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .catch(error => {
            console.error('Ошибка отправки:', error);
            showNotification('Ошибка отправки', 'error');
            input.value = text;
        });
    
    document.getElementById('emoji-picker').classList.add('hidden');
}

function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleTyping() {}

// ========================================
// ПОИСК
// ========================================

function searchChats() {
    const text = document.getElementById('search-chats').value.toLowerCase();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-item-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(text) ? 'flex' : 'none';
    });
}

// ========================================
// НОВЫЙ ЛИЧНЫЙ ЧАТ
// ========================================

function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    loadAllUsers();
}

function closeNewChatDialog() {
    document.getElementById('new-chat-modal').classList.add('hidden');
}

async function loadAllUsers() {
    const list = document.getElementById('users-list');
    list.innerHTML = '<div class="loading-users">Загрузка...</div>';
    
    try {
        const snapshot = await database.ref('users').once('value');
        const users = snapshot.val();
        
        if (!users) {
            list.innerHTML = '<div class="no-users">Пользователи не найдены</div>';
            return;
        }
        
        list.innerHTML = '';
        
        Object.keys(users).forEach(userId => {
            if (userId === currentUser.uid) return;
            const user = users[userId];
            
            const div = document.createElement('div');
            div.className = 'user-item';
            div.onclick = () => startPrivateChat(userId, user);
            
            const avatar = user.avatar || '👤';
            const avatarStyle = avatar.startsWith('http') ? `background-image: url(${avatar}); font-size: 0;` : '';
            
            div.innerHTML = `
                <div class="avatar" style="${avatarStyle}">${avatar.startsWith('http') ? '' : avatar}</div>
                <div class="user-item-info">
                    <h4>${escapeHtml(user.username || 'Пользователь')}</h4>
                    <p>${escapeHtml(user.email || '')}</p>
                </div>
            `;
            
            list.appendChild(div);
        });
        
        if (list.children.length === 0) {
            list.innerHTML = '<div class="no-users">Пользователей не найдено</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        list.innerHTML = '<div class="no-users">Ошибка загрузки</div>';
    }
}

function searchUsers() {
    const text = document.getElementById('new-chat-search').value.toLowerCase();
    document.querySelectorAll('#users-list .user-item').forEach(item => {
        const name = item.textContent.toLowerCase();
        item.style.display = name.includes(text) ? 'flex' : 'none';
    });
}

async function startPrivateChat(otherUserId, otherUser) {
    const chatId = generateChatId(currentUser.uid, otherUserId);
    
    try {
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        
        if (!chatSnap.exists()) {
            await database.ref('chats/' + chatId).set({
                type: 'private',
                participants: [currentUser.uid, otherUserId],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: '',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
            
            await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
            await database.ref('userChats/' + otherUserId + '/' + chatId).set(true);
        }
        
        closeNewChatDialog();
        
        openChat({
            chatId,
            type: 'private',
            otherUserId,
            otherUser
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка создания чата', 'error');
    }
}

// ========================================
// СОЗДАНИЕ ГРУППЫ
// ========================================

function showCreateGroupDialog() {
    document.getElementById('create-group-modal').classList.remove('hidden');
    document.getElementById('group-step-1').classList.remove('hidden');
    document.getElementById('group-step-2').classList.add('hidden');
    document.getElementById('group-name').value = '';
    document.getElementById('group-description').value = '';
    document.getElementById('group-avatar-preview').style.backgroundImage = '';
    document.getElementById('group-avatar-preview').textContent = '👥';
    selectedGroupMembers = [];
    groupAvatarFile = null;
}

function closeCreateGroupDialog() {
    document.getElementById('create-group-modal').classList.add('hidden');
}

function previewGroupAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        groupAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('group-avatar-preview');
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function goToGroupStep2() {
    const name = document.getElementById('group-name').value.trim();
    if (!name) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    document.getElementById('group-step-1').classList.add('hidden');
    document.getElementById('group-step-2').classList.remove('hidden');
    loadGroupMembersList();
}

function goToGroupStep1() {
    document.getElementById('group-step-2').classList.add('hidden');
    document.getElementById('group-step-1').classList.remove('hidden');
}

async function loadGroupMembersList() {
    const list = document.getElementById('group-members-list');
    list.innerHTML = '<div class="loading-users">Загрузка...</div>';
    
    try {
        const snapshot = await database.ref('users').once('value');
        const users = snapshot.val();
        
        list.innerHTML = '';
        
        Object.keys(users).forEach(userId => {
            if (userId === currentUser.uid) return;
            const user = users[userId];
            
            const div = document.createElement('div');
            div.className = 'user-item';
            if (selectedGroupMembers.find(m => m.id === userId)) {
                div.classList.add('selected');
            }
            
            div.onclick = () => toggleGroupMember(userId, user);
            
            const avatar = user.avatar || '👤';
            const avatarStyle = avatar.startsWith('http') ? `background-image: url(${avatar}); font-size: 0;` : '';
            
            div.innerHTML = `
                <div class="avatar" style="${avatarStyle}">${avatar.startsWith('http') ? '' : avatar}</div>
                <div class="user-item-info">
                    <h4>${escapeHtml(user.username || 'Пользователь')}</h4>
                </div>
                <span class="check-mark">${selectedGroupMembers.find(m => m.id === userId) ? '✓' : ''}</span>
            `;
            
            list.appendChild(div);
        });
    } catch (error) {
        list.innerHTML = '<div class="no-users">Ошибка загрузки</div>';
    }
}

function toggleGroupMember(userId, user) {
    const index = selectedGroupMembers.findIndex(m => m.id === userId);
    
    if (index > -1) {
        selectedGroupMembers.splice(index, 1);
    } else {
        selectedGroupMembers.push({ id: userId, ...user });
    }
    
    renderSelectedMembers();
    loadGroupMembersList();
}

function renderSelectedMembers() {
    const container = document.getElementById('selected-members');
    container.innerHTML = selectedGroupMembers.map(m => `
        <div class="selected-member-chip">
            <span>${escapeHtml(m.username || 'Пользователь')}</span>
            <button onclick="removeSelectedMember('${m.id}')">&times;</button>
        </div>
    `).join('');
}

function removeSelectedMember(userId) {
    selectedGroupMembers = selectedGroupMembers.filter(m => m.id !== userId);
    renderSelectedMembers();
    loadGroupMembersList();
}

function searchGroupMembers() {
    const text = document.getElementById('group-members-search').value.toLowerCase();
    document.querySelectorAll('#group-members-list .user-item').forEach(item => {
        const name = item.textContent.toLowerCase();
        item.style.display = name.includes(text) ? 'flex' : 'none';
    });
}

async function createGroup() {
    const name = document.getElementById('group-name').value.trim();
    const description = document.getElementById('group-description').value.trim();
    
    if (!name) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    try {
        let avatarUrl = '';
        if (groupAvatarFile) {
            const imgData = await uploadImageToImgBB(groupAvatarFile);
            if (imgData) avatarUrl = imgData.url;
        }
        
        const chatId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const members = { [currentUser.uid]: true };
        selectedGroupMembers.forEach(m => members[m.id] = true);
        
        await database.ref('chats/' + chatId).set({
            type: 'group',
            name: name,
            description: description,
            avatar: avatarUrl,
            members: members,
            admins: { [currentUser.uid]: true },
            createdBy: currentUser.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Группа создана',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        for (const member of selectedGroupMembers) {
            await database.ref('userChats/' + member.id + '/' + chatId).set(true);
        }
        
        closeCreateGroupDialog();
        showNotification('Группа создана!', 'success');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка создания группы', 'error');
    }
}

// ========================================
// СОЗДАНИЕ КАНАЛА
// ========================================

function showCreateChannelDialog() {
    document.getElementById('create-channel-modal').classList.remove('hidden');
    document.getElementById('channel-name').value = '';
    document.getElementById('channel-description').value = '';
    document.getElementById('channel-link').value = '';
    document.getElementById('channel-avatar-preview').style.backgroundImage = '';
    document.getElementById('channel-avatar-preview').textContent = '📢';
    document.getElementById('channel-link-hint').textContent = '';
    channelAvatarFile = null;
}

function closeCreateChannelDialog() {
    document.getElementById('create-channel-modal').classList.add('hidden');
}

function previewChannelAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        channelAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('channel-avatar-preview');
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function validateChannelLink() {
    const link = document.getElementById('channel-link').value.trim().toLowerCase();
    const hint = document.getElementById('channel-link-hint');
    
    if (!link) {
        hint.textContent = '';
        hint.className = 'link-hint';
        return;
    }
    
    if (!/^[a-z0-9_]+$/.test(link)) {
        hint.textContent = 'Только латинские буквы, цифры и _';
        hint.className = 'link-hint error';
        return;
    }
    
    if (link.length < 3) {
        hint.textContent = 'Минимум 3 символа';
        hint.className = 'link-hint error';
        return;
    }
    
    hint.textContent = 'kukumber.com/' + link;
    hint.className = 'link-hint success';
}

async function createChannel() {
    const name = document.getElementById('channel-name').value.trim();
    const description = document.getElementById('channel-description').value.trim();
    const link = document.getElementById('channel-link').value.trim().toLowerCase();
    const isPublic = document.querySelector('input[name="channel-type"]:checked').value === 'public';
    
    if (!name) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    try {
        let avatarUrl = '';
        if (channelAvatarFile) {
            const imgData = await uploadImageToImgBB(channelAvatarFile);
            if (imgData) avatarUrl = imgData.url;
        }
        
        const chatId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await database.ref('chats/' + chatId).set({
            type: 'channel',
            name: name,
            description: description,
            avatar: avatarUrl,
            link: link || null,
            isPublic: isPublic,
            subscribers: { [currentUser.uid]: true },
            admins: { [currentUser.uid]: true },
            createdBy: currentUser.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Канал создан',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        
        if (link) {
            await database.ref('channelLinks/' + link).set(chatId);
        }
        
        closeCreateChannelDialog();
        showNotification('Канал создан!', 'success');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка создания канала', 'error');
    }
}

// ========================================
// ИНФОРМАЦИЯ О ЧАТЕ
// ========================================

async function showChatInfo() {
    if (!currentChatUser) return;
    
    const modal = document.getElementById('chat-info-modal');
    modal.classList.remove('hidden');
    
    const chat = currentChatUser;
    
    document.getElementById('info-title').textContent = 
        chat.type === 'group' ? 'Информация о группе' :
        chat.type === 'channel' ? 'Информация о канале' : 'Информация';
    
    let name = '';
    let avatar = '';
    let status = '';
    let description = '';
    
    if (chat.type === 'group') {
        name = chat.name;
        avatar = chat.avatar || '👥';
        const count = chat.members ? Object.keys(chat.members).length : 0;
        status = `${count} участник(ов)`;
        description = chat.description || '';
        
        document.getElementById('channel-stats').classList.add('hidden');
        document.getElementById('group-members-section').classList.remove('hidden');
        document.getElementById('members-count').textContent = count;
        
        loadMembersList(chat.members, chat.admins);
        
        const isAdmin = chat.admins && chat.admins[currentUser.uid];
        document.getElementById('add-member-btn').style.display = isAdmin ? '' : 'none';
        document.getElementById('leave-btn').classList.remove('hidden');
        document.getElementById('subscribe-btn').classList.add('hidden');
        document.getElementById('unsubscribe-btn').classList.add('hidden');
        document.getElementById('delete-btn').classList.toggle('hidden', !isAdmin);
        
    } else if (chat.type === 'channel') {
        name = chat.name;
        avatar = chat.avatar || '📢';
        const count = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
        status = chat.isPublic ? 'Публичный канал' : 'Приватный канал';
        description = chat.description || '';
        
        document.getElementById('channel-stats').classList.remove('hidden');
        document.getElementById('subscribers-count').textContent = count;
        document.getElementById('group-members-section').classList.add('hidden');
        
        const isSubscribed = chat.subscribers && chat.subscribers[currentUser.uid];
        const isAdmin = chat.admins && chat.admins[currentUser.uid];
        
        document.getElementById('leave-btn').classList.add('hidden');
        document.getElementById('subscribe-btn').classList.toggle('hidden', isSubscribed);
        document.getElementById('unsubscribe-btn').classList.toggle('hidden', !isSubscribed || isAdmin);
        document.getElementById('delete-btn').classList.toggle('hidden', !isAdmin);
        
    } else {
        name = chat.otherUser?.username || 'Пользователь';
        avatar = chat.otherUser?.avatar || '👤';
        status = chat.otherUser?.status?.online ? 'в сети' : 'был(а) недавно';
        
        document.getElementById('channel-stats').classList.add('hidden');
        document.getElementById('group-members-section').classList.add('hidden');
        document.getElementById('leave-btn').classList.add('hidden');
        document.getElementById('subscribe-btn').classList.add('hidden');
        document.getElementById('unsubscribe-btn').classList.add('hidden');
        document.getElementById('delete-btn').classList.remove('hidden');
    }
    
    document.getElementById('info-name').textContent = name;
    document.getElementById('info-status').textContent = status;
    document.getElementById('info-description').textContent = description;
    
    const infoAvatar = document.getElementById('info-avatar');
    if (avatar.startsWith('http')) {
        infoAvatar.style.backgroundImage = `url(${avatar})`;
        infoAvatar.textContent = '';
    } else {
        infoAvatar.style.backgroundImage = '';
        infoAvatar.textContent = avatar;
    }
}

function closeChatInfo() {
    document.getElementById('chat-info-modal').classList.add('hidden');
}

async function loadMembersList(members, admins) {
    const list = document.getElementById('info-members-list');
    list.innerHTML = '';
    
    if (!members) return;
    
    for (const memberId of Object.keys(members)) {
        try {
            const userSnap = await database.ref('users/' + memberId).once('value');
            const user = userSnap.val();
            if (!user) continue;
            
            const isAdmin = admins && admins[memberId];
            const avatar = user.avatar || '👤';
            const avatarStyle = avatar.startsWith('http') ? `background-image: url(${avatar}); font-size: 0;` : 
