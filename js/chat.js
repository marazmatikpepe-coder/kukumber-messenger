// KUKUMBER MESSENGER - CHAT (с синхронизацией удаления у всех пользователей)
var currentTab = 'all';
var selectedGroupMembers = [];
var groupAvatarFile = null;
var channelAvatarFile = null;
var typingTimeout = null;
var messagesListeners = {}; // для отслеживания слушателей

// ========== ГЛОБАЛЬНЫЙ ПОИСК И КОНТАКТЫ ==========
function showGlobalSearch() {
    document.getElementById('global-search-modal').classList.remove('hidden');
    loadGlobalUsers();
}
function closeGlobalSearch() { document.getElementById('global-search-modal').classList.add('hidden'); }
function loadGlobalUsers() {
    var container = document.getElementById('global-users-list');
    container.innerHTML = '<div>Загрузка...</div>';
    database.ref('users').once('value').then(snapshot => {
        var users = snapshot.val();
        container.innerHTML = '';
        for (let uid in users) {
            if (uid === currentUser.uid) continue;
            let user = users[uid];
            let div = document.createElement('div');
            div.className = 'user-item';
            let avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
            let avatarContent = user.avatar ? '' : '👤';
            div.innerHTML = `<div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                            <div class="user-item-info"><h4>${escapeHtml(user.username)}</h4></div>
                            <button onclick="addToContacts('${uid}','${escapeHtml(user.username)}')">➕ Добавить</button>`;
            container.appendChild(div);
        }
    });
}
function searchGlobalUsers() {
    var text = document.getElementById('global-search-input').value.toLowerCase();
    var items = document.querySelectorAll('#global-users-list .user-item');
    items.forEach(item => {
        var name = item.querySelector('h4').innerText.toLowerCase();
        item.style.display = name.includes(text) ? 'flex' : 'none';
    });
}
function addToContacts(uid, name) {
    database.ref('contacts/' + currentUser.uid + '/' + uid).set(true);
    database.ref('contactsReverse/' + uid + '/' + currentUser.uid).set(true);
    showNotification(`${name} добавлен в контакты`, 'success');
    closeGlobalSearch();
}

// ========== НОВЫЙ ЧАТ (ТОЛЬКО КОНТАКТЫ) ==========
function showNewChatDialog() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    document.getElementById('new-chat-search').value = '';
    loadContacts();
}
function closeNewChatDialog() { document.getElementById('new-chat-modal').classList.add('hidden'); }
function loadContacts() {
    var list = document.getElementById('users-list');
    list.innerHTML = '<div>Загрузка контактов...</div>';
    database.ref('contacts/' + currentUser.uid).once('value').then(snapshot => {
        var contacts = snapshot.val();
        if (!contacts) { list.innerHTML = '<div>Нет контактов. Добавьте через 🔍 в боковом меню</div>'; return; }
        var userIds = Object.keys(contacts);
        if (userIds.length === 0) { list.innerHTML = '<div>Нет контактов</div>'; return; }
        list.innerHTML = '';
        userIds.forEach(uid => {
            database.ref('users/' + uid).once('value').then(userSnap => {
                var user = userSnap.val();
                if (!user) return;
                var div = document.createElement('div');
                div.className = 'user-item';
                div.setAttribute('data-username', (user.username || '').toLowerCase());
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                div.innerHTML = `<div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                                <div class="user-item-info"><h4>${escapeHtml(user.username)}</h4></div>`;
                div.onclick = () => startPrivateChat(uid, user);
                list.appendChild(div);
            });
        });
    });
}
function searchContacts() {
    var text = document.getElementById('new-chat-search').value.toLowerCase();
    var items = document.querySelectorAll('#users-list .user-item');
    items.forEach(item => {
        var name = item.getAttribute('data-username') || '';
        item.style.display = name.includes(text) ? 'flex' : 'none';
    });
}
function startPrivateChat(otherUserId, otherUser) {
    var chatId = generateChatId(currentUser.uid, otherUserId);
    database.ref('chats/' + chatId).once('value').then(snapshot => {
        if (!snapshot.exists()) {
            return database.ref('chats/' + chatId).set({
                type: 'private',
                participants: [currentUser.uid, otherUserId],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: '',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
            }).then(() => {
                return database.ref('userChats/' + otherUserId + '/' + chatId).set(true);
            });
        }
    }).then(() => {
        closeNewChatDialog();
        var chatData = { type: 'private', otherUserId: otherUserId, otherUser: otherUser, participants: [currentUser.uid, otherUserId] };
        openChat(chatId, chatData);
        showNotification('Чат создан!', 'success');
    }).catch(err => { console.error(err); showNotification('Ошибка', 'error'); });
}

