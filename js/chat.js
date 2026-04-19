// KUKUMBER MESSENGER - CHAT (полная версия)
var selectedGroupMembers = [];
var groupAvatarFile = null;
var channelAvatarFile = null;
var typingTimeout = null;

// ========== ГЛОБАЛЬНЫЙ ПОИСК И КОНТАКТЫ ==========
function showGlobalSearch() {
    document.getElementById('global-search-modal').classList.remove('hidden');
    var container = document.getElementById('global-users-list');
    container.innerHTML = '<div>Загрузка...</div>';
    database.ref('users').once('value').then(function(snapshot) {
        var users = snapshot.val();
        container.innerHTML = '';
        for (var uid in users) {
            if (uid === currentUser.uid) continue;
            var user = users[uid];
            var div = document.createElement('div');
            div.className = 'user-item';
            var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
            var avatarContent = user.avatar ? '' : '👤';
            div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><div class="user-item-info"><h4>'+escapeHtml(user.username)+'</h4></div><button onclick="addToContacts(\''+uid+'\',\''+escapeHtml(user.username)+'\')">➕ Добавить</button>';
            container.appendChild(div);
        }
    });
}
function closeGlobalSearch() { document.getElementById('global-search-modal').classList.add('hidden'); }
function addToContacts(uid, name) {
    database.ref('contacts/' + currentUser.uid + '/' + uid).set(true);
    database.ref('contactsReverse/' + uid + '/' + currentUser.uid).set(true);
    showNotification(name + ' добавлен в контакты', 'success');
    closeGlobalSearch();
}

function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    document.getElementById('new-chat-search').value = '';
    loadContacts();
}
function closeNewChatDialog() { document.getElementById('new-chat-modal').classList.add('hidden'); }
function loadContacts() {
    var list = document.getElementById('users-list');
    list.innerHTML = '<div>Загрузка контактов...</div>';
    database.ref('contacts/' + currentUser.uid).once('value').then(function(snapshot) {
        var contacts = snapshot.val();
        if (!contacts) { list.innerHTML = '<div>Нет контактов. Добавьте через 🔍 в боковом меню</div>'; return; }
        var userIds = Object.keys(contacts);
        if (userIds.length === 0) { list.innerHTML = '<div>Нет контактов</div>'; return; }
        list.innerHTML = '';
        userIds.forEach(function(uid) {
            database.ref('users/' + uid).once('value').then(function(userSnap) {
                var user = userSnap.val();
                if (!user) return;
                var div = document.createElement('div');
                div.className = 'user-item';
                div.setAttribute('data-username', (user.username || '').toLowerCase());
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                div.innerHTML = '<div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><div class="user-item-info"><h4>'+escapeHtml(user.username)+'</h4></div>';
                div.onclick = (function(uid, user) { return function() { startPrivateChat(uid, user); }; })(uid, user);
                list.appendChild(div);
            });
        });
    });
}
function searchContacts() {
    var text = document.getElementById('new-chat-search').value.toLowerCase();
    var items = document.querySelectorAll('#users-list .user-item');
    items.forEach(function(item) {
        var name = item.getAttribute('data-username') || '';
        item.style.display = name.indexOf(text) !== -1 ? 'flex' : 'none';
    });
}
function startPrivateChat(otherUserId, otherUser) {
    var chatId = generateChatId(currentUser.uid, otherUserId);
    database.ref('chats/' + chatId).once('value').then(function(snapshot) {
        if (!snapshot.exists()) {
            return database.ref('chats/' + chatId).set({
                type: 'private',
                participants: [currentUser.uid, otherUserId],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: '',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            }).then(function() {
                return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
            }).then(function() {
                return database.ref('userChats/' + otherUserId + '/' + chatId).set(true);
            });
        }
    }).then(function() {
        closeNewChatDialog();
        var chatData = { type: 'private', otherUserId: otherUserId, otherUser: otherUser, participants: [currentUser.uid, otherUserId] };
        openChat(chatId, chatData);
        showNotification('Чат создан!', 'success');
    }).catch(function(err) { console.error(err); showNotification('Ошибка', 'error'); });
}

