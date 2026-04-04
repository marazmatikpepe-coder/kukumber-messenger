// ========================================
// ПОИСК ПУБЛИЧНЫХ КАНАЛОВ
// ========================================

function searchPublicChannels() {
    var searchText = document.getElementById('search-chats').value.toLowerCase().trim();
    
    if (searchText.length < 2) return;
    
    // Ищем среди публичных каналов
    database.ref('chats').orderByChild('type').equalTo('channel').once('value')
    .then(function(snapshot) {
        var channels = snapshot.val();
        if (!channels) return;
        
        Object.keys(channels).forEach(function(chatId) {
            var channel = channels[chatId];
            if (channel.isPublic && channel.name) {
                var name = channel.name.toLowerCase();
                if (name.indexOf(searchText) !== -1) {
                    // Проверяем, не подписан ли уже
                    if (!channel.subscribers || !channel.subscribers[currentUser.uid]) {
                        showChannelInSearch(chatId, channel);
                    }
                }
            }
        });
    });
}

function showChannelInSearch(chatId, channel) {
    var chatsList = document.getElementById('chats-list');
    
    // Проверяем, не показан ли уже
    if (document.querySelector('[data-search-channel="' + chatId + '"]')) return;
    
    var div = document.createElement('div');
    div.className = 'chat-item search-result';
    div.setAttribute('data-search-channel', chatId);
    
    var avatar = channel.avatar || '';
    var avatarStyle = avatar ? 'background-image: url(' + avatar + '); background-size: cover;' : '';
    var avatarContent = avatar ? '' : '📢';
    
    var subsCount = channel.subscribers ? Object.keys(channel.subscribers).length : 0;
    
    div.innerHTML = 
        '<div class="chat-item-avatar">' +
            '<div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
            '<span class="chat-type-badge">📢</span>' +
        '</div>' +
        '<div class="chat-item-info">' +
            '<div class="chat-item-header">' +
                '<span class="chat-item-name">' + escapeHtml(channel.name) + '</span>' +
                '<span class="chat-item-time">' + subsCount + ' подп.</span>' +
            '</div>' +
            '<div class="chat-item-preview">Нажмите чтобы подписаться</div>' +
        '</div>';
    
    div.onclick = function() {
        subscribeToPublicChannel(chatId, channel);
    };
    
    chatsList.insertBefore(div, chatsList.firstChild);
}

function subscribeToPublicChannel(chatId, channel) {
    database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true)
    .then(function() {
        return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
    })
    .then(function() {
        showNotification('Вы подписались на "' + channel.name + '"', 'success');
        
        // Удаляем из результатов поиска
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
// ВСТУПЛЕНИЕ ПО ССЫЛКЕ
// ========================================

function joinChannelByLink(link) {
    if (!link) return;
    
    link = link.toLowerCase().trim();
    
    database.ref('channelLinks/' + link).once('value')
    .then(function(snapshot) {
        var chatId = snapshot.val();
        if (!chatId) {
            showNotification('Канал не найден', 'error');
            return;
        }
        
        return database.ref('chats/' + chatId).once('value');
    })
    .then(function(snapshot) {
        if (!snapshot) return;
        
        var channel = snapshot.val();
        var chatId = snapshot.key;
        
        if (!channel) {
            showNotification('Канал не найден', 'error');
            return;
        }
        
        // Проверяем, подписан ли уже
        if (channel.subscribers && channel.subscribers[currentUser.uid]) {
            showNotification('Вы уже подписаны на этот канал', 'info');
            return;
        }
        
        // Подписываемся
        return database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true)
        .then(function() {
            return database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        })
        .then(function() {
            showNotification('Вы подписались на "' + channel.name + '"', 'success');
            loadChats();
        });
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при вступлении', 'error');
    });
}

// Обновляем функцию поиска чатов
var originalSearchChats = searchChats;
searchChats = function() {
    var text = document.getElementById('search-chats').value.toLowerCase().trim();
    
    // Убираем старые результаты поиска
    document.querySelectorAll('.search-result').forEach(function(el) {
        el.remove();
    });
    
    // Обычный поиск
    document.querySelectorAll('.chat-item:not(.search-result)').forEach(function(item) {
        var name = item.querySelector('.chat-item-name');
        if (name) {
            var nameText = name.textContent.toLowerCase();
            item.style.display = nameText.indexOf(text) !== -1 ? 'flex' : 'none';
        }
    });
    
    // Если текст похож на ссылку канала
    if (text.length >= 3 && /^[a-z0-9_]+$/.test(text)) {
        searchPublicChannels();
    }
};