// ========== ПОИСК ЧАТОВ И ПУБЛИЧНЫХ КАНАЛОВ ==========
function searchChats() {
    var text = document.getElementById('search-chats').value.toLowerCase().trim();
    var chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        var nameEl = item.querySelector('.chat-item-name');
        if (nameEl) {
            var name = nameEl.textContent.toLowerCase();
            item.style.display = name.includes(text) ? 'flex' : 'none';
        }
    });
    if (text.length >= 3) searchPublicChannels(text);
}
function searchPublicChannels(searchText) {
    database.ref('chats').once('value').then(snapshot => {
        var chats = snapshot.val();
        if (!chats) return;
        var chatsList = document.getElementById('chats-list');
        Object.keys(chats).forEach(chatId => {
            var chat = chats[chatId];
            if (chat.type !== 'channel' || !chat.isPublic) return;
            if (chat.subscribers && chat.subscribers[currentUser.uid]) return;
            var name = (chat.name || '').toLowerCase();
            if (!name.includes(searchText)) return;
            if (document.querySelector('[data-search-channel="'+chatId+'"]')) return;
            var div = document.createElement('div');
            div.className = 'chat-item search-result';
            div.setAttribute('data-search-channel', chatId);
            var avatar = chat.avatar || '';
            var avatarStyle = avatar ? 'background-image:url('+avatar+');background-size:cover;' : '';
            var avatarContent = avatar ? '' : '📢';
            var subsCount = chat.subscribers ? Object.keys(chat.subscribers).length : 0;
            div.innerHTML = `<div class="chat-item-avatar"><div class="avatar" style="${avatarStyle}">${avatarContent}</div><span class="chat-type-badge">📢</span></div>
                            <div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">${escapeHtml(chat.name)}</span><span>${subsCount} подп.</span></div>
                            <div class="chat-item-preview">Нажмите чтобы подписаться</div></div>`;
            div.onclick = () => subscribeToPublicChannel(chatId, chat);
            chatsList.insertBefore(div, chatsList.firstChild);
        });
    });
}
function subscribeToPublicChannel(chatId, channel) {
    database.ref('chats/'+chatId+'/subscribers/'+currentUser.uid).set(true).then(()=>{
        return database.ref('userChats/'+currentUser.uid+'/'+chatId).set(true);
    }).then(()=>{
        showNotification('Подписались на "'+channel.name+'"', 'success');
        var el = document.querySelector('[data-search-channel="'+chatId+'"]');
        if(el) el.remove();
        loadChats();
    }).catch(err=>showNotification('Ошибка', 'error'));
}

