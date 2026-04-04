// ========================================
// KUKUMBER MESSENGER - CHAT
// ========================================

var currentTab = 'all';
var selectedGroupMembers = [];
var groupAvatarFile = null;
var channelAvatarFile = null;

// ========================================
// ПОИСК ЧАТОВ
// ========================================

function searchChats() {
    var text = document.getElementById('search-chats').value.toLowerCase().trim();
    
    // Убираем старые результаты поиска
    var searchResults = document.querySelectorAll('.search-result');
    for (var i = 0; i < searchResults.length; i++) {
        searchResults[i].remove();
    }
    
    // Обычный поиск по существующим чатам
    var chatItems = document.querySelectorAll('.chat-item:not(.search-result)');
    for (var j = 0; j < chatItems.length; j++) {
        var item = chatItems[j];
        var nameEl = item.querySelector('.chat-item-name');
        if (nameEl) {
            var nameText = nameEl.textContent.toLowerCase();
            item.style.display = nameText.indexOf(text) !== -1 ? 'flex' : 'none';
        }
    }
    
    // Если текст >= 3 символов, ищем публичные каналы
    if (text.length >= 3) {
        searchPublicChannels(text);
    }
}

function searchPublicChannels(searchText) {
    if (!currentUser) return;
    
    database.ref('chats').once('value')
    .then(function(snapshot) {
        var chats = snapshot.val();
        if (!chats) return;
        
        var chatsList = document.getElementById('chats-list');
        
        Object.keys(chats).forEach(function(chatId) {
            var chat = chats[chatId];
            
            // Только публичные каналы
            if (chat.type !== 'channel' || !chat.isPublic) return;
            
            // Проверяем, не подписан ли уже
            if (chat.subscribers && chat.subscribers[currentUser.uid]) return;
            
            // Проверяем название
            var name = (chat.name || '').toLowerCase();
            if (name.indexOf(searchText) === -1) return;
            
            // Проверяем, не показан ли уже
            if (document.querySelector('[data-search-channel="' + chatId + '"]')) return;
            
            // Показываем канал
            var div = document.createElement('div');
            div.className = 'chat-item search-result';
            div.setAttribute('data-search-channel', chatId);
            
            var avatar = chat.avatar || '';
            var avatarStyle = avatar ? 'background-image: url(' + avatar + '); background-size: cover;' : '';
            var avatarContent = avatar ? '' : '📢';
            var subsCount = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
            
            div.innerHTML = 
                '<div class="chat-item-avatar">' +
                    '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
                    '<span class="chat-type-badge">📢</span>' +
                '</div>' +
                '<div class="chat-item-info">' +
                    '<div class="chat-item-header">' +
                        '<span class="chat-item-name">' + escapeHtml(chat.name) + '</span>' +
                        '<span class="chat-item-time">' + subsCount + ' подп.</span>' +
                    '</div>' +
                    '<div class="chat-item-preview">Нажмите чтобы подписаться</div>' +
                '</div>';
            
            div.onclick = function() {
                subscribeToPublicChannel(chatId, chat);
            };
            
            chatsList.insertBefore(div, chatsList.firstChild);
        });
    })
    .catch(function(error) {
        console.error('Ошибка поиска каналов:', error);
    });
}

function subscribeToPublicChannel(chatId, channel) {
    database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true)
    .then(function() {
        return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
    })
    .then(function() {
        showNotification('Вы подписались на "' + channel.name + '"', 'success');
        
        var searchResult = document.querySelector('[data-search-channel="' + chatId + '"]');
        if (searchResult) searchResult.remove();
        
        loadChats();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка подписки', 'error');
    });
}

// ========================================
// ЗАГРУЗКА ЧАТОВ
// ========================================

