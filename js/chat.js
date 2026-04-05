// KUKUMBER MESSENGER - CHAT (полная версия с контактами, удалением, индикаторами)

var currentTab = 'all';
var selectedGroupMembers = [];
var groupAvatarFile = null;
var channelAvatarFile = null;
var typingTimeout = null;

// === ГЛОБАЛЬНЫЙ ПОИСК И КОНТАКТЫ ===
function showGlobalSearch() {
    document.getElementById('global-search-modal').classList.remove('hidden');
    loadGlobalUsers();
}
function closeGlobalSearch() {
    document.getElementById('global-search-modal').classList.add('hidden');
}
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

// === НОВЫЙ ЧАТ ТОЛЬКО ИЗ КОНТАКТОВ ===
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

// === ПОИСК ЧАТОВ (каналы и т.д.) ===
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

// === ЗАГРУЗКА СПИСКА ЧАТОВ ===
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

// === ОТКРЫТИЕ ЧАТА ===
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
        hideCallButtons();
        document.getElementById('message-input-area').classList.remove('hidden');
        document.getElementById('channel-footer').classList.add('hidden');
    } else if(chatData.type==='channel'){
        name=chatData.name||'Канал';
        avatar=chatData.avatar||'';
        status=(chatData.subscribers?Object.keys(chatData.subscribers).length:0)+' подписчиков';
        hideCallButtons();
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
        showCallButtons();
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
    // Убираем выделение
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
function hideCallButtons(){ document.querySelectorAll('.call-btn').forEach(btn=>btn.style.display='none'); }
function showCallButtons(){ document.querySelectorAll('.call-btn').forEach(btn=>btn.style.display=''); }
function closeChat(){
    document.getElementById('active-chat').classList.add('hidden');
    document.getElementById('no-chat-selected').classList.remove('hidden');
    currentChatId=null; currentChatUser=null;
    if(messagesListener) messagesListener.off();
}

// === СООБЩЕНИЯ ===
function loadMessages(chatId){
    var container=document.getElementById('messages-container');
    container.innerHTML='';
    if(messagesListener) messagesListener.off();
    messagesListener=database.ref('messages/'+chatId).orderByChild('timestamp').limitToLast(100);
    messagesListener.on('child_added', snapshot=>{
        var message=snapshot.val();
        message.id=snapshot.key;
        createMessageElement(message);
    });
}
function createMessageElement(message){
    var container=document.getElementById('messages-container');
    var div=document.createElement('div');
    var isSent=message.senderId===currentUser.uid;
    div.className='message '+(isSent?'sent':'received');
    var content='';
    if(message.type==='image'){
        content=`<div class="message-image" onclick="openLightbox('${message.imageUrl}')"><img src="${message.imageUrl}" alt="Image"></div>`;
        if(message.caption) content+=`<div class="message-text">${escapeHtml(message.caption)}</div>`;
    } else if(message.type==='audio'){
        content=`<div class="audio-message"><button onclick="playAudio('${message.audioUrl}')">▶️</button><audio src="${message.audioUrl}" style="display:none"></audio><span>Голосовое сообщение</span></div>`;
    } else if(message.type==='video_circle'){
        content=`<div class="video-message"><video src="${message.videoUrl}" controls style="max-width:200px; border-radius:50%;"></video></div>`;
    } else {
        content=`<div class="message-text">${escapeHtml(message.text||'')}</div>`;
    }
    var senderHtml='';
    if(!isSent && (currentChatUser.type==='group'||currentChatUser.type==='channel')){
        database.ref('users/'+message.senderId+'/username').once('value').then(snap=>{
            var senderEl=div.querySelector('.message-sender');
            if(senderEl) senderEl.textContent=snap.val()||'Пользователь';
        });
        senderHtml='<div class="message-sender">Загрузка...</div>';
    }
    div.innerHTML=`<div class="message-content">${senderHtml}${content}<div class="message-time">${formatTime(message.timestamp)}</div></div>`;
    div.addEventListener('contextmenu',(e)=>{ e.preventDefault(); if(confirm('Удалить сообщение?')) deleteMessage(message.id); });
    var touchTimer;
    div.addEventListener('touchstart',()=>{ touchTimer=setTimeout(()=>{ if(confirm('Удалить сообщение?')) deleteMessage(message.id); },500); });
    div.addEventListener('touchend',()=>clearTimeout(touchTimer));
    container.appendChild(div);
    container.scrollTop=container.scrollHeight;
}
function deleteMessage(msgId){
    database.ref('messages/'+currentChatId+'/'+msgId).remove().then(()=>showNotification('Сообщение удалено','info'));
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
function playAudio(url){
    var audio=new Audio(url);
    audio.play();
}

// === УДАЛЕНИЕ РЕЕЛСА (функция будет в reels.js, но добавим сюда для связки) ===
window.deleteCurrentReel = function(){
    if(!viewingReelId) return;
    database.ref('reels/'+viewingReelId).once('value').then(snap=>{
        var reel=snap.val();
        if(reel.authorId===currentUser.uid || isSuperAdmin){
            if(confirm('Удалить реелс?')){
                database.ref('reels/'+viewingReelId).remove().then(()=>{
                    showNotification('Реелс удалён','success');
                    closeViewReelModal();
                    loadReels();
                });
            }
        } else showNotification('Нет прав','error');
    });
};

// === ОСТАЛЬНЫЕ ФУНКЦИИ (группы, каналы, инфо) ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ, НО ДЛЯ ЭКОНОМИИ МЕСТА Я ИХ НЕ ДУБЛИРУЮ. ОНИ ЕСТЬ В ВАШЕМ ИСХОДНОМ КОДЕ. ВАМ НУЖНО ВЗЯТЬ ИХ ИЗ ПРЕДЫДУЩЕГО ФАЙЛА chat.js (createGroup, createChannel и т.д.) И ВСТАВИТЬ СЮДА. Я ДАЛ ОСНОВНЫЕ НОВОВВЕДЕНИЯ.