// ========== ЗАГРУЗКА СПИСКА ЧАТОВ ==========
function loadChats() {
    if (!currentUser) return;
    database.ref('userChats/'+currentUser.uid).on('value', snapshot=>{
        var chatsData = snapshot.val();
        var chatsList = document.getElementById('chats-list');
        if(!chatsData) { chatsList.innerHTML = '<div class="empty-chats">Нет чатов</div>'; return; }
        var chatIds = Object.keys(chatsData);
        var loadedChats = [], count=0;
        chatIds.forEach(chatId=>{
            database.ref('chats/'+chatId).once('value').then(chatSnap=>{
                var chatData = chatSnap.val();
                if(chatData) loadedChats.push({chatId, data:chatData});
                count++;
                if(count===chatIds.length) renderChats(loadedChats);
            });
        });
    });
}
function renderChats(chats) {
    var chatsList = document.getElementById('chats-list');
    chatsList.innerHTML = '';
    chats.sort((a,b)=> (b.data.lastMessageTime||0)-(a.data.lastMessageTime||0));
    var filtered = chats.filter(chat=>{
        if(currentTab==='all') return true;
        if(currentTab==='private') return chat.data.type==='private' || !chat.data.type;
        if(currentTab==='groups') return chat.data.type==='group';
        if(currentTab==='channels') return chat.data.type==='channel';
        return true;
    });
    if(filtered.length===0){ chatsList.innerHTML='<div class="empty-chats">Нет чатов</div>'; return; }
    filtered.forEach(chat=>createChatItem(chat.chatId, chat.data));
}
function createChatItem(chatId, chatData) {
    var div = document.createElement('div');
    div.className = 'chat-item';
    if(currentChatId===chatId) div.classList.add('active');
    var name='', avatar='', badge='', isOnline=false;
    if(chatData.type==='group'){
        name=chatData.name||'Группа';
        avatar=chatData.avatar||'';
        badge='<span class="chat-type-badge">👥</span>';
        finish();
    } else if(chatData.type==='channel'){
        name=chatData.name||'Канал';
        avatar=chatData.avatar||'';
        badge='<span class="chat-type-badge">📢</span>';
        finish();
    } else {
        var otherUserId=null;
        if(chatData.participants){
            for(var i=0;i<chatData.participants.length;i++) if(chatData.participants[i]!==currentUser.uid){ otherUserId=chatData.participants[i]; break; }
        }
        if(otherUserId){
            database.ref('users/'+otherUserId).once('value').then(userSnap=>{
                var userData=userSnap.val();
                name=userData?userData.username:'Пользователь';
                avatar=userData?userData.avatar:'';
                isOnline=userData && userData.status && userData.status.online;
                chatData.otherUserId=otherUserId;
                chatData.otherUser=userData;
                finish();
            });
        } else { name='Пользователь'; finish(); }
    }
    function finish(){
        var avatarStyle='', avatarContent='';
        if(avatar && avatar.indexOf('http')===0){ avatarStyle='background-image:url('+avatar+');background-size:cover;'; avatarContent='';}
        else { avatarContent=chatData.type==='group'?'👥':(chatData.type==='channel'?'📢':'👤'); }
        var time=chatData.lastMessageTime?formatTime(chatData.lastMessageTime):'';
        var preview=chatData.lastMessage||'Нет сообщений';
        div.innerHTML=`<div class="chat-item-avatar"><div class="avatar" style="${avatarStyle}">${avatarContent}</div>${isOnline?'<div class="online-indicator"></div>':''}${badge}</div>
                      <div class="chat-item-info"><div class="chat-item-header"><span class="chat-item-name">${escapeHtml(name)}</span><span>${time}</span></div>
                      <div class="chat-item-preview">${escapeHtml(preview)}</div></div>`;
        div.onclick=()=>openChat(chatId, chatData);
        document.getElementById('chats-list').appendChild(div);
    }
}
function switchTab(tab) {
    currentTab=tab;
    document.querySelectorAll('.tab-btn').forEach(btn=>btn.classList.remove('active'));
    event.target.classList.add('active');
    loadChats();
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(chatId, chatData){
    currentChatId=chatId;
    currentChatUser=chatData;
    currentChatUser.chatId=chatId;
    closeSidebar();
    document.getElementById('no-chat-selected').classList.add('hidden');
    document.getElementById('active-chat').classList.remove('hidden');
    var name='', avatar='', status='';
    if(chatData.type==='group'){
        name=chatData.name||'Группа';
        avatar=chatData.avatar||'';
        status=(chatData.members?Object.keys(chatData.members).length:0)+' участников';
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    } else if(chatData.type==='channel'){
        name=chatData.name||'Канал';
        avatar=chatData.avatar||'';
        status=(chatData.subscribers?Object.keys(chatData.subscribers).length:0)+' подписчиков';
        var isAdmin=chatData.admins && chatData.admins[currentUser.uid];
        if(isAdmin){
            document.getElementById('message-input-area').classList.remove('hidden');
            document.getElementById('channel-footer').classList.add('hidden');
        } else {
            document.getElementById('message-input-area').classList.add('hidden');
            document.getElementById('channel-footer').classList.remove('hidden');
        }
    } else {
        name=chatData.otherUser?chatData.otherUser.username:'Пользователь';
        avatar=chatData.otherUser?chatData.otherUser.avatar:'';
        var lastSeen=chatData.otherUser?.status?.lastSeen;
        var online=chatData.otherUser?.status?.online;
        if(online) status='в сети';
        else status=formatLastSeen(lastSeen);
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    }
    document.getElementById('chat-username').textContent=name;
    document.getElementById('chat-status').textContent=status;
    var chatAvatar=document.getElementById('chat-avatar');
    if(avatar && avatar.indexOf('http')===0){
        chatAvatar.style.backgroundImage='url('+avatar+')';
        chatAvatar.style.backgroundSize='cover';
        chatAvatar.textContent='';
    } else {
        chatAvatar.style.backgroundImage='';
        chatAvatar.textContent=chatData.type==='group'?'👥':(chatData.type==='channel'?'📢':'👤');
    }
    // Долгое нажатие для супер-админа
    var longPressTimer;
    var avatarEl = document.getElementById('chat-avatar');
    avatarEl.addEventListener('touchstart', ()=>{
        longPressTimer = setTimeout(()=>{
            if(isSuperAdmin && chatData.type==='private' && chatData.otherUserId){
                showAdminEditUser(chatData.otherUserId);
            }
        }, 500);
    });
    avatarEl.addEventListener('touchend',()=>clearTimeout(longPressTimer));
    avatarEl.addEventListener('mousedown',()=>{
        longPressTimer = setTimeout(()=>{
            if(isSuperAdmin && chatData.type==='private' && chatData.otherUserId){
                showAdminEditUser(chatData.otherUserId);
            }
        }, 500);
    });
    avatarEl.addEventListener('mouseup',()=>clearTimeout(longPressTimer));
    document.querySelectorAll('.chat-item').forEach(i=>i.classList.remove('active'));
    loadMessages(chatId);
    setupTypingListener(chatId);
}
function showAdminEditUser(userId){
    var pwd=prompt('Введите пароль администратора:');
    if(pwd!=='777777+-'){ showNotification('Неверный пароль','error'); return; }
    var newName=prompt('Новое имя пользователя:');
    if(newName && newName.trim()){
        database.ref('users/'+userId+'/username').set(newName.trim());
        showNotification('Имя изменено','success');
    }
    var input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.onchange=function(e){
        var file=e.target.files[0];
        if(file){
            uploadImageToImgBB(file).then(data=>{
                database.ref('users/'+userId+'/avatar').set(data.url);
                showNotification('Аватар изменён','success');
            });
        }
    };
    input.click();
}
function closeChat(){
    document.getElementById('active-chat').classList.add('hidden');
    document.getElementById('no-chat-selected').classList.remove('hidden');
    currentChatId=null; currentChatUser=null;
    if(messagesListener) messagesListener.off();
    messagesListener = null;
}

// ========== СООБЩЕНИЯ С РЕАЛЬНЫМ УДАЛЕНИЕМ ==========
function loadMessages(chatId){
    var container = document.getElementById('messages-container');
    container.innerHTML = '';
    if(messagesListener) messagesListener.off();
    
    // Слушаем добавление новых сообщений
    messagesListener = database.ref('messages/' + chatId).orderByChild('timestamp').limitToLast(100);
    messagesListener.on('child_added', function(snapshot) {
        var message = snapshot.val();
        message.id = snapshot.key;
        // Проверяем, есть ли уже такое сообщение в DOM
        if (!document.querySelector(`.message[data-message-id="${message.id}"]`)) {
            createMessageElement(message);
        }
    });
    
    // Слушаем удаление сообщений (это ключевая часть для синхронизации у всех)
    database.ref('messages/' + chatId).on('child_removed', function(snapshot) {
        var removedId = snapshot.key;
        var messageElement = document.querySelector(`.message[data-message-id="${removedId}"]`);
        if (messageElement) {
            messageElement.remove();
            showNotification('Сообщение удалено', 'info');
        }
    });
}

function createMessageElement(message) {
    var container = document.getElementById('messages-container');
    var div = document.createElement('div');
    var isSent = message.senderId === currentUser.uid;
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.setAttribute('data-message-id', message.id);
    
    var content = '';
    if (message.type === 'image') {
        content = `<div class="message-image" onclick="openLightbox('${message.imageUrl}')"><img src="${message.imageUrl}" alt="Image"></div>`;
        if (message.caption) content += `<div class="message-text">${escapeHtml(message.caption)}</div>`;
    } else {
        content = `<div class="message-text">${escapeHtml(message.text || '')}</div>`;
    }
    
    var senderHtml = '';
    if (!isSent && (currentChatUser.type === 'group' || currentChatUser.type === 'channel')) {
        database.ref('users/' + message.senderId + '/username').once('value').then(function(snap) {
            var senderEl = div.querySelector('.message-sender');
            if (senderEl) senderEl.textContent = snap.val() || 'Пользователь';
        });
        senderHtml = '<div class="message-sender">Загрузка...</div>';
    }
    
    div.innerHTML = `<div class="message-content">${senderHtml}${content}<div class="message-time">${formatTime(message.timestamp)}</div></div>`;
    
    // Удаление по долгому нажатию (телефон)
    var touchTimer;
    div.addEventListener('touchstart', function(e) {
        touchTimer = setTimeout(function() {
            if (confirm('Удалить сообщение?')) {
                deleteMessage(message.id);
            }
        }, 500);
    });
    div.addEventListener('touchend', function() {
        clearTimeout(touchTimer);
    });
    div.addEventListener('touchcancel', function() {
        clearTimeout(touchTimer);
    });
    
    // Удаление по правому клику (ПК)
    div.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        if (confirm('Удалить сообщение?')) {
            deleteMessage(message.id);
        }
    });
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function deleteMessage(msgId) {
    if (!msgId) {
        showNotification('Ошибка: ID сообщения не найден', 'error');
        return;
    }
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    // Удаляем из Firebase - это автоматически вызовет child_removed у всех клиентов
    database.ref('messages/' + currentChatId + '/' + msgId).remove()
        .catch(function(error) {
            console.error('Ошибка удаления:', error);
            showNotification('Ошибка удаления: ' + error.message, 'error');
        });
}