function loadChats() {
    if (!currentUser) return;
    
    database.ref('userChats/' + currentUser.uid).on('value', function(snapshot) {
        var chatsData = snapshot.val();
        var chatsList = document.getElementById('chats-list');
        
        if (!chatsData) {
            chatsList.innerHTML = '<div class="empty-chats"><p>Пока нет чатов</p><p>Создайте чат, группу или канал</p></div>';
            return;
        }
        
        var chatIds = Object.keys(chatsData);
        var loadedChats = [];
        var loadedCount = 0;
        
        chatIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value')
            .then(function(chatSnapshot) {
                var chatData = chatSnapshot.val();
                if (chatData) {
                    loadedChats.push({ chatId: chatId, data: chatData });
                }
                
                loadedCount++;
                
                if (loadedCount === chatIds.length) {
                    renderChats(loadedChats);
                }
            })
            .catch(function(error) {
                console.error('Ошибка загрузки чата:', error);
                loadedCount++;
                if (loadedCount === chatIds.length) {
                    renderChats(loadedChats);
                }
            });
        });
    });
}

function renderChats(chats) {
    var chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '';
    
    // Сортировка по времени
    chats.sort(function(a, b) {
        return (b.data.lastMessageTime || 0) - (a.data.lastMessageTime || 0);
    });
    
    // Фильтрация по вкладке
    var filtered = chats.filter(function(chat) {
        if (currentTab === 'all') return true;
        if (currentTab === 'private') return chat.data.type === 'private' || !chat.data.type;
        if (currentTab === 'groups') return chat.data.type === 'group';
        if (currentTab === 'channels') return chat.data.type === 'channel';
        return true;
    });
    
    if (filtered.length === 0) {
        chatsList.innerHTML = '<div class="empty-chats"><p>Нет чатов в этой категории</p></div>';
        return;
    }
    
    filtered.forEach(function(chat) {
        createChatItem(chat.chatId, chat.data);
    });
}

function createChatItem(chatId, chatData) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChatId === chatId) div.classList.add('active');
    
    var name = '';
    var avatar = '';
    var badge = '';
    var isOnline = false;
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatar = chatData.avatar || '';
        badge = '<span class="chat-type-badge">👥</span>';
        finishChatItem();
    } else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatar = chatData.avatar || '';
        badge = '<span class="chat-type-badge">📢</span>';
        finishChatItem();
    } else {
        // Личный чат - загружаем данные собеседника
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== currentUser.uid) {
                    otherUserId = chatData.participants[i];
                    break;
                }
            }
        }
        
        if (otherUserId) {
            database.ref('users/' + otherUserId).once('value')
            .then(function(userSnap) {
                var userData = userSnap.val();
                name = userData ? (userData.username || 'Пользователь') : 'Пользователь';
                avatar = userData ? (userData.avatar || '') : '';
                isOnline = userData && userData.status && userData.status.online;
                
                chatData.otherUserId = otherUserId;
                chatData.otherUser = userData;
                
                finishChatItem();
            })
            .catch(function() {
                name = 'Пользователь';
                finishChatItem();
            });
        } else {
            name = 'Пользователь';
            finishChatItem();
        }
    }
    
    function finishChatItem() {
        var avatarStyle = '';
        var avatarContent = '';
        
        if (avatar && avatar.indexOf('http') === 0) {
            avatarStyle = 'background-image: url(' + avatar + '); background-size: cover;';
            avatarContent = '';
        } else {
            if (chatData.type === 'group') {
                avatarContent = '👥';
            } else if (chatData.type === 'channel') {
                avatarContent = '📢';
            } else {
                avatarContent = '👤';
            }
        }
        
        var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
        var preview = chatData.lastMessage || 'Нет сообщений';
        
        div.innerHTML = 
            '<div class="chat-item-avatar">' +
                '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
                (isOnline ? '<div class="online-indicator"></div>' : '') +
                badge +
            '</div>' +
            '<div class="chat-item-info">' +
                '<div class="chat-item-header">' +
                    '<span class="chat-item-name">' + escapeHtml(name) + '</span>' +
                    '<span class="chat-item-time">' + time + '</span>' +
                '</div>' +
                '<div class="chat-item-preview">' + escapeHtml(preview) + '</div>' +
            '</div>';
        
        div.onclick = function() {
            openChat(chatId, chatData);
        };
        
        var chatsList = document.getElementById('chats-list');
        chatsList.appendChild(div);
    }
}

// ========================================
// ВКЛАДКИ
// ========================================

function switchTab(tab) {
    currentTab = tab;
    
    var tabs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    
    event.target.classList.add('active');
    loadChats();
}

