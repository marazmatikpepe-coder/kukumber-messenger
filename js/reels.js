// KUKUMBER MESSENGER - REELS
var currentReelFile = null;
var currentReelType = null;
var currentReelsTab = 'feed';
var viewingReelId = null;

// === LOAD REELS ===
function loadReels() {
    var feed = document.getElementById('reels-feed');
    feed.innerHTML = '<div class="empty-reels"><span>🎬</span><p>Загрузка...</p></div>';
    
    var query;
    if (currentReelsTab === 'my') {
        query = database.ref('reels').orderByChild('authorId').equalTo(currentUser.uid);
    } else if (currentReelsTab === 'liked') {
        loadLikedReels();
        return;
    } else {
        query = database.ref('reels').orderByChild('createdAt').limitToLast(50);
    }
    
    query.once('value')
    .then(function(snapshot) {
        var reels = snapshot.val();
        feed.innerHTML = '';
        
        if (!reels) {
            feed.innerHTML = '<div class="empty-reels"><span>🎬</span><p>Пока нет реелсов</p><p>Будьте первым!</p></div>';
            return;
        }
        
        var reelsArray = [];
        Object.keys(reels).forEach(function(id) {
            reelsArray.push({ id: id, data: reels[id] });
        });
        
        reelsArray.sort(function(a, b) {
            return (b.data.createdAt || 0) - (a.data.createdAt || 0);
        });
        
        reelsArray.forEach(function(reel) {
            var card = createReelCard(reel.id, reel.data);
            feed.appendChild(card);
        });
    })
    .catch(function(error) {
        console.error('Ошибка загрузки реелсов:', error);
        feed.innerHTML = '<div class="empty-reels"><span>❌</span><p>Ошибка загрузки</p></div>';
    });
}

function loadLikedReels() {
    var feed = document.getElementById('reels-feed');
    feed.innerHTML = '<div class="empty-reels"><span>❤️</span><p>Функция в разработке</p></div>';
}

function createReelCard(reelId, reelData) {
    var div = document.createElement('div');
    div.className = 'reel-card';
    div.onclick = function() { viewReel(reelId, reelData); };
    
    var mediaHtml = '';
    if (reelData.mediaType === 'video') {
        mediaHtml = '<video src="' + reelData.mediaUrl + '" muted></video>';
    } else {
        mediaHtml = '<img src="' + reelData.mediaUrl + '">';
    }
    
    var likes = reelData.likesCount || 0;
    var comments = reelData.commentsCount || 0;
    
    div.innerHTML = mediaHtml +
        '<div class="reel-card-overlay">' +
            '<div class="reel-card-stats">' +
                '<span>❤️ ' + likes + '</span>' +
                '<span>💬 ' + comments + '</span>' +
            '</div>' +
        '</div>';
    
    return div;
}

function switchReelsTab(tab) {
    currentReelsTab = tab;
    
    var btns = document.querySelectorAll('.reel-tab-btn');
    btns.forEach(function(btn) { btn.classList.remove('active'); });
    event.target.classList.add('active');
    
    loadReels();
}

// === CREATE REEL ===
function showCreateReelModal() {
    document.getElementById('create-reel-modal').classList.remove('hidden');
    currentReelFile = null;
    currentReelType = null;
    document.getElementById('reel-preview').classList.add('hidden');
    document.getElementById('reel-preview').innerHTML = '';
    document.getElementById('reel-caption').value = '';
    document.getElementById('reel-upload-area').style.display = '';
}

function closeCreateReelModal() {
    document.getElementById('create-reel-modal').classList.add('hidden');
}

function previewReelMedia(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    currentReelFile = file;
    currentReelType = file.type.startsWith('video/') ? 'video' : 'image';
    
    var preview = document.getElementById('reel-preview');
    preview.innerHTML = '';
    preview.classList.remove('hidden');
    document.getElementById('reel-upload-area').style.display = 'none';
    
    var reader = new FileReader();
    reader.onload = function(e) {
        if (currentReelType === 'video') {
            preview.innerHTML = '<video src="' + e.target.result + '" controls></video>';
        } else {
            preview.innerHTML = '<img src="' + e.target.result + '">';
        }
    };
    reader.readAsDataURL(file);
}