function sendMessage(){
    var input=document.getElementById('message-input');
    var text=input.value.trim();
    if(!text || !currentChatId) return;
    var message={type:'text', text:text, senderId:currentUser.uid, timestamp:firebase.database.ServerValue.TIMESTAMP};
    input.value='';
    database.ref('messages/'+currentChatId).push(message).then(()=>{
        var lastMsg=text.length>50?text.substring(0,50)+'...':text;
        database.ref('chats/'+currentChatId).update({lastMessage:lastMsg, lastMessageTime:firebase.database.ServerValue.TIMESTAMP});
    }).catch(err=>{ showNotification('Ошибка','error'); input.value=text; });
    document.getElementById('emoji-picker').classList.add('hidden');
}
function handleMessageKeyPress(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } }
function onTyping(){
    if(!currentChatId) return;
    database.ref(`typing/${currentChatId}/${currentUser.uid}`).set(true);
    if(typingTimeout) clearTimeout(typingTimeout);
    typingTimeout=setTimeout(()=>{
        database.ref(`typing/${currentChatId}/${currentUser.uid}`).remove();
    }, 1000);
}
function setupTypingListener(chatId){
    database.ref(`typing/${chatId}`).off();
    database.ref(`typing/${chatId}`).on('value', snap=>{
        var data=snap.val();
        var typingUsers=[];
        for(let uid in data){
            if(uid!==currentUser.uid && data[uid]===true) typingUsers.push(uid);
        }
        var statusEl=document.getElementById('chat-status');
        if(typingUsers.length){
            statusEl.innerHTML='печатает...';
        } else {
            if(currentChatUser.type==='private'){
                var online=currentChatUser.otherUser?.status?.online;
                var lastSeen=currentChatUser.otherUser?.status?.lastSeen;
                if(online) statusEl.innerHTML='в сети';
                else statusEl.innerHTML=formatLastSeen(lastSeen);
            } else {
                statusEl.innerHTML=(currentChatUser.type==='group'?'Группа':'Канал');
            }
        }
    });
}
function openLightbox(url){
    document.getElementById('lightbox-image').src=url;
    document.getElementById('image-lightbox').classList.remove('hidden');
}
function closeLightbox(){
    document.getElementById('image-lightbox').classList.add('hidden');
}