// ========================================
// ОТКРЫТИЕ ЧАТА
// ========================================

function openChat(chatId, chatData) {
    currentChatId = chatId;
    currentChatUser = chatData;
    currentChatUser.chatId = chatId;
    
    closeSidebar();
    
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('active-chat').classList.remove('hidden');
    
    var name = '';
    var avatar = '';
    var status = '';
    
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatar = chatData.avatar || '';
        var membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
        status = membersCount + ' участник(ов)';
        
        hideCallButtons();
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
        
    } else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatar = chatData.avatar || '';
        var subsCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        status = subsCount + ' подписчик(ов)';
        
        hideCallButtons();
        
        var isAdmin = chatData.admins && chatData.admins[currentUser.uid];
        if (isAdmin) {
            document.getElementById('message-input-area').classList.remove('hidden');
            document.getElementById('channel-footer').classList.add('hidden');
        } else {
            document.getElementById('message-input-area').classList.add('hidden');
            document.getElementById('channel-footer').classList.remove('hidden');
        }
        
    } else {
        name = chatData.otherUser ? (chatData.otherUser.username || 'Пользователь') : 'Пользователь';
        avatar = chatData.otherUser ? (chatData.otherUser.avatar || '') : '';
        status = (chatData.otherUser && chatData.otherUser.status && chatData.otherUser.status.online) ? 'в сети' : 'был(а) недавно';
        
        showCallButtons();
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    }
    
    document.getElementById('chat-username').textContent = name;
    document.getElementById('chat-status').textContent = status;
    
    var chatAvatar = document.getElementById('chat-avatar');
    if (avatar && avatar.indexOf('http') === 0) {
        chatAvatar.style.backgroundImage = 'url(' + avatar + ')';
        chatAvatar.style.backgroundSize = 'cover';
        chatAvatar.textContent = '';
    } else {
        chatAvatar.style.backgroundImage = '';
        if (chatData.type === 'group') {
            chatAvatar.textContent = '👥';
        } else if (chatData.type === 'channel') {
            chatAvatar.textContent = '📢';
        } else {
            chatAvatar.textContent = '👤';
        }
    }
    
    // Снимаем выделение со всех чатов
    var chatItems = document.querySelectorAll('.chat-item');
    for (var i = 0; i < chatItems.length; i++) {
        chatItems[i].classList.remove('active');
    }
    
    loadMessages(chatId);
}

function hideCallButtons() {
    var callBtns = document.querySelectorAll('.call-btn');
    for (var i = 0; i < callBtns.length; i++) {
        callBtns[i].style.display = 'none';
    }
}

function showCallButtons() {
    var callBtns = document.querySelectorAll('.call-btn');
    for (var i = 0; i < callBtns.length; i++) {
        callBtns[i].style.display = '';
    }
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
    var container = document.getElementById('messages-container');
    container.innerHTML = '';
    
    if (messagesListener) {
        messagesListener.off();
    }
    
    messagesListener = database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(100);
    
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        message.id = snapshot.key;
        
        createMessageElement(message);
    });
}