function publishReel() {
    if (!currentReelFile) {
        showNotification('Выберите видео или фото', 'error');
        return;
    }
    
    var caption = document.getElementById('reel-caption').value.trim();
    var commentsEnabled = document.getElementById('reel-comments-enabled').checked;
    
    showNotification('Загрузка реелса...', 'info');
    
    uploadImageToImgBB(currentReelFile)
    .then(function(imageData) {
        if (!imageData) throw new Error('Ошибка загрузки');
        
        var reelId = 'reel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        return database.ref('reels/' + reelId).set({
            authorId: currentUser.uid,
            authorName: currentUserData.username || 'Пользователь',
            authorAvatar: currentUserData.avatar || '',
            mediaUrl: imageData.url,
            mediaType: currentReelType,
            caption: caption,
            commentsEnabled: commentsEnabled,
            likesCount: 0,
            commentsCount: 0,
            viewsCount: 0,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
    })
    .then(function() {
        closeCreateReelModal();
        showNotification('Реелс опубликован! 🎬', 'success');
        loadReels();
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка публикации', 'error');
    });
}

// === VIEW REEL ===
function viewReel(reelId, reelData) {
    viewingReelId = reelId;
    
    document.getElementById('view-reel-modal').classList.remove('hidden');
    
    var mediaContainer = document.getElementById('reel-media-container');
    if (reelData.mediaType === 'video') {
        mediaContainer.innerHTML = '<video src="' + reelData.mediaUrl + '" controls autoplay></video>';
    } else {
        mediaContainer.innerHTML = '<img src="' + reelData.mediaUrl + '">';
    }
    
    var avatar = document.getElementById('reel-author-avatar');
    if (reelData.authorAvatar) {
        avatar.style.backgroundImage = 'url(' + reelData.authorAvatar + ')';
        avatar.style.backgroundSize = 'cover';
        avatar.textContent = '';
    } else {
        avatar.style.backgroundImage = '';
        avatar.textContent = '👤';
    }
    
    document.getElementById('reel-author-name').textContent = reelData.authorName || 'Пользователь';
    document.getElementById('reel-caption-view').textContent = reelData.caption || '';
    document.getElementById('reel-likes-count').textContent = reelData.likesCount || 0;
    document.getElementById('reel-comments-count').textContent = reelData.commentsCount || 0;
    
    // Increment views
    database.ref('reels/' + reelId + '/viewsCount').transaction(function(views) {
        return (views || 0) + 1;
    });
    
    // Check if liked
    checkIfLiked(reelId);
}

function closeViewReelModal() {
    document.getElementById('view-reel-modal').classList.add('hidden');
    viewingReelId = null;
}

function checkIfLiked(reelId) {
    database.ref('reelLikes/' + reelId + '/' + currentUser.uid).once('value')
    .then(function(snapshot) {
        var btn = document.getElementById('like-reel-btn');
        if (snapshot.exists()) {
            btn.classList.add('liked');
            btn.innerHTML = '❤️ <span id="reel-likes-count">' + (document.getElementById('reel-likes-count').textContent) + '</span>';
        } else {
            btn.classList.remove('liked');
        }
    });
}

function likeReel() {
    if (!viewingReelId) return;
    
    var likeRef = database.ref('reelLikes/' + viewingReelId + '/' + currentUser.uid);
    var countRef = database.ref('reels/' + viewingReelId + '/likesCount');
    
    likeRef.once('value')
    .then(function(snapshot) {
        if (snapshot.exists()) {
            // Unlike
            likeRef.remove();
            countRef.transaction(function(count) { return Math.max((count || 1) - 1, 0); });
            document.getElementById('like-reel-btn').classList.remove('liked');
        } else {
            // Like
            likeRef.set(true);
            countRef.transaction(function(count) { return (count || 0) + 1; });
            document.getElementById('like-reel-btn').classList.add('liked');
        }
        
        // Update display
        countRef.once('value').then(function(snap) {
            document.getElementById('reel-likes-count').textContent = snap.val() || 0;
        });
    });
}

function showReelComments() {
    showNotification('Комментарии в разработке', 'info');
}

function shareReel() {
    if (navigator.share) {
        navigator.share({
            title: 'Реелс в Kukumber',
            text: 'Посмотри этот реелс!',
            url: window.location.href
        });
    } else {
        showNotification('Скопируйте ссылку вручную', 'info');
    }
}