// ========== СОЗДАНИЕ ГРУППЫ ==========
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
function closeCreateGroupDialog() { document.getElementById('create-group-modal').classList.add('hidden'); }
function goToGroupStep2() {
    var name = document.getElementById('group-name').value.trim();
    if (!name) { showNotification('Введите название группы', 'error'); return; }
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
    list.innerHTML = '<div>Загрузка...</div>';
    database.ref('contacts/' + currentUser.uid).once('value').then(snapshot => {
        var contacts = snapshot.val();
        if (!contacts) { list.innerHTML = '<div>Нет контактов. Добавьте их через поиск</div>'; return; }
        var userIds = Object.keys(contacts);
        if (userIds.length === 0) { list.innerHTML = '<div>Нет контактов</div>'; return; }
        list.innerHTML = '';
        userIds.forEach(uid => {
            database.ref('users/' + uid).once('value').then(userSnap => {
                var user = userSnap.val();
                if (!user) return;
                var isSelected = selectedGroupMembers.some(m => m.id === uid);
                var div = document.createElement('div');
                div.className = 'user-item' + (isSelected ? ' selected' : '');
                div.setAttribute('data-username', (user.username || '').toLowerCase());
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                div.innerHTML = `<div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                                <div class="user-item-info"><h4>${escapeHtml(user.username)}</h4></div>
                                <span class="check-mark">${isSelected ? '✓' : ''}</span>`;
                div.onclick = () => toggleGroupMember(uid, user);
                list.appendChild(div);
            });
        });
    });
}
function toggleGroupMember(userId, user) {
    var index = selectedGroupMembers.findIndex(m => m.id === userId);
    if (index > -1) selectedGroupMembers.splice(index, 1);
    else selectedGroupMembers.push({ id: userId, username: user.username, avatar: user.avatar });
    renderSelectedMembers();
    loadGroupMembersList();
}
function renderSelectedMembers() {
    var container = document.getElementById('selected-members');
    if (selectedGroupMembers.length === 0) { container.innerHTML = ''; return; }
    var html = '';
    selectedGroupMembers.forEach(m => {
        html += `<div class="selected-member-chip"><span>${escapeHtml(m.username)}</span><button onclick="removeSelectedMember('${m.id}')">&times;</button></div>`;
    });
    container.innerHTML = html;
}
function removeSelectedMember(userId) {
    selectedGroupMembers = selectedGroupMembers.filter(m => m.id !== userId);
    renderSelectedMembers();
    loadGroupMembersList();
}
function searchGroupMembers() {
    var text = document.getElementById('group-members-search').value.toLowerCase();
    var items = document.querySelectorAll('#group-members-list .user-item');
    items.forEach(item => {
        var username = item.getAttribute('data-username') || '';
        item.style.display = username.includes(text) ? 'flex' : 'none';
    });
}
function createGroup() {
    var name = document.getElementById('group-name').value.trim();
    var description = document.getElementById('group-description').value.trim();
    if (!name) { showNotification('Введите название', 'error'); return; }
    var btn = document.querySelector('#group-step-2 .btn-primary');
    btn.disabled = true; btn.textContent = 'Создание...';
    var avatarPromise = groupAvatarFile ? uploadImageToImgBB(groupAvatarFile) : Promise.resolve(null);
    avatarPromise.then(data => {
        var avatarUrl = data ? data.url : '';
        var chatId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        var members = { [currentUser.uid]: true };
        selectedGroupMembers.forEach(m => { members[m.id] = true; });
        return database.ref('chats/' + chatId).set({
            type: 'group', name: name, description: description, avatar: avatarUrl,
            members: members, admins: { [currentUser.uid]: true }, createdBy: currentUser.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastMessage: 'Группа создана', lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            var promises = [database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true)];
            selectedGroupMembers.forEach(m => promises.push(database.ref('userChats/' + m.id + '/' + chatId).set(true)));
            return Promise.all(promises);
        });
    }).then(() => {
        closeCreateGroupDialog();
        showNotification('Группа "' + name + '" создана!', 'success');
        loadChats();
    }).catch(err => { showNotification('Ошибка создания группы', 'error'); console.error(err); })
    .finally(() => { btn.disabled = false; btn.textContent = 'Создать группу'; });
}