function createMessageElement(message) {
    var container = document.getElementById('messages-container');
    var div = document.createElement('div');
    var isSent = message.senderId === currentUser.uid;
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    
    var content = '';
    
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\'' + message.imageUrl + '\')"><img src="' + message.imageUrl + '" alt="Image"></div>';
        if (message.caption) {
            content += '<div class="message-text">' + escapeHtml(message.caption) + '</div>';
        }
    } else {
        content = '<div class="message-text">' + escapeHtml(message.text || '') + '</div>';
    }
    
    // Для групп и каналов показываем имя отправителя
    var senderHtml = '';
    if (!isSent && (currentChatUser.type === 'group' || currentChatUser.type === 'channel')) {
        database.ref('users/' + message.senderId + '/username').once('value')
        .then(function(snap) {
            var senderEl = div.querySelector('.message-sender');
            if (senderEl) {
                senderEl.textContent = snap.val() || 'Пользователь';
            }
        });
        senderHtml = '<div class="message-sender">Загрузка...</div>';
    }
    
    div.innerHTML = '<div class="message-content">' +
        senderHtml +
        content +
        '<div class="message-time">' + formatTime(message.timestamp) + '</div>' +
    '</div>';
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    var input = document.getElementById('message-input');
    var text = input.value.trim();
    
    if (!text || !currentChatId) return;
    
    var message = {
        type: 'text',
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    input.value = '';
    
    database.ref('messages/' + currentChatId).push(message)
    .then(function() {
        var lastMsg = text.length > 50 ? text.substring(0, 50) + '...' : text;
        return database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    })
    .catch(function(error) {
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

function handleTyping() {
    // Индикатор набора
}

// ========================================
// НОВЫЙ ЛИЧНЫЙ ЧАТ
// ========================================

function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    document.getElementById('new-chat-search').value = '';
    loadAllUsers();
}

function closeNewChatDialog() {
    document.getElementById('new-chat-modal').classList.add('hidden');
}

function loadAllUsers() {
    var list = document.getElementById('users-list');
    list.innerHTML = '<div class="loading-users">Загрузка пользователей...</div>';
    
    database.ref('users').once('value')
    .then(function(snapshot) {
        var users = snapshot.val();
        
        if (!users) {
            list.innerHTML = '<div class="no-users">Пользователи не найдены</div>';
            return;
        }
        
        list.innerHTML = '';
        var count = 0;
        
        Object.keys(users).forEach(function(userId) {
            if (userId === currentUser.uid) return;
            
            var user = users[userId];
            count++;
            
            var div = document.createElement('div');
            div.className = 'user-item';
            div.setAttribute('data-userid', userId);
            div.setAttribute('data-username', (user.username || '').toLowerCase());
            div.setAttribute('data-email', (user.email || '').toLowerCase());
            
            var avatar = user.avatar || '';
            var avatarStyle = avatar ? 'background-image: url(' + avatar + '); background-size: cover;' : '';
            var avatarContent = avatar ? '' : '👤';
            
            div.innerHTML = 
                '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
                '<div class="user-item-info">' +
                    '<h4>' + escapeHtml(user.username || 'Пользователь') + '</h4>' +
                    '<p>' + escapeHtml(user.email || '') + '</p>' +
                '</div>';
            
            div.onclick = function() {
                startPrivateChat(userId, user);
            };
            
            list.appendChild(div);
        });
        
        if (count === 0) {
            list.innerHTML = '<div class="no-users">Других пользователей пока нет</div>';
        }
    })
    .catch(function(error) {
        console.error('Ошибка загрузки:', error);
        list.innerHTML = '<div class="no-users">Ошибка загрузки</div>';
    });
}

function searchUsers() {
    var text = document.getElementById('new-chat-search').value.toLowerCase().trim();
    var items = document.querySelectorAll('#users-list .user-item');
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var username = item.getAttribute('data-username') || '';
        var email = item.getAttribute('data-email') || '';
        
        if (username.indexOf(text) !== -1 || email.indexOf(text) !== -1) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    }
}

function startPrivateChat(otherUserId, otherUser) {
    var chatId = generateChatId(currentUser.uid, otherUserId);
    
    database.ref('chats/' + chatId).once('value')
    .then(function(snapshot) {
        if (!snapshot.exists()) {
            return database.ref('chats/' + chatId).set({
                type: 'private',
                participants: [currentUser.uid, otherUserId],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: '',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            })
            .then(function() {
                return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
            })
            .then(function() {
                return database.ref('userChats/' + otherUserId + '/' + chatId).set(true);
            });
        }
    })
    .then(function() {
        closeNewChatDialog();
        
        var chatData = {
            type: 'private',
            otherUserId: otherUserId,
            otherUser: otherUser,
            participants: [currentUser.uid, otherUserId]
        };
        
        openChat(chatId, chatData);
        showNotification('Чат создан!', 'success');
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка создания чата', 'error');
    });
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

function goToGroupStep2() {
    var name = document.getElementById('group-name').value.trim();
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

function loadGroupMembersList() {
    var list = document.getElementById('group-members-list');
    list.innerHTML = '<div class="loading-users">Загрузка...</div>';
    
    database.ref('users').once('value')
    .then(function(snapshot) {
        var users = snapshot.val();
        
        if (!users) {
            list.innerHTML = '<div class="no-users">Пользователи не найдены</div>';
            return;
        }
        
        list.innerHTML = '';
        
        Object.keys(users).forEach(function(userId) {
            if (userId === currentUser.uid) return;
            
            var user = users[userId];
            var isSelected = selectedGroupMembers.some(function(m) { return m.id === userId; });
            
            var div = document.createElement('div');
            div.className = 'user-item' + (isSelected ? ' selected' : '');
            div.setAttribute('data-username', (user.username || '').toLowerCase());
            
            var avatar = user.avatar || '';
            var avatarStyle = avatar ? 'background-image: url(' + avatar + '); background-size: cover;' : '';
            var avatarContent = avatar ? '' : '👤';
            
            div.innerHTML = 
                '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
                '<div class="user-item-info"><h4>' + escapeHtml(user.username || 'Пользователь') + '</h4></div>' +
                '<span class="check-mark">' + (isSelected ? '✓' : '') + '</span>';
            
            div.onclick = function() {
                toggleGroupMember(userId, user);
            };
            
            list.appendChild(div);
        });
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        list.innerHTML = '<div class="no-users">Ошибка загрузки</div>';
    });
}

function toggleGroupMember(userId, user) {
    var index = -1;
    for (var i = 0; i < selectedGroupMembers.length; i++) {
        if (selectedGroupMembers[i].id === userId) {
            index = i;
            break;
        }
    }
    
    if (index > -1) {
        selectedGroupMembers.splice(index, 1);
    } else {
        selectedGroupMembers.push({ id: userId, username: user.username, avatar: user.avatar });
    }
    
    renderSelectedMembers();
    loadGroupMembersList();
}

function renderSelectedMembers() {
    var container = document.getElementById('selected-members');
    
    if (selectedGroupMembers.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    var html = '';
    selectedGroupMembers.forEach(function(m) {
        html += '<div class="selected-member-chip">' +
            '<span>' + escapeHtml(m.username || 'Пользователь') + '</span>' +
            '<button type="button" onclick="removeSelectedMember(\'' + m.id + '\')">&times;</button>' +
        '</div>';
    });
    
    container.innerHTML = html;
}

function removeSelectedMember(userId) {
    selectedGroupMembers = selectedGroupMembers.filter(function(m) { return m.id !== userId; });
    renderSelectedMembers();
    loadGroupMembersList();
}

function searchGroupMembers() {
    var text = document.getElementById('group-members-search').value.toLowerCase().trim();
    var items = document.querySelectorAll('#group-members-list .user-item');
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var username = item.getAttribute('data-username') || '';
        item.style.display = username.indexOf(text) !== -1 ? 'flex' : 'none';
    }
}

function createGroup() {
    var name = document.getElementById('group-name').value.trim();
    var description = document.getElementById('group-description').value.trim();
    
    if (!name) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    var btn = document.querySelector('#group-step-2 .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Создание...';
    
    var avatarPromise;
    if (groupAvatarFile) {
        avatarPromise = uploadImageToImgBB(groupAvatarFile);
    } else {
        avatarPromise = Promise.resolve(null);
    }
    
    avatarPromise
    .then(function(imageData) {
        var avatarUrl = imageData ? imageData.url : '';
        var chatId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        var members = {};
        members[currentUser.uid] = true;
        selectedGroupMembers.forEach(function(m) {
            members[m.id] = true;
        });
        
        return database.ref('chats/' + chatId).set({
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
        })
        .then(function() {
            var promises = [database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true)];
            selectedGroupMembers.forEach(function(m) {
                promises.push(database.ref('userChats/' + m.id + '/' + chatId).set(true));
            });
            return Promise.all(promises);
        });
    })
    .then(function() {
        closeCreateGroupDialog();
        showNotification('Группа "' + name + '" создана!', 'success');
        loadChats();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка создания группы', 'error');
    })
    .finally(function() {
        btn.disabled = false;
        btn.textContent = 'Создать группу';
    });
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

function validateChannelLink() {
    var link = document.getElementById('channel-link').value.trim().toLowerCase();
    var hint = document.getElementById('channel-link-hint');
    
    if (!link) {
        hint.textContent = '';
        hint.className = 'link-hint';
        return true;
    }
    
    if (!/^[a-z0-9_]+$/.test(link)) {
        hint.textContent = 'Только латинские буквы, цифры и _';
        hint.className = 'link-hint error';
        return false;
    }
    
    if (link.length < 3) {
        hint.textContent = 'Минимум 3 символа';
        hint.className = 'link-hint error';
        return false;
    }
    
    hint.textContent = '✓ Ссылка: ' + link;
    hint.className = 'link-hint success';
    return true;
}

function createChannel() {
    var name = document.getElementById('channel-name').value.trim();
    var description = document.getElementById('channel-description').value.trim();
    var link = document.getElementById('channel-link').value.trim().toLowerCase();
    var typeRadio = document.querySelector('input[name="channel-type"]:checked');
    var isPublic = typeRadio ? typeRadio.value === 'public' : true;
    
    if (!name) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    if (link && !validateChannelLink()) {
        showNotification('Исправьте ссылку на канал', 'error');
        return;
    }
    
    var btn = document.querySelector('#create-channel-modal .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Создание...';
    
    var checkLinkPromise;
    if (link) {
        checkLinkPromise = database.ref('channelLinks/' + link).once('value')
        .then(function(snap) {
            if (snap.exists()) {
                throw new Error('Эта ссылка уже занята');
            }
        });
    } else {
        checkLinkPromise = Promise.resolve();
    }
    
    checkLinkPromise
    .then(function() {
        if (channelAvatarFile) {
            return uploadImageToImgBB(channelAvatarFile);
        }
        return null;
    })
    .then(function(imageData) {
        var avatarUrl = imageData ? imageData.url : '';
        var chatId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        return database.ref('chats/' + chatId).set({
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
        })
        .then(function() {
            return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        })
        .then(function() {
            if (link) {
                return database.ref('channelLinks/' + link).set(chatId);
            }
        });
    })
    .then(function() {
        closeCreateChannelDialog();
        showNotification('Канал "' + name + '" создан!', 'success');
        loadChats();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification(error.message || 'Ошибка создания канала', 'error');
    })
    .finally(function() {
        btn.disabled = false;
        btn.textContent = 'Создать канал';
    });
}

// ========================================
// ИНФОРМАЦИЯ О ЧАТЕ
// ========================================

function showChatInfo() {
    if (!currentChatUser) return;
    
    document.getElementById('chat-info-modal').classList.remove('hidden');
    
    var chat = currentChatUser;
    var name = '';
    var avatar = '';
    var status = '';
    var description = '';
    
    if (chat.type === 'group') {
        document.getElementById('info-title').textContent = 'Информация о группе';
        name = chat.name || 'Группа';
        avatar = chat.avatar || '';
        var membersCount = chat.members ? Object.keys(chat.members).length : 0;
        status = membersCount + ' участник(ов)';
        description = chat.description || '';
        
        document.getElementById('channel-stats').classList.add('hidden');
        document.getElementById('group-members-section').classList.remove('hidden');
        document.getElementById('members-count').textContent = membersCount;
        
        loadMembersList(chat.members, chat.admins);
        
        var isAdmin = chat.admins && chat.admins[currentUser.uid];
        document.getElementById('add-member-btn').style.display = isAdmin ? '' : 'none';
        document.getElementById('leave-btn').classList.remove('hidden');
        document.getElementById('subscribe-btn').classList.add('hidden');
        document.getElementById('unsubscribe-btn').classList.add('hidden');
        document.getElementById('delete-btn').style.display = isAdmin ? '' : 'none';
        
    } else if (chat.type === 'channel') {
        document.getElementById('info-title').textContent = 'Информация о канале';
        name = chat.name || 'Канал';
        avatar = chat.avatar || '';
        var subsCount = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
        status = chat.isPublic ? 'Публичный канал' : 'Приватный канал';
        description = chat.description || '';
        
        document.getElementById('channel-stats').classList.remove('hidden');
        document.getElementById('subscribers-count').textContent = subsCount;
        document.getElementById('group-members-section').classList.add('hidden');
        
        var isSubscribed = chat.subscribers && chat.subscribers[currentUser.uid];
        var isChannelAdmin = chat.admins && chat.admins[currentUser.uid];
        
        document.getElementById('leave-btn').classList.add('hidden');
        document.getElementById('subscribe-btn').style.display = isSubscribed ? 'none' : '';
        document.getElementById('unsubscribe-btn').style.display = (isSubscribed && !isChannelAdmin) ? '' : 'none';
        document.getElementById('delete-btn').style.display = isChannelAdmin ? '' : 'none';
        
    } else {
        document.getElementById('info-title').textContent = 'Информация';
        name = chat.otherUser ? (chat.otherUser.username || 'Пользователь') : 'Пользователь';
        avatar = chat.otherUser ? (chat.otherUser.avatar || '') : '';
        status = (chat.otherUser && chat.otherUser.status && chat.otherUser.status.online) ? 'в сети' : 'был(а) недавно';
        
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
    
    var infoAvatar = document.getElementById('info-avatar');
    if (avatar && avatar.indexOf('http') === 0) {
        infoAvatar.style.backgroundImage = 'url(' + avatar + ')';
        infoAvatar.style.backgroundSize = 'cover';
        infoAvatar.textContent = '';
    } else {
        infoAvatar.style.backgroundImage = '';
        if (chat.type === 'group') {
            infoAvatar.textContent = '👥';
        } else if (chat.type === 'channel') {
            infoAvatar.textContent = '📢';
        } else {
            infoAvatar.textContent = '👤';
        }
    }
}

function closeChatInfo() {
    document.getElementById('chat-info-modal').classList.add('hidden');
}

function loadMembersList(members, admins) {
    var list = document.getElementById('info-members-list');
    list.innerHTML = '';
    
    if (!members) return;
    
    Object.keys(members).forEach(function(memberId) {
        database.ref('users/' + memberId).once('value')
        .then(function(snap) {
            var user = snap.val();
            if (!user) return;
            
            var isAdmin = admins && admins[memberId];
            var avatar = user.avatar || '';
            var avatarStyle = avatar ? 'background-image: url(' + avatar + '); background-size: cover;' : '';
            var avatarContent = avatar ? '' : '👤';
            
            var div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = 
                '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
                '<span class="member-name">' + escapeHtml(user.username || 'Пользователь') + '</span>' +
                (isAdmin ? '<span class="member-role">админ</span>' : '');
            
            list.appendChild(div);
        });
    });
}

function subscribeToChannel() {
    if (!currentChatId) return;
    
    database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).set(true)
    .then(function() {
        return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).set(true);
    })
    .then(function() {
        showNotification('Вы подписались на канал', 'success');
        closeChatInfo();
        loadChats();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка подписки', 'error');
    });
}

function unsubscribeFromChannel() {
    if (!currentChatId) return;
    if (!confirm('Отписаться от канала?')) return;
    
    database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).remove()
    .then(function() {
        return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
    })
    .then(function() {
        showNotification('Вы отписались от канала', 'info');
        closeChatInfo();
        closeChat();
        loadChats();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка', 'error');
    });
}

function leaveChat() {
    if (!currentChatId) return;
    if (!confirm('Покинуть чат?')) return;
    
    var promise;
    if (currentChatUser.type === 'group') {
        promise = database.ref('chats/' + currentChatId + '/members/' + currentUser.uid).remove();
    } else {
        promise = Promise.resolve();
    }
    
    promise
    .then(function() {
        return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
    })
    .then(function() {
        showNotification('Вы покинули чат', 'info');
        closeChatInfo();
        closeChat();
        loadChats();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка', 'error');
    });
}

function deleteChat() {
    if (!currentChatId) return;
    if (!confirm('Удалить чат? Это действие нельзя отменить.')) return;
    
    database.ref('chats/' + currentChatId).remove()
    .then(function() {
        return database.ref('messages/' + currentChatId).remove();
    })
    .then(function() {
        return database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove();
    })
    .then(function() {
        showNotification('Чат удален', 'info');
        closeChatInfo();
        closeChat();
        loadChats();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка удаления', 'error');
    });
}

// ========================================
// ДОБАВЛЕНИЕ УЧАСТНИКОВ
// ========================================

function showAddMembersDialog() {
    document.getElementById('add-members-modal').classList.remove('hidden');
    document.getElementById('add-members-search').value = '';
    loadAddMembersList();
}

function closeAddMembersDialog() {
    document.getElementById('add-members-modal').classList.add('hidden');
}

function loadAddMembersList() {
    var list = document.getElementById('add-members-list');
    list.innerHTML = '<div class="loading-users">Загрузка...</div>';
    
    var currentMembers = currentChatUser.members || {};
    
    database.ref('users').once('value')
    .then(function(snapshot) {
        var users = snapshot.val();
        
        if (!users) {
            list.innerHTML = '<div class="no-users">Пользователи не найдены</div>';
            return;
        }
        
        list.innerHTML = '';
        var count = 0;
        
        Object.keys(users).forEach(function(userId) {
            if (currentMembers[userId]) return;
            
            var user = users[userId];
            count++;
            
            var div = document.createElement('div');
            div.className = 'user-item';
            div.setAttribute('data-username', (user.username || '').toLowerCase());
            
            var avatar = user.avatar || '';
            var avatarStyle = avatar ? 'background-image: url(' + avatar + '); background-size: cover;' : '';
            var avatarContent = avatar ? '' : '👤';
            
            div.innerHTML = 
                '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
                '<div class="user-item-info"><h4>' + escapeHtml(user.username || 'Пользователь') + '</h4></div>';
            
            div.onclick = function() {
                addMemberToGroup(userId);
            };
            
            list.appendChild(div);
        });
        
        if (count === 0) {
            list.innerHTML = '<div class="no-users">Нет пользователей для добавления</div>';
        }
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        list.innerHTML = '<div class="no-users">Ошибка загрузки</div>';
    });
}

function addMemberToGroup(userId) {
    if (!currentChatId) return;
    
    database.ref('chats/' + currentChatId + '/members/' + userId).set(true)
    .then(function() {
        return database.ref('userChats/' + userId + '/' + currentChatId).set(true);
    })
    .then(function() {
        showNotification('Участник добавлен', 'success');
        closeAddMembersDialog();
        
        return database.ref('chats/' + currentChatId).once('value');
    })
    .then(function(snap) {
        currentChatUser = snap.val();
        currentChatUser.chatId = currentChatId;
        showChatInfo();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка добавления', 'error');
    });
}

function searchAddMembers() {
    var text = document.getElementById('add-members-search').value.toLowerCase().trim();
    var items = document.querySelectorAll('#add-members-list .user-item');
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var username = item.getAttribute('data-username') || '';
        item.style.display = username.indexOf(text) !== -1 ? 'flex' : 'none';
    }
}

// ========================================
// ЭМОДЗИ
// ========================================

function toggleEmojiPicker() {
    document.getElementById('emoji-picker').classList.toggle('hidden');
}

function insertEmoji(emoji) {
    var input = document.getElementById('message-input');
    input.value += emoji;
    input.focus();
}

// ========================================
// ПРОСМОТР ИЗОБРАЖЕНИЙ
// ========================================

function openLightbox(url) {
    document.getElementById('lightbox-image').src = url;
    document.getElementById('image-lightbox').classList.remove('hidden');
}

function closeLightbox() {
    document.getElementById('image-lightbox').classList.add('hidden');
}

// ========================================
// ЗАКРЫТИЕ ПО КЛИКУ ВНЕ И ESCAPE
// ========================================

document.addEventListener('click', function(e) {
    var picker = document.getElementById('emoji-picker');
    var emojiBtn = document.querySelector('.btn-icon[title="Эмодзи"]');
    
    if (picker && !picker.classList.contains('hidden')) {
        if (!picker.contains(e.target) && e.target !== emojiBtn) {
            picker.classList.add('hidden');
        }
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeLightbox();
        closeImagePreview();
        closeNewChatDialog();
        closeCreateGroupDialog();
        closeCreateChannelDialog();
        closeChatInfo();
        closeAddMembersDialog();
        document.getElementById('emoji-picker').classList.add('hidden');
    }
});