function searchChats() {
    var text = document.getElementById('search-chats').value.toLowerCase().trim();
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(function(item) {
        var nameEl = item.querySelector('.chat-item-name');
        if (nameEl) {
            var name = nameEl.textContent.toLowerCase();
            item.style.display = name.indexOf(text) !== -1 ? 'flex' : 'none';
        }
    });
    if (text.length >= 3) searchPublicChannels(text);
}
function searchPublicChannels(searchText) {
    database.ref('chats').once('value').then(function(snapshot) {
        var chats = snapshot.val();
        if (!chats) return;
        var chatsList = document.getElementById('chats-list');
        for (var chatId in chats) {
            var chat = chats[chatId];
            if (chat.type !== 'channel' || !chat.isPublic) continue;
            if (chat.subscribers && chat.subscribers[currentUser.uid]) continue;
            var name = (chat.name || '').toLowerCase();
            if (name.indexOf(searchText) === -1) continue;
            if (document.querySelector('[data-search-channel="'+chatId+'"]')) continue;
            var div = document.createElement('div');
            div.className = 'chat-item search-result';
            div.setAttribute('data-search-channel', chatId);
            var avatar = chat.avatar || '';
            var avatarStyle = avatar ? 'background-image:url('+avatar+');background-size:cover;' : '';
            var avatarContent = avatar ? '' : '📢';
            var subsCount = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
            div.innerHTML = '<div class="chat-item-avatar"><div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div><span class="chat-type-badge">📢</span></div><div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">'+escapeHtml(chat.name)+'</span><span class="chat-item-time">'+subsCount+' подп.</span></div><div class="chat-item-preview">Нажмите чтобы подписаться</div></div>';
            div.onclick = (function(chatId, chat) { return function() { subscribeToPublicChannel(chatId, chat); }; })(chatId, chat);
            chatsList.insertBefore(div, chatsList.firstChild);
        }
    });
}
function subscribeToPublicChannel(chatId, channel) {
    database.ref('chats/'+chatId+'/subscribers/'+currentUser.uid).set(true).then(function() {
        return database.ref('userChats/'+currentUser.uid+'/'+chatId).set(true);
    }).then(function() {
        showNotification('Подписались на "'+channel.name+'"', 'success');
        var el = document.querySelector('[data-search-channel="'+chatId+'"]');
        if (el) el.remove();
        loadChats();
    }).catch(function(err) { showNotification('Ошибка', 'error'); });
}

function loadChats() {
    if (!currentUser) return;
    database.ref('userChats/'+currentUser.uid).on('value', function(snapshot) {
        var chatsData = snapshot.val();
        var chatsList = document.getElementById('chats-list');
        if (!chatsData) { chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>'; return; }
        var chatIds = Object.keys(chatsData);
        var loadedChats = [], count = 0;
        chatIds.forEach(function(chatId) {
            database.ref('chats/'+chatId).once('value').then(function(chatSnap) {
                var chatData = chatSnap.val();
                if (chatData) loadedChats.push({ chatId: chatId, data: chatData });
                count++;
                if (count === chatIds.length) renderChats(loadedChats);
            });
        });
    });
}
function renderChats(chats) {
    var chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '';
    chats.sort(function(a,b) { return (b.data.lastMessageTime||0) - (a.data.lastMessageTime||0); });
    var filtered = chats.filter(function(chat) {
        if (currentTab === 'all') return true;
        if (currentTab === 'private') return chat.data.type === 'private' || !chat.data.type;
        if (currentTab === 'groups') return chat.data.type === 'group';
        if (currentTab === 'channels') return chat.data.type === 'channel';
        return true;
    });
    if (filtered.length === 0) { chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>'; return; }
    filtered.forEach(function(chat) { createChatItem(chat.chatId, chat.data); });
}
function createChatItem(chatId, chatData) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    if (currentChatId === chatId) div.classList.add('active');
    var name = '', avatar = '', badge = '', isOnline = false;
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatar = chatData.avatar || '';
        badge = '<span class="chat-type-badge">👥</span>';
        finish();
    } else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatar = chatData.avatar || '';
        badge = '<span class="chat-type-badge">📢</span>';
        finish();
    } else {
        var otherUserId = null;
        if (chatData.participants) {
            for (var i = 0; i < chatData.participants.length; i++) {
                if (chatData.participants[i] !== currentUser.uid) { otherUserId = chatData.participants[i]; break; }
            }
        }
        if (otherUserId) {
            database.ref('users/'+otherUserId).once('value').then(function(userSnap) {
                var userData = userSnap.val();
                name = userData ? userData.username : 'Пользователь';
                avatar = userData ? userData.avatar : '';
                isOnline = userData && userData.status && userData.status.online;
                chatData.otherUserId = otherUserId;
                chatData.otherUser = userData;
                finish();
            });
        } else { name = 'Пользователь'; finish(); }
    }
    function finish() {
        var avatarStyle = '', avatarContent = '';
        if (avatar && avatar.indexOf('http') === 0) { avatarStyle = 'background-image:url('+avatar+');background-size:cover;'; avatarContent = ''; }
        else { avatarContent = chatData.type === 'group' ? '👥' : (chatData.type === 'channel' ? '📢' : '👤'); }
        var time = chatData.lastMessageTime ? formatTime(chatData.lastMessageTime) : '';
        var preview = chatData.lastMessage || 'Нет сообщений';
        div.innerHTML = '<div class="chat-item-avatar"><div class="avatar" style="'+avatarStyle+'">'+avatarContent+'</div>'+(isOnline?'<div class="online-indicator"></div>':'')+badge+'</div><div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">'+escapeHtml(name)+'</span><span class="chat-item-time">'+time+'</span></div><div class="chat-item-preview">'+escapeHtml(preview)+'</div></div>';
        div.onclick = function() { openChat(chatId, chatData); };
        document.getElementById('chats-list').appendChild(div);
    }
}
function switchTab(tab) {
    currentTab = tab;
    var btns = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    event.target.classList.add('active');
    loadChats();
}