// ========== СОЗДАНИЕ КАНАЛА ==========
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
function closeCreateChannelDialog() { document.getElementById('create-channel-modal').classList.add('hidden'); }
function validateChannelLink() {
    var link = document.getElementById('channel-link').value.trim().toLowerCase();
    var hint = document.getElementById('channel-link-hint');
    if (!link) { hint.textContent = ''; return true; }
    if (!/^[a-z0-9_]+$/.test(link)) { hint.textContent = 'Только латинские буквы, цифры и _'; hint.className = 'hint error'; return false; }
    if (link.length < 3) { hint.textContent = 'Минимум 3 символа'; hint.className = 'hint error'; return false; }
    hint.textContent = '✓ Ссылка: ' + link; hint.className = 'hint success';
    return true;
}
function createChannel() {
    var name = document.getElementById('channel-name').value.trim();
    var description = document.getElementById('channel-description').value.trim();
    var link = document.getElementById('channel-link').value.trim().toLowerCase();
    var typeRadio = document.querySelector('input[name="channel-type"]:checked');
    var isPublic = typeRadio ? typeRadio.value === 'public' : true;
    if (!name) { showNotification('Введите название', 'error'); return; }
    if (link && !validateChannelLink()) return;
    var btn = document.querySelector('#create-channel-modal .btn-primary');
    btn.disabled = true; btn.textContent = 'Создание...';
    var checkLinkPromise = link ? database.ref('channelLinks/' + link).once('value').then(snap => { if (snap.exists()) throw new Error('Ссылка занята'); }) : Promise.resolve();
    checkLinkPromise.then(() => {
        var avatarPromise = channelAvatarFile ? uploadImageToImgBB(channelAvatarFile) : Promise.resolve(null);
        return avatarPromise.then(data => {
            var avatarUrl = data ? data.url : '';
            var chatId = 'channel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var updates = {
                type: 'channel', name: name, description: description, avatar: avatarUrl,
                link: link || null, isPublic: isPublic,
                subscribers: { [currentUser.uid]: true }, admins: { [currentUser.uid]: true },
                createdBy: currentUser.uid, createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: 'Канал создан', lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('chats/' + chatId).set(updates)
                .then(() => database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true))
                .then(() => { if (link) return database.ref('channelLinks/' + link).set(chatId); });
        });
    }).then(() => {
        closeCreateChannelDialog();
        showNotification('Канал "' + name + '" создан!', 'success');
        loadChats();
    }).catch(err => { showNotification(err.message || 'Ошибка', 'error'); console.error(err); })
    .finally(() => { btn.disabled = false; btn.textContent = 'Создать канал'; });
}

// ========== ИНФОРМАЦИЯ О ЧАТЕ ==========
function showChatInfo() {
    if (!currentChatUser) return;
    document.getElementById('chat-info-modal').classList.remove('hidden');
    var chat = currentChatUser;
    var name = '', avatar = '', status = '', description = '';
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
        name = chat.otherUser ? chat.otherUser.username : 'Пользователь';
        avatar = chat.otherUser ? chat.otherUser.avatar : '';
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
        infoAvatar.textContent = chat.type === 'group' ? '👥' : (chat.type === 'channel' ? '📢' : '👤');
    }
}
function closeChatInfo() { document.getElementById('chat-info-modal').classList.add('hidden'); }
function loadMembersList(members, admins) {
    var list = document.getElementById('info-members-list');
    list.innerHTML = '';
    if (!members) return;
    Object.keys(members).forEach(memberId => {
        database.ref('users/' + memberId).once('value').then(snap => {
            var user = snap.val();
            if (!user) return;
            var isAdmin = admins && admins[memberId];
            var avatar = user.avatar || '';
            var avatarStyle = avatar ? 'background-image:url('+avatar+');background-size:cover;' : '';
            var avatarContent = avatar ? '' : '👤';
            var div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = `<div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                            <span class="member-name">${escapeHtml(user.username)}</span>
                            ${isAdmin ? '<span class="member-role">админ</span>' : ''}`;
            list.appendChild(div);
        });
    });
}
function subscribeToChannel() {
    if (!currentChatId) return;
    database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).set(true)
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + currentChatId).set(true))
        .then(() => { showNotification('Подписались', 'success'); closeChatInfo(); loadChats(); })
        .catch(err => showNotification('Ошибка', 'error'));
}
function unsubscribeFromChannel() {
    if (!currentChatId) return;
    if (!confirm('Отписаться от канала?')) return;
    database.ref('chats/' + currentChatId + '/subscribers/' + currentUser.uid).remove()
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove())
        .then(() => { showNotification('Отписались', 'info'); closeChatInfo(); closeChat(); loadChats(); })
        .catch(err => showNotification('Ошибка', 'error'));
}
function leaveChat() {
    if (!currentChatId) return;
    if (!confirm('Покинуть чат?')) return;
    var promise = (currentChatUser.type === 'group') ? database.ref('chats/' + currentChatId + '/members/' + currentUser.uid).remove() : Promise.resolve();
    promise.then(() => database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove())
        .then(() => { showNotification('Вы покинули чат', 'info'); closeChatInfo(); closeChat(); loadChats(); })
        .catch(err => showNotification('Ошибка', 'error'));
}
function deleteChat() {
    if (!currentChatId) return;
    if (!confirm('Удалить чат? Это действие нельзя отменить.')) return;
    database.ref('chats/' + currentChatId).remove()
        .then(() => database.ref('messages/' + currentChatId).remove())
        .then(() => database.ref('userChats/' + currentUser.uid + '/' + currentChatId).remove())
        .then(() => { showNotification('Чат удалён', 'info'); closeChatInfo(); closeChat(); loadChats(); })
        .catch(err => showNotification('Ошибка', 'error'));
}
function showAddMembersDialog() {
    document.getElementById('add-members-modal').classList.remove('hidden');
    document.getElementById('add-members-search').value = '';
    loadAddMembersList();
}
function closeAddMembersDialog() { document.getElementById('add-members-modal').classList.add('hidden'); }
function loadAddMembersList() {
    var list = document.getElementById('add-members-list');
    list.innerHTML = '<div>Загрузка...</div>';
    var currentMembers = currentChatUser.members || {};
    database.ref('contacts/' + currentUser.uid).once('value').then(snapshot => {
        var contacts = snapshot.val();
        if (!contacts) { list.innerHTML = '<div>Нет контактов для добавления</div>'; return; }
        var userIds = Object.keys(contacts);
        list.innerHTML = '';
        userIds.forEach(uid => {
            if (currentMembers[uid]) return;
            database.ref('users/' + uid).once('value').then(userSnap => {
                var user = userSnap.val();
                if (!user) return;
                var div = document.createElement('div');
                div.className = 'user-item';
                div.setAttribute('data-username', (user.username || '').toLowerCase());
                var avatarStyle = user.avatar ? 'background-image:url('+user.avatar+');background-size:cover;' : '';
                var avatarContent = user.avatar ? '' : '👤';
                div.innerHTML = `<div class="avatar" style="${avatarStyle}">${avatarContent}</div>
                                <div class="user-item-info"><h4>${escapeHtml(user.username)}</h4></div>`;
                div.onclick = () => addMemberToGroup(uid);
                list.appendChild(div);
            });
        });
    });
}
function addMemberToGroup(userId) {
    if (!currentChatId) return;
    database.ref('chats/' + currentChatId + '/members/' + userId).set(true)
        .then(() => database.ref('userChats/' + userId + '/' + currentChatId).set(true))
        .then(() => { showNotification('Участник добавлен', 'success'); closeAddMembersDialog(); return database.ref('chats/' + currentChatId).once('value'); })
        .then(snap => { currentChatUser = snap.val(); currentChatUser.chatId = currentChatId; showChatInfo(); })
        .catch(err => showNotification('Ошибка', 'error'));
}
function searchAddMembers() {
    var text = document.getElementById('add-members-search').value.toLowerCase();
    var items = document.querySelectorAll('#add-members-list .user-item');
    items.forEach(item => {
        var username = item.getAttribute('data-username') || '';
        item.style.display = username.includes(text) ? 'flex' : 'none';
    });
}