function openChat(chatId, chatData) {
    currentChatId = chatId;
    currentChatUser = chatData;
    currentChatUser.chatId = chatId;
    closeSidebar();
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('active-chat').classList.remove('hidden');
    var name = '', avatar = '', status = '';
    if (chatData.type === 'group') {
        name = chatData.name || 'Группа';
        avatar = chatData.avatar || '';
        status = (chatData.members ? Object.keys(chatData.members).length : 0) + ' участников';
        hideCallButtons();
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    } else if (chatData.type === 'channel') {
        name = chatData.name || 'Канал';
        avatar = chatData.avatar || '';
        status = (chatData.subscribers ? Object.keys(chatData.subscribers).length : 0) + ' подписчиков';
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
        name = chatData.otherUser ? chatData.otherUser.username : 'Пользователь';
        avatar = chatData.otherUser ? chatData.otherUser.avatar : '';
        var lastSeen = chatData.otherUser?.status?.lastSeen;
        var online = chatData.otherUser?.status?.online;
        if (online) status = 'в сети';
        else status = formatLastSeen(lastSeen);
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
        chatAvatar.textContent = chatData.type === 'group' ? '👥' : (chatData.type === 'channel' ? '📢' : '👤');
    }
    var longPressTimer;
    var avatarEl = document.getElementById('chat-avatar');
    avatarEl.addEventListener('touchstart', function() {
        longPressTimer = setTimeout(function() {
            if (isSuperAdmin && chatData.type === 'private' && chatData.otherUserId) {
                showAdminEditUser(chatData.otherUserId);
            }
        }, 500);
    });
    avatarEl.addEventListener('touchend', function() { clearTimeout(longPressTimer); });
    avatarEl.addEventListener('mousedown', function() {
        longPressTimer = setTimeout(function() {
            if (isSuperAdmin && chatData.type === 'private' && chatData.otherUserId) {
                showAdminEditUser(chatData.otherUserId);
            }
        }, 500);
    });
    avatarEl.addEventListener('mouseup', function() { clearTimeout(longPressTimer); });
    document.querySelectorAll('.chat-item').forEach(function(i) { i.classList.remove('active'); });
    loadMessages(chatId);
    setupTypingListener(chatId);
}
function showAdminEditUser(userId) {
    var pwd = prompt('Введите пароль администратора:');
    if (pwd !== '777777+-') { showNotification('Неверный пароль', 'error'); return; }
    var newName = prompt('Новое имя пользователя:');
    if (newName && newName.trim()) {
        database.ref('users/'+userId+'/username').set(newName.trim());
        showNotification('Имя изменено', 'success');
    }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            uploadImageToImgBB(file).then(function(data) {
                database.ref('users/'+userId+'/avatar').set(data.url);
                showNotification('Аватар изменён', 'success');
            });
        }
    };
    input.click();
}
function hideCallButtons() {
    var btns = document.querySelectorAll('.call-btn');
    btns.forEach(function(btn) { if (btn) btn.style.display = 'none'; });
}
function showCallButtons() {
    var btns = document.querySelectorAll('.call-btn');
    btns.forEach(function(btn) { if (btn) btn.style.display = 'inline-flex'; });
}
function closeChat() {
    document.getElementById('active-chat').classList.add('hidden');
    document.getElementById('no-chat-selected').classList.remove('hidden');
    currentChatId = null;
    currentChatUser = null;
    if (messagesListener) messagesListener.off();
}

// ========== СООБЩЕНИЯ ==========
function loadMessages(chatId) {
    var container = document.getElementById('messages-container');
    container.innerHTML = '';
    if (messagesListener) messagesListener.off();
    messagesListener = database.ref('messages/'+chatId).orderByChild('timestamp').limitToLast(100);
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        message.id = snapshot.key;
        createMessageElement(message);
    });
    database.ref('messages/'+chatId).on('child_changed', function(snapshot) {
        var message = snapshot.val();
        message.id = snapshot.key;
        updateMessageElement(message);
    });
    database.ref('messages/'+chatId).on('child_removed', function(snapshot) {
        var removedId = snapshot.key;
        var msgElement = document.querySelector('.message[data-message-id="'+removedId+'"]');
        if (msgElement) msgElement.remove();
    });
}

function createMessageElement(message) {
    var container = document.getElementById('messages-container');
    var div = document.createElement('div');
    var isSent = message.senderId === currentUser.uid;
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.setAttribute('data-message-id', message.id);
    div.setAttribute('data-sender-id', message.senderId);
    
    var content = '';
    if (message.type === 'image') {
        content = '<div class="message-image" onclick="openLightbox(\''+message.imageUrl+'\')"><img src="'+message.imageUrl+'" alt="Image"></div>';
        if (message.caption) content += '<div class="message-text">'+escapeHtml(message.caption)+'</div>';
    } else if (message.type === 'audio') {
        content = '<div class="audio-message"><button onclick="playAudio(\''+message.audioUrl+'\')">▶️</button><span>Голосовое сообщение</span></div>';
    } else if (message.type === 'video_circle') {
        content = '<div class="video-message"><video src="'+message.videoUrl+'" controls></video></div>';
    } else if (message.type === 'video') {
        content = '<div class="video-message"><video src="'+message.videoUrl+'" controls style="max-width:250px; max-height:300px;"></video><div class="message-text">'+escapeHtml(message.text || '')+'</div></div>';
    } else if (message.type === 'file') {
        var fileIcon = '📎';
        if (message.fileType && message.fileType.startsWith('video/')) fileIcon = '🎬';
        else if (message.fileType && message.fileType.startsWith('audio/')) fileIcon = '🎵';
        else if (message.fileType && message.fileType.startsWith('image/')) fileIcon = '🖼️';
        content = '<div class="file-message"><span style="font-size:24px;">'+fileIcon+'</span><a href="'+message.fileUrl+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(message.fileName)+'</a></div>';
    } else {
        var textContent = escapeHtml(message.text || '');
        if (message.edited) textContent += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        content = '<div class="message-text">'+textContent+'</div>';
    }
    
    // Реакции
    var reactionsHtml = '';
    if (message.reactions) {
        var reactionCounts = {};
        for (var uid in message.reactions) {
            var r = message.reactions[uid];
            reactionCounts[r] = (reactionCounts[r] || 0) + 1;
        }
        for (var r in reactionCounts) {
            reactionsHtml += '<span class="reaction-badge" onclick="addReaction(\''+message.id+'\', \''+r+'\')">'+r+' '+reactionCounts[r]+'</span>';
        }
    }
    
    var senderHtml = '';
    if (!isSent && (currentChatUser.type === 'group' || currentChatUser.type === 'channel')) {
        database.ref('users/'+message.senderId+'/username').once('value').then(function(snap) {
            var senderEl = div.querySelector('.message-sender');
            if (senderEl) senderEl.textContent = snap.val() || 'Пользователь';
        });
        senderHtml = '<div class="message-sender">Загрузка...</div>';
    }
    
    div.innerHTML = '<div class="message-content">'+senderHtml+content+'<div class="message-time">'+formatTime(message.timestamp)+'</div><div class="message-reactions">'+reactionsHtml+'</div></div>';
    
    // Контекстное меню
    div.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showMessageContextMenu(e, message.id, message.senderId, message.text, message.type, message.imageUrl);
    });
    
    // Долгое нажатие
    var touchTimer;
    div.addEventListener('touchstart', function(e) {
        var touch = e.touches
