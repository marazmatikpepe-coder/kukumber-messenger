console.log('slices.js загружен');
// SLICES (Слайсы) - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ 6.0
// Лайки, репосты, комментарии, профиль (только посты и репосты)
// Баннер (цвета, картинка, GIF) - ИСПРАВЛЕН
// Подписчики, колокольчик, верификация
// Звук при создании слайса
// Модальные окна не перекрываются - ИСПРАВЛЕНО

var currentSlicesTab = 'feed';
var pendingSliceFiles = [];
var searchTimeout = null;
var slicesListener = null;
var openCommentsSliceId = null;
var pendingLikeRequests = {};
var pendingRepostRequests = {};

// Звук при создании слайса
var sliceCreateSound = null;
function initSliceSound() {
    sliceCreateSound = new Audio('https://s33.aconvert.com/convert/p3r68-cdx67/rvt3w-3afhb.mp3');
    sliceCreateSound.load();
}
function playSliceCreateSound() {
    if (sliceCreateSound && (typeof getSoundsEnabled === 'function' ? getSoundsEnabled() : true)) {
        try {
            sliceCreateSound.currentTime = 0;
            sliceCreateSound.play().catch(function(e) { console.log('Звук не воспроизведён:', e); });
        } catch(e) { console.log('Ошибка звука:', e); }
    }
}

function loadSlices() {
    var feed = document.getElementById('slices-feed');
    if (!feed) {
        console.error('slices-feed не найден');
        return;
    }
    
    if (!currentUser || !currentUser.uid) {
        feed.innerHTML = '<div class="empty-slices"><span>🔐</span><p>Войдите в аккаунт</p></div>';
        return;
    }
    
    var searchInput = document.getElementById('slices-search-input');
    if (searchInput) searchInput.value = '';
    
    feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Загрузка...</p></div>';
    
    // Очищаем Set
    if (typeof loadedSliceIds !== 'undefined') {
        loadedSliceIds.clear();
    }
    
    // Отключаем старый слушатель
    if (slicesListener) {
        slicesListener.off();
    }
    
    // Загружаем существующие посты
    database.ref('slices').orderByChild('createdAt').limitToLast(100).once('value', function(snapshot) {
        var slices = snapshot.val();
        if (!feed) return;
        
        if (!slices || Object.keys(slices).length === 0) {
            feed.innerHTML = '<div class="empty-slices"><span>🍕</span><p>Пока нет постов</p><p>Будьте первым!</p></div>';
            // Всё равно настраиваем слушатель
            setupSlicesListener();
            return;
        }
        
        var slicesArray = [];
        for (var id in slices) {
            if (typeof loadedSliceIds !== 'undefined') {
                loadedSliceIds.add(id);
            }
            slicesArray.push({ id: id, data: slices[id] });
        }
        
        slicesArray.sort(function(a, b) {
            if (a.data.pinned && !b.data.pinned) return -1;
            if (!a.data.pinned && b.data.pinned) return 1;
            return (b.data.createdAt || 0) - (a.data.createdAt || 0);
        });
        
        feed.innerHTML = '';
        
        var pendingCount = slicesArray.length;
        slicesArray.forEach(function(slice) {
            database.ref('sliceLikes/' + slice.id + '/' + currentUser.uid).once('value').then(function(snap) {
                slice.data.userLiked = snap.exists();
                var card = createSliceCard(slice.id, slice.data);
                if (feed) feed.appendChild(card);
            });
        });
        
        // Настраиваем слушатель для новых постов
        setupSlicesListener();
    });
}
// ========== СОЗДАНИЕ КАРТОЧКИ ПОСТА ==========
function createSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card';
    div.setAttribute('data-slice-id', sliceId);

    div.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showSliceContextMenu(e, sliceId, sliceData);
    });
    
    var touchTimer = null;
    div.addEventListener('touchstart', function(e) {
        touchTimer = setTimeout(function() {
            showSliceContextMenu(e, sliceId, sliceData);
        }, 500);
    });
    div.addEventListener('touchend', function() { if (touchTimer) clearTimeout(touchTimer); });
    div.addEventListener('touchmove', function() { if (touchTimer) clearTimeout(touchTimer); });
    
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var avatarClass = (!sliceData.authorAvatar) ? 'default-avatar-user' : '';
    var avatarContent = '';
     // ========== ВСТАВЬТЕ НОВЫЙ КОД ЗДЕСЬ ==========
    var isNightMode = document.body.classList.contains('night-mode');
    
    var likedDarkIcon = 'https://i.ibb.co/q3sv3PMj/67467-E73-865-F-457-B-A63-E-7-C6-A05-FEF8-CC.png';
    var likedLightIcon = 'https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png';
    var likeNotLikedIcon = 'https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png';
    
    var likeIcon = sliceData.userLiked ? 
        '<img src="' + (isNightMode ? likedDarkIcon : likedLightIcon) + '" class="like-icon" style="width:24px; height:24px;">' : 
        '<img src="' + likeNotLikedIcon + '" class="like-icon not-liked" style="width:24px; height:24px;">';
    
    var commentIcon = '<img src="https://i.ibb.co/PzVWZ3dd/980-E0-C70-E93-B-4-AA0-80-AD-883-AD22-EB40-C.png" class="comment-icon" style="width:24px; height:24px;">';
    var repostIcon = '<img src="https://i.ibb.co/BHzJVy1L/3545-DF6-B-CA20-410-D-8837-DB9-EC1-B2-A080.png" class="repost-icon" style="width:24px; height:24px;">';
  var isNightMode = document.body.classList.contains('night-mode');
var shareIconUrl = isNightMode 
    ? 'https://i.ibb.co/0V8JyjC3/editing-result-6787fc285b3311f190609e4ea3a14128-1-edited-free-carve-photos.png'
    : 'https://i.ibb.co/wZQLtzpD/diting-result-8a8a10f55b3311f18da93e778ec87452-1-no-bg-preview-carve-photos.png';
var shareIcon = '<img src="' + shareIconUrl + '" class="share-icon" style="width:28px; height:28px;">';
    // ========== КОНЕЦ ВСТАВКИ ==========
    
    var mediaHtml = '';
    
    var mediaHtml = '';
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls && sliceData.mediaUrls.length > 0) {
        mediaHtml = '<div class="slice-media-multiple" id="slice-media-'+sliceId+'">';
        mediaHtml += '<div class="slice-media-slider">';
        sliceData.mediaUrls.forEach(function(url, idx) {
            var isGif = url.toLowerCase().endsWith('.gif');
            if (isGif) {
                mediaHtml += '<div class="slice-slide"><img src="'+url+'" class="slice-gif" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+url+'\')"></div>';
            } else {
                mediaHtml += '<div class="slice-slide"><img src="'+url+'" class="slice-image" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+url+'\')"></div>';
            }
        });
        mediaHtml += '</div>';
        if (sliceData.mediaUrls.length > 1) {
            mediaHtml += '<button class="slice-slider-prev" onclick="event.stopPropagation(); slideSlice(\''+sliceId+'\', -1)">←</button>';
            mediaHtml += '<button class="slice-slider-next" onclick="event.stopPropagation(); slideSlice(\''+sliceId+'\', 1)">→</button>';
            mediaHtml += '<div class="slice-slider-dots" id="slice-dots-'+sliceId+'"></div>';
        }
        mediaHtml += '</div>';
    } else if (sliceData.mediaUrl) {
        var isGif = sliceData.mediaUrl.toLowerCase().endsWith('.gif');
        if (isGif) {
            mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-gif" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
        } else {
            mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-image" loading="lazy" onclick="event.stopPropagation(); openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
        }
    }
    
    var textHtml = '';
    if (sliceData.text) {
        var displayText = sliceData.text;
        if (sliceData.edited) displayText += ' <span style="font-size:10px; opacity:0.6;">(ред.)</span>';
        textHtml = '<div class="slice-text">'+formatSliceText(displayText)+'</div>';
    }
    
    var hashtagsHtml = '';
    if (sliceData.hashtags && sliceData.hashtags.length) {
        hashtagsHtml = '<div class="slice-hashtags">';
        sliceData.hashtags.forEach(function(tag) {
            hashtagsHtml += '<span class="slice-hashtag" onclick="searchByHashtag(\''+tag+'\')">#'+tag+'</span>';
        });
        hashtagsHtml += '</div>';
    }
    
    var pinnedBadge = sliceData.pinned ? '<span class="slice-pinned-badge">📌 Закреплено</span>' : '';
    
    database.ref('users/' + sliceData.authorId + '/verified').once('value').then(function(snap) {
        if (snap.val() === true) {
            var badgeSpan = div.querySelector('.verified-badge-placeholder');
            if (badgeSpan) {
                badgeSpan.innerHTML = '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:16px; height:16px; cursor:pointer;" onclick="event.stopPropagation(); showVerifiedInfo()">';
            }
        }
    });
    
   
    div.innerHTML = `
        <div class="slice-header">
            <div class="slice-author" onclick="openUserProfile('${sliceData.authorId}')" style="cursor:pointer;">
                <div class="avatar ${avatarClass}" style="${avatarStyle}">${avatarContent}</div>
                <div class="slice-author-info">
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                        <span class="verified-badge-placeholder"></span>
                    </div>
                    <span class="slice-date">${formatSliceDate(sliceData.createdAt)}</span>
                </div>
            </div>
            <div class="slice-views">
    <span class="slice-views-count">
        <span class="slice-views-number">${sliceData.viewsCount || 0}</span>
    </span>
</div>
        </div>
        ${pinnedBadge}
        ${mediaHtml}
        ${textHtml}
        ${hashtagsHtml}
        <div class="slice-actions">
            <div class="slice-actions-left">
                <button class="slice-action-btn like-btn ${sliceData.userLiked ? 'liked' : ''}" onclick="likeSlice('${sliceId}')">
                    ${likeIcon} <span class="like-count">${sliceData.likesCount || 0}</span>
                </button>
                <button class="slice-action-btn" onclick="toggleComments('${sliceId}')">
                    ${commentIcon} <span class="comment-count">${sliceData.commentsCount || 0}</span>
                </button>
                <button class="slice-action-btn" onclick="repostSlice('${sliceId}')">
                    ${repostIcon} <span class="repost-count">${sliceData.repostsCount || 0}</span>
                </button>
            </div>
            <div class="slice-actions-right">
                <button class="slice-action-btn" onclick="shareSlice('${sliceId}')">${shareIcon}</button>
            </div>
        </div>
        <div id="comments-block-${sliceId}" class="comments-block" style="display: none;">
            <div class="comments-loading">Загрузка комментариев...</div>
        </div>
    `;
    
    if (sliceData.mediaType === 'multiple' && sliceData.mediaUrls && sliceData.mediaUrls.length > 1) {
        setTimeout(function() { initSliceSlider(sliceId, sliceData.mediaUrls.length); }, 100);
    }
    
    var viewedKey = 'viewed_slice_' + sliceId;
    if (!sessionStorage.getItem(viewedKey)) {
        sessionStorage.setItem(viewedKey, 'true');
        database.ref('slices/' + sliceId + '/viewsCount').transaction(function(v) { return (v || 0) + 1; });
    }
    
    return div;
}

// ========== ЛАЙКИ ==========
function likeSlice(sliceId) {
    if (pendingLikeRequests[sliceId]) return;
    pendingLikeRequests[sliceId] = true;
    
    var likeRef = database.ref('sliceLikes/' + sliceId + '/' + currentUser.uid);
    var sliceRef = database.ref('slices/' + sliceId);
    var card = document.querySelector('.slice-card[data-slice-id="' + sliceId + '"]');
    
    likeRef.once('value').then(function(snap) {
        var isLiked = snap.exists();
        
        if (isLiked) {
            likeRef.remove();
            sliceRef.transaction(function(currentData) {
                if (currentData) currentData.likesCount = Math.max((currentData.likesCount || 1) - 1, 0);
                return currentData;
            });
            if (card) {
                var likeBtn = card.querySelector('.like-btn');
                var likeCountSpan = card.querySelector('.like-count');
                var currentCount = parseInt(likeCountSpan.textContent) || 0;
                likeCountSpan.textContent = Math.max(currentCount - 1, 0);
                likeBtn.innerHTML = '<img src="https://i.ibb.co/4wPS6NB6/7-B6-E9-A78-01-E0-4481-9135-005-C4-F238-FD8.png" style="width:24px; height:24px;"> <span class="like-count">' + Math.max(currentCount - 1, 0) + '</span>';
            }
        } else {
            likeRef.set(true);
            sliceRef.transaction(function(currentData) {
                if (currentData) currentData.likesCount = (currentData.likesCount || 0) + 1;
                return currentData;
            });
            if (card) {
                var likeBtn = card.querySelector('.like-btn');
                var likeCountSpan = card.querySelector('.like-count');
                var currentCount = parseInt(likeCountSpan.textContent) || 0;
                likeCountSpan.textContent = currentCount + 1;
                likeBtn.innerHTML = '<img src="https://i.ibb.co/0HFsXGK/1-CD2632-B-7-DD7-46-D4-8920-FBBE5-B29-D34-D.png" style="width:24px; height:24px;"> <span class="like-count">' + (currentCount + 1) + '</span>';
            }
        }
        setTimeout(function() { delete pendingLikeRequests[sliceId]; }, 500);
    }).catch(function() { delete pendingLikeRequests[sliceId]; });
}

// ========== РЕПОСТЫ ==========
function repostSlice(sliceId) {
    if (pendingRepostRequests[sliceId]) return;
    pendingRepostRequests[sliceId] = true;
    
    var repostRef = database.ref('userReposts/' + currentUser.uid + '/' + sliceId);
    
    repostRef.once('value').then(function(snap) {
        if (snap.exists()) {
            repostRef.remove();
            database.ref('slices/' + sliceId + '/repostsCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
            var userRepostQuery = database.ref('slices').orderByChild('originalId').equalTo(sliceId);
            userRepostQuery.once('value').then(function(repostSnap) {
                repostSnap.forEach(function(child) {
                    if (child.val().authorId === currentUser.uid && child.val().type === 'repost') {
                        child.ref.remove();
                    }
                });
            });
            showNotification('Репост удалён', 'info');
            loadSlices();
        } else {
            database.ref('slices/' + sliceId).once('value').then(function(snapshot) {
                var originalSlice = snapshot.val();
                if (!originalSlice) return;
                
                var repostData = {
                    type: 'repost',
                    originalId: sliceId,
                    originalAuthorId: originalSlice.authorId,
                    originalAuthorName: originalSlice.authorName,
                    originalText: originalSlice.text,
                    originalMediaUrl: originalSlice.mediaUrl || (originalSlice.mediaUrls ? originalSlice.mediaUrls[0] : null),
                    authorId: currentUser.uid,
                    authorName: currentUserData.username,
                    authorAvatar: currentUserData.avatar || '',
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    repostsCount: 0,
                    likesCount: 0,
                    viewsCount: 0
                };
                
                database.ref('slices/').push(repostData).then(function() {
                    repostRef.set(true);
                    database.ref('slices/' + sliceId + '/repostsCount').transaction(function(c) { return (c || 0) + 1; });
                    showNotification('Репостнуто!', 'success');
                    loadSlices();
                });
            });
        }
        setTimeout(function() { delete pendingRepostRequests[sliceId]; }, 1000);
    }).catch(function() { delete pendingRepostRequests[sliceId]; });
}

// ========== КОММЕНТАРИИ С ВЛОЖЕННЫМИ ОТВЕТАМИ ==========

// Глобальный объект для хранения состояния открытых ответов
var openRepliesState = {};

function toggleComments(sliceId) {
    var commentsBlock = document.getElementById('comments-block-' + sliceId);
    if (!commentsBlock) return;
    
    if (commentsBlock.style.display === 'none') {
        commentsBlock.style.display = 'block';
        loadComments(sliceId);
    } else {
        commentsBlock.style.display = 'none';
    }
}

function loadComments(sliceId) {
    var container = document.getElementById('comments-block-' + sliceId);
    if (!container) return;
    
    container.innerHTML = '<div class="comments-loading">Загрузка комментариев...</div>';
    
    // Загружаем ВСЕ комментарии к этому посту
    database.ref('sliceComments/' + sliceId).once('value').then(async function(snapshot) {
        var comments = snapshot.val();
        
        if (!comments || Object.keys(comments).length === 0) {
            container.innerHTML = `
                <div class="comments-list">
                    <div class="no-comments">Комментариев пока нет. Будьте первым!</div>
                </div>
                <div class="add-comment">
                    <textarea id="comment-text-${sliceId}" placeholder="Написать комментарий..." rows="2"></textarea>
                    <button onclick="addComment('${sliceId}')">Отправить</button>
                </div>
            `;
            return;
        }
        
        // Преобразуем объект в массив и добавляем id
        var commentsArray = [];
        var authorIds = [];
        
        for (var id in comments) {
            var comment = comments[id];
            comment.id = id;
            commentsArray.push(comment);
            if (comment.authorId && !authorIds.includes(comment.authorId)) {
                authorIds.push(comment.authorId);
            }
        }
        
        // Загружаем статус верификации для всех авторов комментариев
        var verifiedStatus = {};
        for (var i = 0; i < authorIds.length; i++) {
            var uid = authorIds[i];
            try {
                var userSnap = await database.ref('users/' + uid + '/verified').once('value');
                verifiedStatus[uid] = userSnap.val() === true;
            } catch(e) {
                verifiedStatus[uid] = false;
            }
        }
        
        // Добавляем статус верификации к каждому комментарию
        for (var i = 0; i < commentsArray.length; i++) {
            commentsArray[i].authorVerified = verifiedStatus[commentsArray[i].authorId] === true;
        }
        
        // Сортируем по дате создания (старые сверху)
        commentsArray.sort(function(a, b) {
            return (a.createdAt || 0) - (b.createdAt || 0);
        });
        
        // Строим дерево комментариев
        var commentsTree = [];
        var commentsById = {};
        
        // Сначала создаём карту всех комментариев по id
        for (var i = 0; i < commentsArray.length; i++) {
            var comment = commentsArray[i];
            commentsById[comment.id] = comment;
            comment.replies = [];
        }
        
        // Формируем дерево: корневые комментарии (без parentId) и ответы
        for (var i = 0; i < commentsArray.length; i++) {
            var comment = commentsArray[i];
            if (comment.parentId && commentsById[comment.parentId]) {
                // Это ответ - добавляем к родителю
                commentsById[comment.parentId].replies.push(comment);
            } else {
                // Это корневой комментарий
                commentsTree.push(comment);
            }
        }
        
        // Рендерим HTML
        var commentsHtml = '<div class="comments-list">';
        
        for (var i = 0; i < commentsTree.length; i++) {
            commentsHtml += renderCommentItem(commentsTree[i], sliceId, 0);
        }
        
        commentsHtml += '</div>';
        commentsHtml += `
            <div class="add-comment">
                <textarea id="comment-text-${sliceId}" placeholder="Написать комментарий..." rows="2"></textarea>
                <button onclick="addComment('${sliceId}')">Отправить</button>
            </div>
        `;
        
        container.innerHTML = commentsHtml;
    });
}
// Функция для отрисовки одного комментария и всех его ответов
function renderCommentItem(comment, sliceId, level) {
    var marginLeft = level * 36;
    var hasReplies = comment.replies && comment.replies.length > 0;
    var replyId = 'replies-container-' + comment.id;
    var isOpen = openRepliesState[comment.id] === true;
    
    var avatarStyle = comment.authorAvatar ? 'background-image:url('+comment.authorAvatar+');background-size:cover;' : '';
    var avatarClass = (!comment.authorAvatar) ? 'default-avatar-user' : '';
    
    // Определяем, есть ли у пользователя лайк на этом комментарии
    var isLiked = false;
    if (comment.userLiked) isLiked = true;
    
    var likeIcon = isLiked ? '❤️' : '🤍';
    
    // ПОЛУЧАЕМ СТАТУС ВЕРИФИКАЦИИ АВТОРА КОММЕНТАРИЯ
    var verifiedBadge = '';
    if (comment.authorVerified === true) {
        verifiedBadge = '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" class="comment-verified-badge" style="width:14px; height:14px; margin-left:4px; vertical-align:middle; cursor:pointer;" onclick="event.stopPropagation(); showVerifiedInfo()">';
    }
    
    // HTML для ответов (если есть)
    var repliesHtml = '';
    if (hasReplies) {
        var displayStyle = isOpen ? 'block' : 'none';
        var toggleIcon = isOpen ? '▲' : '▼';
        var toggleText = isOpen ? 'Скрыть ответы' : 'Показать ответы';
        
        repliesHtml = `
            <div class="comment-replies-toggle">
                <button class="comment-toggle-replies-btn" onclick="toggleRepliesVisibility('${sliceId}', '${comment.id}')">
                    ${toggleIcon} ${toggleText} (${comment.replies.length})
                </button>
            </div>
            <div id="${replyId}" class="replies-container" style="display: ${displayStyle};">
        `;
        
        for (var i = 0; i < comment.replies.length; i++) {
            repliesHtml += renderCommentItem(comment.replies[i], sliceId, level + 1);
        }
        
        repliesHtml += `</div>`;
    }
    
    return `
        <div class="comment-item" data-comment-id="${comment.id}" style="margin-left: ${marginLeft}px;">
            <div class="comment-header">
                <div class="comment-author-avatar ${avatarClass}" style="${avatarStyle}"></div>
                <div class="comment-author-info">
                    <span class="comment-author-name">
                        ${escapeHtml(comment.authorName)}
                        ${verifiedBadge}
                    </span>
                    <span class="comment-date">${formatSliceDate(comment.createdAt)}</span>
                </div>
                <button class="comment-like-btn" onclick="likeComment('${sliceId}', '${comment.id}')">
                    ${likeIcon} <span class="comment-like-count">${comment.likesCount || 0}</span>
                </button>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            <div class="comment-actions">
                <button class="comment-reply-btn" onclick="showReplyForm2('${sliceId}', '${comment.id}')">Ответить</button>
            </div>
            ${repliesHtml}
        </div>
    `;
}
// Функция для показа/скрытия ответов
function toggleRepliesVisibility(sliceId, commentId) {
    var container = document.getElementById('replies-container-' + commentId);
    var toggleBtn = document.querySelector(`.comment-toggle-replies-btn[onclick*="${commentId}"]`);
    
    if (!container) return;
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        if (toggleBtn) {
            var count = toggleBtn.innerHTML.match(/\((\d+)\)/);
            var num = count ? count[1] : '';
            toggleBtn.innerHTML = '▲ Скрыть ответы (' + num + ')';
        }
        openRepliesState[commentId] = true;
    } else {
        container.style.display = 'none';
        if (toggleBtn) {
            var count = toggleBtn.innerHTML.match(/\((\d+)\)/);
            var num = count ? count[1] : '';
            toggleBtn.innerHTML = '▼ Показать ответы (' + num + ')';
        }
        openRepliesState[commentId] = false;
    }
}

// Функция для показа формы ответа
function showReplyForm2(sliceId, parentId) {
    // Находим контейнер для ответов
    var repliesContainer = document.getElementById('replies-container-' + parentId);
    
    // Если контейнера нет, создаём его
    if (!repliesContainer) {
        var commentItem = document.querySelector(`.comment-item[data-comment-id="${parentId}"]`);
        if (commentItem) {
            // Создаём контейнер для ответов
            var newContainer = document.createElement('div');
            newContainer.id = 'replies-container-' + parentId;
            newContainer.className = 'replies-container';
            newContainer.style.display = 'block';
            commentItem.appendChild(newContainer);
            repliesContainer = newContainer;
            
            // Обновляем состояние
            openRepliesState[parentId] = true;
        }
    }
    
    if (!repliesContainer) return;
    
    // Показываем контейнер если скрыт
    if (repliesContainer.style.display === 'none') {
        repliesContainer.style.display = 'block';
        openRepliesState[parentId] = true;
        
        // Обновляем кнопку
        var toggleBtn = document.querySelector(`.comment-toggle-replies-btn[onclick*="${parentId}"]`);
        if (toggleBtn) {
            var count = toggleBtn.innerHTML.match(/\((\d+)\)/);
            var num = count ? count[1] : '';
            toggleBtn.innerHTML = '▲ Скрыть ответы (' + num + ')';
        }
    }
    
    // Убираем существующую форму
    var existingForm = repliesContainer.querySelector('.reply-form');
    if (existingForm) existingForm.remove();
    
    // Создаём новую форму
    var formHtml = `
        <div class="reply-form">
            <textarea id="reply-text-${parentId}" placeholder="Написать ответ..." rows="2"></textarea>
            <div style="display: flex; gap: 8px; margin-top: 5px;">
                <button onclick="addReply('${sliceId}', '${parentId}')">Ответить</button>
                <button onclick="cancelReplyForm('${parentId}')" class="cancel-reply-btn">Отмена</button>
            </div>
        </div>
    `;
    
    repliesContainer.insertAdjacentHTML('beforeend', formHtml);
    document.getElementById('reply-text-' + parentId).focus();
}

// Функция для добавления ответа
function addReply(sliceId, parentId) {
    var textarea = document.getElementById('reply-text-' + parentId);
    var text = textarea ? textarea.value.trim() : '';
    
    if (!text) {
        showNotification('Введите текст ответа', 'error');
        return;
    }
    
    var commentData = {
        authorId: currentUser.uid,
        authorName: currentUserData.username || 'Пользователь',
        authorAvatar: currentUserData.avatar || '',
        text: text,
        parentId: parentId,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        likesCount: 0
    };
    
    database.ref('sliceComments/' + sliceId).push(commentData).then(function() {
        textarea.value = '';
        database.ref('slices/' + sliceId + '/commentsCount').transaction(function(c) { return (c || 0) + 1; });
        
        // Открываем контейнер с ответами
        openRepliesState[parentId] = true;
        
        // Перезагружаем комментарии
        loadComments(sliceId);
        showNotification('Ответ добавлен', 'success');
    });
}

// Функция для отмены ответа
function cancelReplyForm(parentId) {
    var form = document.querySelector(`#replies-container-${parentId} .reply-form`);
    if (form) form.remove();
}
function renderCommentThread(comment, commentsByParent, sliceId, level) {
    if (!level) level = 0;
    var marginLeft = level * 36;
    var hasReplies = commentsByParent[comment.id] && commentsByParent[comment.id].length > 0;
    var isOpen = openRepliesState[comment.id] === true;
    
    var avatarStyle = comment.authorAvatar ? 'background-image:url('+comment.authorAvatar+');background-size:cover;' : '';
    var avatarClass = (!comment.authorAvatar) ? 'default-avatar-user' : '';
    
    var repliesHtml = '';
    if (hasReplies && isOpen) {
        repliesHtml = '<div id="replies-container-' + comment.id + '" class="replies-container" style="display:block;">';
        var replies = commentsByParent[comment.id];
        for (var i = 0; i < replies.length; i++) {
            repliesHtml += renderCommentThread(replies[i], commentsByParent, sliceId, level + 1);
        }
        repliesHtml += '</div>';
    } else if (hasReplies && !isOpen) {
        repliesHtml = '<div id="replies-container-' + comment.id + '" class="replies-container" style="display:none;"></div>';
    } else {
        repliesHtml = '<div id="replies-container-' + comment.id + '" class="replies-container" style="display:none;"></div>';
    }
    
    var replyButtonHtml = '';
    if (hasReplies) {
        var toggleIcon = isOpen ? '▲' : '▼';
        var toggleText = isOpen ? 'Скрыть ответы' : 'Показать ответы';
        replyButtonHtml = `
            <button class="comment-toggle-replies-btn toggle-replies-btn" data-comment-id="${comment.id}" onclick="toggleReplies('${sliceId}', '${comment.id}')">
                ${toggleIcon} ${toggleText} (${commentsByParent[comment.id].length})
            </button>
        `;
    }
    
    return `
        <div class="comment-item" data-comment-id="${comment.id}" style="margin-left: ${marginLeft}px;">
            <div class="comment-header">
                <div class="comment-author-avatar ${avatarClass}" style="${avatarStyle}">${comment.authorAvatar ? '' : ''}</div>
                <div class="comment-author-info">
                    <span class="comment-author-name">${escapeHtml(comment.authorName)}</span>
                    <span class="comment-date">${formatSliceDate(comment.createdAt)}</span>
                </div>
                <button class="comment-like-btn" onclick="likeComment('${sliceId}', '${comment.id}')">
                    ${comment.userLiked ? '❤️' : '🤍'} <span class="comment-like-count">${comment.likesCount || 0}</span>
                </button>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            <div class="comment-actions">
                <button class="comment-reply-btn" onclick="showReplyForm('${sliceId}', '${comment.id}')">Ответить</button>
                ${replyButtonHtml}
            </div>
            ${repliesHtml}
        </div>
    `;
}

function toggleReplies(sliceId, commentId) {
    var repliesContainer = document.getElementById('replies-container-' + commentId);
    var toggleBtn = document.querySelector(`.toggle-replies-btn[data-comment-id="${commentId}"]`);
    
    if (!repliesContainer) return;
    
    if (repliesContainer.style.display === 'none') {
        repliesContainer.style.display = 'block';
        if (toggleBtn) {
            var countMatch = toggleBtn.innerHTML.match(/\((\d+)\)/);
            var count = countMatch ? countMatch[1] : '';
            toggleBtn.innerHTML = '▲ Скрыть ответы (' + count + ')';
        }
        openRepliesState[commentId] = true;
    } else {
        repliesContainer.style.display = 'none';
        if (toggleBtn) {
            var countMatch = toggleBtn.innerHTML.match(/\((\d+)\)/);
            var count = countMatch ? countMatch[1] : '';
            toggleBtn.innerHTML = '▼ Показать ответы (' + count + ')';
        }
        openRepliesState[commentId] = false;
    }
}

function addComment(sliceId, parentId) {
    var textarea = document.getElementById('comment-text-' + sliceId);
    var text = textarea ? textarea.value.trim() : '';
    
    if (!text) {
        showNotification('Введите текст комментария', 'error');
        return;
    }
    
    var commentData = {
        authorId: currentUser.uid,
        authorName: currentUserData.username || 'Пользователь',
        authorAvatar: currentUserData.avatar || '',
        text: text,
        parentId: parentId || null,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        likesCount: 0
    };
    
    database.ref('sliceComments/' + sliceId).push(commentData).then(function() {
        textarea.value = '';
        database.ref('slices/' + sliceId + '/commentsCount').transaction(function(c) { return (c || 0) + 1; });
        loadComments(sliceId);
        showNotification('Комментарий добавлен', 'success');
    });
}
function showReplyForm(sliceId, parentId) {
    var container = document.getElementById('replies-container-' + parentId);
    if (!container) return;
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        openRepliesState[parentId] = true;
        
        var toggleBtn = document.querySelector(`.toggle-replies-btn[data-comment-id="${parentId}"]`);
        if (toggleBtn) {
            toggleBtn.innerHTML = '▲ Скрыть ответы';
        }
    }
    
    var existingForm = container.querySelector('.reply-form');
    if (existingForm) existingForm.remove();
    
    var formHtml = `
        <div class="reply-form">
            <textarea id="reply-text-${parentId}" placeholder="Написать ответ..." rows="2"></textarea>
            <div style="display: flex; gap: 8px; margin-top: 5px;">
                <button onclick="addComment('${sliceId}', '${parentId}')">Ответить</button>
                <button onclick="cancelReply('${parentId}')" class="cancel-reply-btn">Отмена</button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', formHtml);
    document.getElementById('reply-text-' + parentId).focus();
}

function cancelReply(parentId) {
    var form = document.querySelector(`#replies-container-${parentId} .reply-form`);
    if (form) form.remove();
}

function likeComment(sliceId, commentId) {
    var likeRef = database.ref('commentLikes/' + commentId + '/' + currentUser.uid);
    var commentRef = database.ref('sliceComments/' + sliceId + '/' + commentId);
    var commentElement = document.querySelector('.comment-item[data-comment-id="' + commentId + '"]');
    var likeBtn = commentElement ? commentElement.querySelector('.comment-like-btn') : null;
    
    likeRef.once('value').then(function(snap) {
        var isLiked = snap.exists();
        
        if (isLiked) {
            likeRef.remove();
            commentRef.child('likesCount').transaction(function(c) { return Math.max((c || 1) - 1, 0); });
            if (likeBtn) {
                var countSpan = likeBtn.querySelector('.comment-like-count');
                var newCount = Math.max((parseInt(countSpan.textContent) || 1) - 1, 0);
                countSpan.textContent = newCount;
                likeBtn.innerHTML = '🤍 <span class="comment-like-count">' + newCount + '</span>';
            }
        } else {
            likeRef.set(true);
            commentRef.child('likesCount').transaction(function(c) { return (c || 0) + 1; });
            if (likeBtn) {
                var countSpan = likeBtn.querySelector('.comment-like-count');
                var newCount = (parseInt(countSpan.textContent) || 0) + 1;
                countSpan.textContent = newCount;
                likeBtn.innerHTML = '❤️ <span class="comment-like-count">' + newCount + '</span>';
            }
        }
    });
}
// ========== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (ИСПРАВЛЕННЫЙ) ==========
function openUserProfileFull(userId) {
    window.viewingProfileUserId = userId;
    
    var oldModal = document.getElementById('user-profile-modal');
    if (oldModal) oldModal.remove();
    
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    var canEdit = isOwnProfile || isAdmin;
    
    database.ref('users/' + userId).once('value').then(function(userSnap) {
        var userData = userSnap.val();
        if (!userData) return;
        
        var userName = userData.username || 'Пользователь';
        var userTag = userData.userTag || '@' + userName.toLowerCase().replace(/\s/g, '');
        var userAvatar = userData.avatar || '';
        var userBio = userData.bio || 'Нет описания';
        var userVerified = userData.verified === true;
        var userBanner = userData.banner || null;
        var userStatus = userData.status || {};
        var isOnline = userStatus.online === true;
        var lastSeen = userStatus.lastSeen;
        
        window.viewingProfileUserName = userName;
        window.viewingProfileUserAvatar = userAvatar;
        window.viewingProfileUserData = userData;
        
        database.ref('subscriptions/').orderByChild(userId).equalTo(true).once('value').then(function(subsSnap) {
            var subscribersCount = subsSnap.val() ? Object.keys(subsSnap.val()).length : 0;
            
            // Стиль баннера
            var bannerStyle = '';
            if (userBanner && userBanner !== '') {
                if (userBanner.startsWith('#')) {
                    bannerStyle = 'background: ' + userBanner + '; background-image: none;';
                } else {
                    bannerStyle = 'background-image: url(' + userBanner + '); background-size: cover; background-position: center; background-repeat: no-repeat;';
                }
            } else {
                bannerStyle = 'background: linear-gradient(135deg, #228B22, #556B2F); background-image: none;';
            }
            
            var statusText = isOnline ? '<span style="color: #32CD32;">● В сети</span>' : (lastSeen ? 'Был(а) ' + formatLastSeen(lastSeen) : 'Неизвестно');
            
            var modal = document.createElement('div');
            modal.id = 'user-profile-modal';
            modal.className = 'modal';
            modal.style.zIndex = '10001';
            modal.innerHTML = `
                <div class="profile-modal-content">
                    <div class="profile-banner" id="profile-banner" style="${bannerStyle}">
                        ${canEdit ? '<button class="profile-banner-edit-btn" onclick="window.editProfileBanner()">✏️</button>' : ''}
                        <button class="profile-close-btn" onclick="closeProfileModal()">×</button>
                    </div>
                    <div class="profile-scrollable">
                        <div class="profile-avatar-wrapper">
                            <div class="profile-avatar default-avatar-user" id="profile-avatar">
                                ${canEdit ? '<button class="profile-avatar-edit-btn" onclick="editProfileAvatar()">✏️</button>' : ''}
                            </div>
                        </div>
                        <div class="profile-info">
                            <div class="profile-name-row">
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <h2 class="profile-name" id="profile-name" ${canEdit ? 'ondblclick="editProfileName()" style="cursor:pointer;"' : ''}>${escapeHtml(userName)}</h2>
                                    ${userVerified ? '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:18px; height:18px; cursor:pointer;" onclick="showVerifiedInfo()">' : ''}
                                    ${isAdmin ? '<button onclick="toggleUserVerification(\''+userId+'\')" style="background:none; border:none; cursor:pointer; font-size:12px;">🔘 ' + (userVerified ? 'Снять галочку' : 'Выдать галочку') + '</button>' : ''}
                                </div>
                                ${isOwnProfile ? '' : `
                                    <div style="display: flex; gap: 8px; justify-content: center; margin: 10px 0;">
                                        <button class="profile-subscribe-btn" id="profile-subscribe-btn" onclick="toggleSubscription()">Подписаться</button>
                                        <button class="profile-notify-btn" id="profile-notify-btn" onclick="toggleNotifications()">🔔</button>
                                        <button class="profile-chat-btn" onclick="startPrivateChatFromProfile('${userId}')">💬 Написать</button>
                                    </div>
                                `}
                            </div>
                            <div class="profile-username" ${canEdit ? 'ondblclick="editProfileUserTag()" style="cursor:pointer;"' : ''}>${escapeHtml(userTag)}</div>
                            <div class="profile-subscribers">👥 ${subscribersCount} подписчиков</div>
                            <div class="profile-status">${statusText}</div>
                            <div class="profile-bio" id="profile-bio" ${canEdit ? 'ondblclick="editProfileBio()" style="cursor:pointer;"' : ''}>${escapeHtml(userBio)}</div>
                        </div>
                        <div class="profile-tabs">
                            <button class="profile-tab-btn active" onclick="switchProfileTab('posts', '${userId}')">📷 Посты</button>
                            <button class="profile-tab-btn" onclick="switchProfileTab('reposts', '${userId}')">🔄 Репосты</button>
                        </div>
                        <div id="profile-content" class="profile-content">
                            <div class="profile-loading">Загрузка...</div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.classList.remove('hidden');
            
            // Устанавливаем аватарку
            setTimeout(function() {
                var avatarDiv = document.getElementById('profile-avatar');
                if (avatarDiv) {
                    if (userAvatar && userAvatar !== '') {
                        avatarDiv.style.backgroundImage = 'url(' + userAvatar + '?t=' + Date.now() + ')';
                        avatarDiv.style.backgroundSize = 'cover';
                        avatarDiv.style.backgroundPosition = 'center';
                        avatarDiv.style.backgroundRepeat = 'no-repeat';
                        avatarDiv.textContent = '';
                        avatarDiv.classList.remove('default-avatar-user');
                    } else {
                        avatarDiv.classList.add('default-avatar-user');
                        avatarDiv.textContent = '';
                    }
                }
            }, 100);
            
            if (!isOwnProfile) {
                checkSubscriptionStatus(userId);
                checkNotificationStatus(userId);
            }
            
            switchProfileTab('posts', userId);
        });
    });
}
function checkSubscriptionStatus(userId) {
    database.ref('subscriptions/' + currentUser.uid + '/' + userId).once('value').then(function(snap) {
        var isSubscribed = snap.exists();
        var btn = document.getElementById('profile-subscribe-btn');
        if (btn) {
            btn.textContent = isSubscribed ? 'Отписаться' : 'Подписаться';
            btn.style.background = isSubscribed ? '#555' : '#1a1a1a';
        }
    });
}

function checkNotificationStatus(userId) {
    database.ref('subscriptionNotifications/' + currentUser.uid + '/' + userId).once('value').then(function(snap) {
        var notifBtn = document.getElementById('profile-notify-btn');
        if (notifBtn) {
            notifBtn.style.opacity = snap.val() === true ? '1' : '0.5';
            notifBtn.setAttribute('data-enabled', snap.val() === true ? 'true' : 'false');
        }
    });
}

function toggleSubscription() {
    var userId = window.viewingProfileUserId;
    if (!userId || userId === currentUser.uid) return;
    
    var subRef = database.ref('subscriptions/' + currentUser.uid + '/' + userId);
    subRef.once('value').then(function(snap) {
        if (snap.exists()) {
            subRef.remove();
            showNotification('Вы отписались', 'info');
        } else {
            subRef.set(true);
            showNotification('Вы подписались', 'success');
        }
        checkSubscriptionStatus(userId);
        database.ref('subscriptions/').orderByChild(userId).equalTo(true).once('value').then(function(subsSnap) {
            var count = subsSnap.val() ? Object.keys(subsSnap.val()).length : 0;
            var subsDiv = document.querySelector('.profile-subscribers');
            if (subsDiv) subsDiv.textContent = '👥 ' + count + ' подписчиков';
        });
    });
}

function toggleNotifications() {
    var userId = window.viewingProfileUserId;
    if (!userId || userId === currentUser.uid) return;
    
    var notifRef = database.ref('subscriptionNotifications/' + currentUser.uid + '/' + userId);
    notifRef.once('value').then(function(snap) {
        var currentState = snap.val() === true;
        if (currentState) {
            notifRef.remove();
            showNotification('Уведомления выключены', 'info');
        } else {
            notifRef.set(true);
            showNotification('Уведомления включены', 'success');
        }
        var notifBtn = document.getElementById('profile-notify-btn');
        if (notifBtn) notifBtn.style.opacity = !currentState ? '1' : '0.5';
    });
}

function switchProfileTab(tab, userId) {
    var content = document.getElementById('profile-content');
    if (!content) return;
    
    var btns = document.querySelectorAll('.profile-tab-btn');
    btns.forEach(function(btn) { btn.classList.remove('active'); });
    if (tab === 'posts') {
        if (btns[0]) btns[0].classList.add('active');
    } else {
        if (btns[1]) btns[1].classList.add('active');
    }
    
    content.innerHTML = '<div class="profile-loading">Загрузка...</div>';
    
    var query = database.ref('slices').orderByChild('authorId').equalTo(userId);
    query.once('value').then(function(snapshot) {
        var slices = snapshot.val();
        content.innerHTML = '';
        
        if (!slices) {
            content.innerHTML = '<div class="profile-empty">Нет постов</div>';
            return;
        }
        
        var slicesArray = [];
        for (var id in slices) {
            var slice = slices[id];
            if (tab === 'reposts' && slice.type !== 'repost') continue;
            if (tab === 'posts' && slice.type === 'repost') continue;
            slicesArray.push({ id: id, data: slice });
        }
        
        slicesArray.sort(function(a, b) { return (b.data.createdAt || 0) - (a.data.createdAt || 0); });
        
        slicesArray.forEach(function(slice) {
            var card = createProfileSliceCard(slice.id, slice.data);
            content.appendChild(card);
        });
    });
}

function createProfileSliceCard(sliceId, sliceData) {
    var div = document.createElement('div');
    div.className = 'slice-card profile-slice-card';
    div.setAttribute('data-slice-id', sliceId);
    
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var avatarClass = (!sliceData.authorAvatar) ? 'default-avatar-user' : '';
    var avatarContent = '';
    
    var mediaHtml = '';
    if (sliceData.mediaUrl) {
        mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrl+'" class="slice-image" onclick="openSliceLightbox(\''+sliceData.mediaUrl+'\')"></div>';
    } else if (sliceData.mediaUrls && sliceData.mediaUrls.length) {
        mediaHtml = '<div class="slice-media"><img src="'+sliceData.mediaUrls[0]+'" class="slice-image" onclick="openSliceLightbox(\''+sliceData.mediaUrls[0]+'\')"></div>';
    }
    
    var textHtml = sliceData.text ? '<div class="slice-text">'+formatSliceText(sliceData.text)+'</div>' : '';
    var repostBadge = sliceData.type === 'repost' ? '<div class="repost-badge">🔄 Репостнуто с @' + escapeHtml(sliceData.originalAuthorName) + '</div>' : '';
    
    div.innerHTML = `
        <div class="slice-header">
            <div class="slice-author">
                <div class="avatar ${avatarClass}" style="${avatarStyle}">${avatarContent}</div>
                <div class="slice-author-info">
                    <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                    <span class="slice-date">${formatSliceDate(sliceData.createdAt)}</span>
                </div>
            </div>
        </div>
        ${repostBadge}
        ${mediaHtml}
        ${textHtml}
        <div class="slice-actions">
            <button class="slice-action-btn" onclick="likeSlice('${sliceId}')">❤️ <span>${sliceData.likesCount || 0}</span></button>
            <button class="slice-action-btn" onclick="toggleComments('${sliceId}')">💬 <span>${sliceData.commentsCount || 0}</span></button>
            <button class="slice-action-btn" onclick="repostSlice('${sliceId}')">🔄 <span>${sliceData.repostsCount || 0}</span></button>
        </div>
    `;
    
    return div;
}

function closeProfileModal() {
    var modal = document.getElementById('user-profile-modal');
    if (modal) modal.remove();
    window.closeColorPickerModal();
}

function editProfileAvatar() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка аватара...', 'info');
        
        if (typeof uploadToImgBB === 'function') {
            uploadToImgBB(file).then(function(data) {
                var avatarUrl = data.url;
                database.ref('users/' + userId + '/avatar').set(avatarUrl).then(function() {
                    showNotification('Аватар обновлён', 'success');
                    var avatarDiv = document.getElementById('profile-avatar');
                    if (avatarDiv) {
                        avatarDiv.style.backgroundImage = 'url(' + avatarUrl + ')';
                        avatarDiv.style.backgroundSize = 'cover';
                        avatarDiv.textContent = '';
                    }
                    if (userId === currentUser.uid && typeof updateUserDisplay === 'function') {
                        updateUserDisplay();
                    }
                    setTimeout(function() {
                        openUserProfileFull(userId);
                    }, 500);
                }).catch(function(err) {
                    showNotification('Ошибка обновления аватара: ' + err.message, 'error');
                });
            }).catch(function(err) {
                showNotification('Ошибка загрузки: ' + err.message, 'error');
            });
        } else {
            showNotification('Функция загрузки не найдена, проверьте upload.js', 'error');
        }
    };
    input.click();
}

function editProfileName() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var newName = prompt('Введите новое имя:', window.viewingProfileUserName);
    if (newName && newName.trim()) {
        database.ref('users/' + userId + '/username').set(newName.trim()).then(function() {
            showNotification('Имя обновлено', 'success');
            if (window.viewingProfileUserId === currentUser.uid && typeof updateUserDisplay === 'function') {
                updateUserDisplay();
            }
            openUserProfileFull(userId);
        });
    }
}

function editProfileBio() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var currentBio = document.getElementById('profile-bio')?.textContent || '';
    var newBio = prompt('Введите новое описание:', currentBio === 'Нет описания' ? '' : currentBio);
    if (newBio !== null) {
        database.ref('users/' + userId + '/bio').set(newBio.trim()).then(function() {
            showNotification('Описание обновлено', 'success');
            openUserProfileFull(userId);
        });
    }
}

function editProfileUserTag() {
    var userId = window.viewingProfileUserId;
    var isOwnProfile = (userId === currentUser.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) return;
    
    var currentTag = window.viewingProfileUserData?.userTag || '';
    var newTag = prompt('Введите новый юзернейм (только латиница, цифры и _):', currentTag.replace('@', ''));
    if (!newTag) return;
    
    var tagPattern = /^[a-zA-Z0-9_]+$/;
    if (!tagPattern.test(newTag)) {
        showNotification('Юзернейм может содержать только латиницу, цифры и _', 'error');
        return;
    }
    
    var formattedTag = '@' + newTag.toLowerCase();
    
    database.ref('userTags/' + formattedTag).once('value').then(function(snap) {
        if (snap.exists() && snap.val() !== userId) {
            showNotification('Юзернейм ' + formattedTag + ' уже занят', 'error');
            return;
        }
        
        var oldTag = window.viewingProfileUserData?.userTag;
        var updates = { userTag: formattedTag };
        
        database.ref('users/' + userId).update(updates).then(function() {
            if (oldTag && oldTag !== formattedTag) {
                database.ref('userTags/' + oldTag).remove();
            }
            database.ref('userTags/' + formattedTag).set(userId);
            
            showNotification('Юзернейм обновлён!', 'success');
            
            var usernameDiv = document.querySelector('.profile-username');
            if (usernameDiv) usernameDiv.textContent = formattedTag;
            
            if (window.viewingProfileUserData) {
                window.viewingProfileUserData.userTag = formattedTag;
            }
            
            if (userId === currentUser.uid && typeof updateUserDisplay === 'function') {
                updateUserDisplay();
            }
            
            setTimeout(function() {
                openUserProfileFull(userId);
            }, 500);
        }).catch(function(err) {
            showNotification('Ошибка: ' + err.message, 'error');
        });
    });
}

function toggleUserVerification(userId) {
    if (!window.isSuperAdmin) return;
    
    database.ref('users/' + userId + '/verified').once('value').then(function(snap) {
        var isVerified = snap.val() === true;
        database.ref('users/' + userId + '/verified').set(!isVerified).then(function() {
            showNotification(isVerified ? 'Галочка снята' : 'Галочка выдана', 'success');
            if (userId === currentUser.uid && currentUserData) {
                currentUserData.verified = !isVerified;
            }
            openUserProfileFull(userId);
        });
    });
}

function showVerifiedInfo() {
    alert('Этот пользователь имеет подтверждённый, верифицированный аккаунт, подтверждённый администрацией Kukumber 🌟');
}

function startPrivateChatFromProfile(userId) {
    if (!currentUser || !currentUser.uid) {
        showNotification('Авторизуйтесь', 'error');
        return;
    }
    
    closeProfileModal();
    
    if (typeof switchToTab === 'function') {
        switchToTab('chats');
    }
    
    var chatId = currentUser.uid < userId ? 
        currentUser.uid + '_' + userId : 
        userId + '_' + currentUser.uid;
    
    database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
        if (!chatSnap.exists()) {
            database.ref('chats/' + chatId).set({
                type: 'private',
                participants: [currentUser.uid, userId],
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastMessage: 'Чат создан',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            }).then(function() {
                return Promise.all([
                    database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true),
                    database.ref('userChats/' + userId + '/' + chatId).set(true)
                ]);
            }).then(function() {
                showNotification('Чат создан!', 'success');
                setTimeout(function() {
                    database.ref('chats/' + chatId).once('value').then(function(newSnap) {
                        if (typeof openChatById === 'function') {
                            openChatById(chatId);
                        } else if (typeof openChatWithData === 'function') {
                            openChatWithData(chatId, newSnap.val());
                        }
                    });
                }, 500);
            });
        } else {
            showNotification('Открываем чат...', 'info');
            setTimeout(function() {
                if (typeof openChatById === 'function') {
                    openChatById(chatId);
                } else if (typeof openChatWithData === 'function') {
                    database.ref('chats/' + chatId).once('value').then(function(newSnap) {
                        openChatWithData(chatId, newSnap.val());
                    });
                }
            }, 300);
        }
    }).catch(function(err) {
        console.error('Ошибка создания чата:', err);
        showNotification('Ошибка создания чата', 'error');
    });
}

// ========== СЛАЙДЕР ==========
function initSliceSlider(sliceId, totalSlides) {
    var container = document.getElementById('slice-media-' + sliceId);
    if (!container) return;
    
    var slider = container.querySelector('.slice-media-slider');
    var dotsContainer = document.getElementById('slice-dots-' + sliceId);
    
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        for (var i = 0; i < totalSlides; i++) {
            var dot = document.createElement('span');
            dot.className = 'slice-dot' + (i === 0 ? ' active' : '');
            dot.onclick = (function(idx) { return function() { goToSlide(sliceId, idx); }; })(i);
            dotsContainer.appendChild(dot);
        }
    }
    
    window['sliceCurrentIndex_' + sliceId] = 0;
    window['sliceTotal_' + sliceId] = totalSlides;
}

function slideSlice(sliceId, direction) {
    var current = window['sliceCurrentIndex_' + sliceId] || 0;
    var total = window['sliceTotal_' + sliceId] || 1;
    var newIndex = current + direction;
    if (newIndex < 0) newIndex = total - 1;
    if (newIndex >= total) newIndex = 0;
    goToSlide(sliceId, newIndex);
}

function goToSlide(sliceId, index) {
    var container = document.getElementById('slice-media-' + sliceId);
    if (!container) return;
    
    var slider = container.querySelector('.slice-media-slider');
    var slides = slider.querySelectorAll('.slice-slide');
    var dots = document.querySelectorAll('#slice-dots-' + sliceId + ' .slice-dot');
    if (!slides.length) return;
    
    var slideWidth = slides[0].offsetWidth;
    slider.style.transform = 'translateX(-' + (index * slideWidth) + 'px)';
    dots.forEach(function(dot, i) { dot.classList.toggle('active', i === index); });
    window['sliceCurrentIndex_' + sliceId] = index;
}

// ========== ФОРМАТИРОВАНИЕ ==========
function formatSliceText(text) {
    if (!text) return '';
    text = escapeHtml(text);
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #228B22; text-decoration: none;">$1</a>');
    text = text.replace(/@(\w+)/g, '<span class="slice-mention" onclick="searchByUser(\'$1\')">@$1</span>');
    return text;
}

function formatSliceDate(timestamp) {
    if (!timestamp) return '';
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff/60) + ' мин назад';
    if (diff < 86400) return 'сегодня в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    if (diff < 172800) return 'вчера в ' + date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    return date.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit', year:'2-digit'});
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

// ========== ПОИСК ==========
function searchByHashtag(tag) {
    var input = document.getElementById('slices-search-input');
    if (input) input.value = '#' + tag;
    performSearch();
}

function searchByUser(username) {
    var input = document.getElementById('slices-search-input');
    if (input) input.value = '@' + username;
    performSearch();
}

function performSearch() {
    var query = document.getElementById('slices-search-input').value.trim().toLowerCase();
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
        var feed = document.getElementById('slices-feed');
        if (!feed) return;
        if (!query) { loadSlices(); return; }
        
        feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Поиск...</p></div>';
        
        database.ref('slices').orderByChild('createdAt').limitToLast(100).once('value').then(function(snapshot) {
            var slices = snapshot.val();
            var results = [];
            for (var id in slices) {
                var slice = slices[id];
                var match = false;
                if (slice.text && slice.text.toLowerCase().includes(query)) match = true;
                if (slice.hashtags && slice.hashtags.some(function(tag) { return '#' + tag.toLowerCase().includes(query) || tag.toLowerCase().includes(query.replace('#', '')); })) match = true;
                if (slice.authorName && slice.authorName.toLowerCase().includes(query.replace('@', ''))) match = true;
                if (match) results.push({ id: id, data: slice });
            }
            
            feed.innerHTML = '';
            if (results.length === 0) { feed.innerHTML = '<div class="empty-slices"><span>🔍</span><p>Ничего не найдено</p></div>'; return; }
            results.sort(function(a, b) { return (b.data.createdAt || 0) - (a.data.createdAt || 0); });
            results.forEach(function(result) {
                var likeRef = database.ref('sliceLikes/' + result.id + '/' + currentUser.uid);
                likeRef.once('value').then(function(snap) {
                    result.data.userLiked = snap.exists();
                    feed.appendChild(createSliceCard(result.id, result.data));
                });
            });
        });
    }, 500);
}

function searchSlices() {
    performSearch();
}

// ========== ОБЩИЕ ФУНКЦИИ ==========
function shareSlice(sliceId) {
    var url = window.location.href + '?slice=' + sliceId;
    if (navigator.share) {
        navigator.share({ title: 'Слайс', text: 'Посмотри пост!', url: url });
    } else {
        navigator.clipboard.writeText(url);
        showNotification('Ссылка скопирована!', 'success');
    }
}

function openSliceLightbox(url) {
    var lightbox = document.getElementById('image-lightbox');
    var lightboxImg = document.getElementById('lightbox-image');
    if (lightbox && lightboxImg) {
        lightboxImg.src = url;
        lightbox.classList.remove('hidden');
    }
}

function openSlicesProfile() {
    if (currentUser) {
        openUserProfileFull(currentUser.uid);
    }
}

// ========== КОНТЕКСТНОЕ МЕНЮ ==========
function showSliceContextMenu(event, sliceId, sliceData) {
    event.preventDefault();
    event.stopPropagation();
    
    var oldMenu = document.getElementById('slice-context-menu');
    if (oldMenu) oldMenu.remove();
    
    var isOwner = sliceData.authorId === currentUser.uid;
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwner && !isAdmin) return;
    
    var menu = document.createElement('div');
    menu.id = 'slice-context-menu';
    menu.style.cssText = 'position:fixed; z-index:10001; background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2); min-width:180px; overflow:hidden;';
    
    var menuHtml = '';
    if (isOwner || isAdmin) {
        menuHtml += '<div class="context-menu-item" onclick="editSlice(\''+sliceId+'\')">✏️ Редактировать пост</div>';
        menuHtml += '<div class="context-menu-item" onclick="deleteSlice(\''+sliceId+'\')">🗑️ Удалить пост</div>';
    }
    if (isAdmin && !isOwner) {
        menuHtml += '<div style="border-top:1px solid #eee; margin:5px 0;"></div>';
        if (!sliceData.pinned) menuHtml += '<div class="context-menu-item" onclick="pinSlice(\''+sliceId+'\')">📌 Закрепить в ленте</div>';
        else menuHtml += '<div class="context-menu-item" onclick="unpinSlice(\''+sliceId+'\')">📌 Открепить</div>';
        menuHtml += '<div class="context-menu-item" onclick="reportSlice(\''+sliceId+'\')">⚠️ Пожаловаться</div>';
    }
    
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    var x = event.clientX, y = event.clientY;
    if (event.touches) { x = event.touches[0].clientX; y = event.touches[0].clientY; }
    
    var menuRect = menu.getBoundingClientRect();
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    if (x + menuRect.width > windowWidth) x = windowWidth - menuRect.width - 10;
    if (y + menuRect.height > windowHeight) y = windowHeight - menuRect.height - 10;
    if (x < 10) x = 10; if (y < 10) y = 10;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    
    setTimeout(function() {
        document.addEventListener('click', function closeSliceMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeSliceMenu);
            }
        });
    }, 10);
}

function editSlice(sliceId) {
    database.ref('slices/' + sliceId).once('value').then(function(snapshot) {
        var slice = snapshot.val();
        if (!slice) { showNotification('Пост не найден', 'error'); return; }
        var newText = prompt('Редактировать текст поста:', slice.text || '');
        if (newText === null) return;
        var newHashtags = extractHashtags(newText);
        database.ref('slices/' + sliceId).update({ text: newText, hashtags: newHashtags, editedAt: firebase.database.ServerValue.TIMESTAMP, edited: true })
            .then(function() { showNotification('Пост отредактирован!', 'success'); loadSlices(); })
            .catch(function() { showNotification('Ошибка редактирования', 'error'); });
    });
    closeSliceContextMenu();
}

function deleteSlice(sliceId) {
    if (!confirm('Удалить этот пост? Действие необратимо.')) return;
    database.ref('slices/' + sliceId).remove().then(function() {
        database.ref('sliceLikes/' + sliceId).remove();
        database.ref('sliceComments/' + sliceId).remove();
        showNotification('Пост удалён', 'success');
        loadSlices();
    }).catch(function() { showNotification('Ошибка удаления', 'error'); });
    closeSliceContextMenu();
}

function pinSlice(sliceId) {
    database.ref('slices/' + sliceId).update({ pinned: true, pinnedAt: firebase.database.ServerValue.TIMESTAMP })
        .then(function() { showNotification('Пост закреплён!', 'success'); loadSlices(); });
    closeSliceContextMenu();
}

function unpinSlice(sliceId) {
    database.ref('slices/' + sliceId).update({ pinned: false, pinnedAt: null })
        .then(function() { showNotification('Пост откреплён', 'info'); loadSlices(); });
    closeSliceContextMenu();
}

function reportSlice(sliceId) {
    var reason = prompt('Укажите причину жалобы:');
    if (!reason) return;
    database.ref('reports/slices/' + sliceId).push({
        userId: currentUser.uid, userName: currentUserData?.username || 'Пользователь',
        reason: reason, timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(function() { showNotification('Жалоба отправлена администрации', 'success'); });
    closeSliceContextMenu();
}

function closeSliceContextMenu() { var menu = document.getElementById('slice-context-menu'); if (menu) menu.remove(); }

// ========== СОЗДАНИЕ ПОСТА С ПРОГРЕССОМ ЗАГРУЗКИ ==========

// Глобальный объект для отслеживания текущих загрузок
var activeUploads = {};

function showCreateSliceModal() {
    var modal = document.getElementById('create-slice-modal');
    if (modal) modal.classList.remove('hidden');
    pendingSliceFiles = [];
    var previewArea = document.getElementById('slice-preview-area');
    if (previewArea) previewArea.innerHTML = '';
    var textInput = document.getElementById('slice-text');
    if (textInput) textInput.value = '';
    var hashtagsInput = document.getElementById('slice-hashtags-input');
    if (hashtagsInput) hashtagsInput.value = '';
    var uploadArea = document.getElementById('slice-upload-area');
    if (uploadArea) uploadArea.style.display = '';
    var previewContainer = document.getElementById('slice-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');
    updateSlicePreviewCounter();
    
    loadUserChannelsForPublish();
}

// Функция для создания временного поста с прогрессом
function createTempSliceCard(sliceId, sliceData, fileIndex, totalFiles, currentFileProgress) {
    var div = document.createElement('div');
    div.className = 'slice-card temp-slice-card';
    div.setAttribute('data-slice-id', sliceId);
    div.setAttribute('data-uploading', 'true');
    
    var avatarStyle = sliceData.authorAvatar ? 'background-image:url('+sliceData.authorAvatar+');background-size:cover;' : '';
    var avatarClass = (!sliceData.authorAvatar) ? 'default-avatar-user' : '';
    
    var progressPercent = Math.round(currentFileProgress);
    
    // Для нескольких файлов показываем общий прогресс
    var overallProgress = Math.round(((fileIndex) / totalFiles) * 100);
    var displayProgress = totalFiles > 1 ? overallProgress : progressPercent;
    var displayText = totalFiles > 1 ? `Файл ${fileIndex + 1} из ${totalFiles}: ${progressPercent}%` : `Загрузка: ${progressPercent}%`;
    
    var mediaHtml = '';
    if (sliceData.mediaUrls && sliceData.mediaUrls.length > 0) {
        // Показываем уже загруженные изображения
        for (var i = 0; i <= fileIndex; i++) {
            if (sliceData.mediaUrls[i]) {
                mediaHtml += `<div class="slice-media uploaded-media"><img src="${sliceData.mediaUrls[i]}" class="slice-image" style="opacity:0.7;"></div>`;
            }
        }
    }
    
    // Если текущий файл еще не загружен, показываем прогресс
    if (currentFileProgress < 100) {
        mediaHtml = `
            <div class="slice-media uploading-media">
                <div class="upload-progress-container">
                    <svg class="progress-ring" width="80" height="80" viewBox="0 0 80 80">
                        <circle class="progress-ring-bg" cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>
                        <circle class="progress-ring-fill" cx="40" cy="40" r="35" fill="none" stroke="var(--forest)" stroke-width="4" 
                            stroke-dasharray="${2 * Math.PI * 35}" stroke-dashoffset="${2 * Math.PI * 35 * (1 - currentFileProgress / 100)}"
                            stroke-linecap="round" transform="rotate(-90 40 40)"/>
                    </svg>
                    <div class="progress-percent">${Math.round(currentFileProgress)}%</div>
                    <div class="progress-size">${formatFileSize(sliceData.currentFileSize || 0)}</div>
                </div>
                <button class="cancel-upload-btn" onclick="cancelSliceUpload('${sliceId}')">⏹️ Отмена</button>
            </div>
        `;
    }
    
    var textHtml = sliceData.text ? '<div class="slice-text">'+escapeHtml(sliceData.text)+'</div>' : '';
    
    div.innerHTML = `
        <div class="slice-header">
            <div class="slice-author" onclick="openUserProfile('${sliceData.authorId}')" style="cursor:pointer;">
                <div class="avatar ${avatarClass}" style="${avatarStyle}">${sliceData.authorAvatar ? '' : ''}</div>
                <div class="slice-author-info">
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span class="slice-author-name">${escapeHtml(sliceData.authorName)}</span>
                    </div>
                    <span class="slice-date">Только что</span>
                </div>
            </div>
            <div class="slice-views">
                <span class="slice-views-count">0</span>
            </div>
        </div>
        ${mediaHtml}
        ${textHtml}
        <div class="slice-actions" style="opacity:0.5;">
            <button class="slice-action-btn">❤️ 0</button>
            <button class="slice-action-btn">💬 0</button>
            <button class="slice-action-btn">🔄 0</button>
        </div>
    `;
    
    return div;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Отмена загрузки слайса
window.cancelSliceUpload = function(tempSliceId) {
    if (activeUploads[tempSliceId]) {
        if (activeUploads[tempSliceId].cancel) {
            activeUploads[tempSliceId].cancel();
        }
        delete activeUploads[tempSliceId];
    }
    
    // Удаляем временный пост из ленты
    var tempCard = document.querySelector(`.temp-slice-card[data-slice-id="${tempSliceId}"]`);
    if (tempCard) tempCard.remove();
    
    // Очищаем pending файлы
    pendingSliceFiles = [];
    
    showNotification('Загрузка отменена', 'info');
};

// Функция загрузки файла с прогрессом
function uploadFileWithProgress(file, onProgress) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        var formData = new FormData();
        formData.append('image', file);
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                var percent = (e.loaded / e.total) * 100;
                onProgress(percent, e.loaded, e.total);
            }
        });
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    if (response.success && response.data && response.data.url) {
                        resolve(response.data.url);
                    } else {
                        reject(new Error('Ошибка загрузки'));
                    }
                } catch(e) {
                    reject(e);
                }
            } else {
                reject(new Error('Ошибка HTTP: ' + xhr.status));
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('Ошибка сети'));
        };
        
        xhr.open('POST', `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`);
        xhr.send(formData);
        
        // Сохраняем функцию отмены
        if (activeUploads.cancelCurrent) return;
        activeUploads.cancelCurrent = function() {
            xhr.abort();
            reject(new Error('Отменено пользователем'));
        };
    });
}

// ОСНОВНАЯ ФУНКЦИЯ ПУБЛИКАЦИИ С ПРОГРЕССОМ (ИСПРАВЛЕННАЯ)
// ========== ПУБЛИКАЦИЯ СЛАЙСА (БЕЗ ДУБЛИРОВАНИЯ) ==========

// ========== ПУБЛИКАЦИЯ СЛАЙСА (БЕЗ ДУБЛИРОВАНИЯ) ==========

// Флаг, чтобы игнорировать свой же пост
var isPublishingNow = false;

async function publishSlice() {
    // Если уже идет публикация - выходим
    if (isPublishingNow) {
        showNotification('Публикация уже выполняется', 'info');
        return;
    }
    
    var text = document.getElementById('slice-text').value.trim();
    var hashtagsInput = document.getElementById('slice-hashtags-input').value.trim();
    var publishAs = document.getElementById('publish-as-select')?.value || 'self';
    
    console.log('📝 Публикация от лица:', publishAs);
    
    // Проверка: есть ли текст или файлы
    if (pendingSliceFiles.length === 0 && !text) { 
        showNotification('Добавьте текст или фото', 'error'); 
        return; 
    }
    
    // Обработка хештегов
    if (hashtagsInput) {
        var extraTags = hashtagsInput.split(/[ ,]+/).filter(function(t) { return t; });
        if (text) {
            text += ' ' + extraTags.map(function(t) { return '#' + t; }).join(' ');
        } else {
            text = extraTags.map(function(t) { return '#' + t; }).join(' ');
        }
    }
    
    var hashtags = extractHashtags(text);
    
    // ========== ОПРЕДЕЛЯЕМ АВТОРА ==========
    var authorId = currentUser.uid;
    var authorName = currentUserData?.username || 'Пользователь';
    var authorAvatar = currentUserData?.avatar || '';
    var authorType = 'user';
    var channelId = null;
    
    // Если выбран канал
    if (publishAs !== 'self') {
        try {
            var channelSnap = await database.ref('chats/' + publishAs).once('value');
            var channel = channelSnap.val();
            
            if (channel && channel.type === 'channel') {
                if (channel.admins && channel.admins[currentUser.uid]) {
                    authorId = publishAs;
                    authorName = channel.name || 'Канал';
                    authorAvatar = channel.avatar || '';
                    authorType = 'channel';
                    channelId = publishAs;
                    console.log('✅ Публикация от канала:', authorName);
                } else {
                    showNotification('Вы не администратор этого канала', 'error');
                    return;
                }
            } else {
                showNotification('Канал не найден', 'error');
                return;
            }
        } catch (err) {
            console.error('Ошибка получения канала:', err);
            showNotification('Ошибка при выборе канала', 'error');
            return;
        }
    }
    
    // Устанавливаем флаг, что начата публикация
    isPublishingNow = true;
    
    // Временно отключаем слушатель новых постов, чтобы не получить дубль
    if (slicesListener) {
        slicesListener.off();
    }
    
    // ========== ЗАГРУЗКА ФАЙЛОВ ==========
    var mediaUrls = [];
    var totalFiles = pendingSliceFiles.length;
    
    if (totalFiles > 0) {
        showNotification(`📤 Загрузка ${totalFiles} файл(ов)...`, 'info');
        
        for (var i = 0; i < totalFiles; i++) {
            var file = pendingSliceFiles[i];
            
            try {
                var url = await new Promise(function(resolve, reject) {
                    var xhr = new XMLHttpRequest();
                    var formData = new FormData();
                    formData.append('image', file);
                    
                    xhr.onload = function() {
                        if (xhr.status === 200) {
                            try {
                                var response = JSON.parse(xhr.responseText);
                                if (response.success && response.data && response.data.url) {
                                    resolve(response.data.url);
                                } else {
                                    reject(new Error('Ошибка загрузки'));
                                }
                            } catch(e) {
                                reject(e);
                            }
                        } else {
                            reject(new Error('HTTP ' + xhr.status));
                        }
                    };
                    
                    xhr.onerror = function() {
                        reject(new Error('Ошибка сети'));
                    };
                    
                    xhr.open('POST', `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`);
                    xhr.send(formData);
                });
                
                mediaUrls.push(url);
                
            } catch (err) {
                console.error('Ошибка загрузки файла:', err);
                showNotification(`Ошибка загрузки: ${file.name}`, 'error');
                isPublishingNow = false;
                // Восстанавливаем слушатель
                setupSlicesListener();
                return;
            }
        }
    }
    
    // ========== СОЗДАНИЕ ПОСТА ==========
    var mediaType = 'none';
    if (mediaUrls.length === 1) mediaType = 'single';
    else if (mediaUrls.length > 1) mediaType = 'multiple';
    
    var sliceData = {
        authorId: authorId,
        authorName: authorName,
        authorAvatar: authorAvatar,
        authorType: authorType,
        channelId: channelId,
        text: text || '',
        hashtags: hashtags,
        mediaType: mediaType,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
        mediaUrl: mediaUrls.length === 1 ? mediaUrls[0] : null,
        likesCount: 0,
        commentsCount: 0,
        repostsCount: 0,
        viewsCount: 0,
        pinned: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    
    console.log('📤 Отправка данных в Firebase:', sliceData);
    
    try {
        // Сохраняем в Firebase
        var newSliceRef = await database.ref('slices/').push(sliceData);
        var realSliceId = newSliceRef.key;
        
        // Добавляем ID в загруженные (чтобы не дублировать)
        if (typeof loadedSliceIds !== 'undefined') {
            loadedSliceIds.add(realSliceId);
        }
        
        // Добавляем пост в ленту ВРУЧНУЮ (без слушателя)
        var feed = document.getElementById('slices-feed');
        if (feed) {
            sliceData.userLiked = false;
            var newCard = createSliceCard(realSliceId, sliceData);
            
            // Удаляем сообщение "Нет постов" если есть
            var emptyDiv = feed.querySelector('.empty-slices');
            if (emptyDiv) emptyDiv.remove();
            
            // Вставляем в начало ленты
            if (feed.firstChild) {
                feed.insertBefore(newCard, feed.firstChild);
            } else {
                feed.appendChild(newCard);
            }
            
            // Прокручиваем к новому посту
            newCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        playSliceCreateSound();
        showNotification('✅ Пост опубликован!', 'success');
        
        // Очищаем форму
        closeCreateSliceModal();
        pendingSliceFiles = [];
        updateSlicePreview();
        
    } catch (err) {
        console.error('❌ Ошибка публикации:', err);
        showNotification('Ошибка публикации: ' + err.message, 'error');
    } finally {
        // Снимаем флаг
        isPublishingNow = false;
        // Восстанавливаем слушатель через небольшую задержку
        setTimeout(function() {
            setupSlicesListener();
        }, 1000);
    }
}

// Функция для настройки слушателя слайсов (вынесли в отдельную функцию)
function setupSlicesListener() {
    if (slicesListener) {
        slicesListener.off();
    }
    
    slicesListener = database.ref('slices').orderByChild('createdAt').limitToLast(100);
    slicesListener.on('child_added', function(snapshot) {
        var sliceId = snapshot.key;
        
        // Если идет публикация - пропускаем (свой пост)
        if (isPublishingNow) {
            console.log('Публикация в процессе, пропускаем:', sliceId);
            return;
        }
        
        // Если пост уже загружен - пропускаем
        if (typeof loadedSliceIds !== 'undefined' && loadedSliceIds.has(sliceId)) {
            console.log('Пост уже загружен, пропускаем:', sliceId);
            return;
        }
        
        var sliceData = snapshot.val();
        if (!sliceData) return;
        
        // Добавляем ID в загруженные
        if (typeof loadedSliceIds !== 'undefined') {
            loadedSliceIds.add(sliceId);
        }
        
        // Проверяем, не слишком ли старый пост (больше 3 секунд)
        var now = Date.now();
        var createdAt = sliceData.createdAt || 0;
        if (now - createdAt > 3000) {
            console.log('Старый пост, пропускаем:', sliceId);
            return;
        }
        
        // Добавляем новый пост в ленту
        database.ref('sliceLikes/' + sliceId + '/' + currentUser.uid).once('value').then(function(snap) {
            sliceData.userLiked = snap.exists();
            var card = createSliceCard(sliceId, sliceData);
            var feed = document.getElementById('slices-feed');
            if (feed) {
                // Проверяем, нет ли уже такого поста в ленте
                var existingCard = feed.querySelector(`.slice-card[data-slice-id="${sliceId}"]`);
                if (!existingCard) {
                    if (feed.firstChild) {
                        feed.insertBefore(card, feed.firstChild);
                    } else {
                        feed.appendChild(card);
                    }
                }
            }
        });
    });
}
// ========== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ МОДАЛЬНОГО ОКНА ==========

function closeCreateSliceModal() {
    var modal = document.getElementById('create-slice-modal');
    if (modal) modal.classList.add('hidden');
    pendingSliceFiles = [];
    var previewArea = document.getElementById('slice-preview-area');
    if (previewArea) previewArea.innerHTML = '';
    var textInput = document.getElementById('slice-text');
    if (textInput) textInput.value = '';
    var hashtagsInput = document.getElementById('slice-hashtags-input');
    if (hashtagsInput) hashtagsInput.value = '';
    var uploadArea = document.getElementById('slice-upload-area');
    if (uploadArea) uploadArea.style.display = '';
    var previewContainer = document.getElementById('slice-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');
}

function addSliceMedia() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.multiple = true;
    input.onchange = function(e) {
        var files = Array.from(e.target.files);
        files.forEach(function(file) {
            if (file.size > 15 * 1024 * 1024) { 
                showNotification('Файл слишком большой (макс. 15MB)', 'error'); 
                return; 
            }
            pendingSliceFiles.push(file);
        });
        updateSlicePreview();
    };
    input.click();
}

function updateSlicePreview() {
    var previewContainer = document.getElementById('slice-preview-container');
    var uploadArea = document.getElementById('slice-upload-area');
    var previewArea = document.getElementById('slice-preview-area');
    var counterSpan = document.getElementById('slice-preview-counter');
    
    if (!previewArea) return;
    
    if (pendingSliceFiles.length === 0) {
        if (uploadArea) uploadArea.style.display = '';
        if (previewContainer) previewContainer.classList.add('hidden');
        if (counterSpan) counterSpan.textContent = '0';
        return;
    }
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (counterSpan) counterSpan.textContent = pendingSliceFiles.length;
    
    previewArea.innerHTML = '';
    
    pendingSliceFiles.forEach(function(file, idx) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
            var div = document.createElement('div');
            div.className = 'slice-preview-item';
            div.setAttribute('data-index', idx);
            div.innerHTML = `
                <img src="${e.target.result}" class="slice-preview-img">
                <button class="slice-preview-remove" onclick="removeSliceMedia(${idx})">×</button>
                ${isGif ? '<span class="slice-preview-gif-badge">GIF</span>' : ''}
            `;
            previewArea.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeSliceMedia(index) { 
    pendingSliceFiles.splice(index, 1); 
    updateSlicePreview(); 
}

function updateSlicePreviewCounter() { 
    var counter = document.getElementById('slice-preview-counter'); 
    if (counter) counter.textContent = pendingSliceFiles.length; 
}

function loadUserChannelsForPublish() {
    var select = document.getElementById('publish-as-select');
    if (!select) return;
    
    select.innerHTML = '<option value="self">🥒 ' + (currentUserData?.username || 'Я') + '</option>';
    
    database.ref('userChats/' + currentUser.uid).once('value').then(function(snapshot) {
        var userChats = snapshot.val();
        if (!userChats) return;
        
        var processedCount = 0;
        var channelIds = Object.keys(userChats);
        
        if (channelIds.length === 0) return;
        
        channelIds.forEach(function(chatId) {
            database.ref('chats/' + chatId).once('value').then(function(chatSnap) {
                var chat = chatSnap.val();
                // Проверяем, что это канал И пользователь является админом
                if (chat && chat.type === 'channel' && chat.admins && chat.admins[currentUser.uid]) {
                    var option = document.createElement('option');
                    option.value = chatId;
                    option.textContent = '📢 ' + (chat.name || 'Канал');
                    select.appendChild(option);
                    console.log('✅ Добавлен канал для публикации:', chat.name);
                }
                processedCount++;
            }).catch(function(err) {
                console.error('Ошибка загрузки чата:', err);
                processedCount++;
            });
        });
    }).catch(function(err) {
        console.error('Ошибка загрузки userChats:', err);
    });
}
function extractHashtags(text) { 
    var hashtags = text.match(/#[а-яА-Яa-zA-Z0-9_]+/g); 
    if (!hashtags) return []; 
    return hashtags.map(function(tag) { return tag.substring(1); }); 
}
// ========== ФУНКЦИИ ДЛЯ БАННЕРА ПРОФИЛЯ ==========
window.setProfileBanner = async function(colorOrUrl) {
    var userId = window.viewingProfileUserId || currentUser?.uid;
    if (!userId) {
        console.error('Нет userId для установки баннера');
        return;
    }
    
    showNotification('Сохранение баннера...', 'info');
    
    try {
        var updateData = {};
        if (colorOrUrl && colorOrUrl !== '') {
            updateData.banner = colorOrUrl;
            console.log('Сохраняем баннер:', colorOrUrl);
        } else {
            updateData.banner = null;
            console.log('Сбрасываем баннер');
        }
        
        await database.ref('users/' + userId).update(updateData);
        
        showNotification('Баннер обновлён!', 'success');
        window.closeColorPickerModal();
        
        // Обновляем баннер в открытом профиле
        var bannerDiv = document.getElementById('profile-banner');
        if (bannerDiv) {
            if (colorOrUrl && colorOrUrl !== '') {
                if (colorOrUrl.startsWith('#')) {
                    bannerDiv.style.background = colorOrUrl;
                    bannerDiv.style.backgroundImage = 'none';
                } else {
                    bannerDiv.style.backgroundImage = 'url(' + colorOrUrl + '?t=' + Date.now() + ')';
                    bannerDiv.style.backgroundSize = 'cover';
                    bannerDiv.style.backgroundPosition = 'center';
                    bannerDiv.style.background = 'none';
                }
            } else {
                bannerDiv.style.background = 'linear-gradient(135deg, #228B22, #556B2F)';
                bannerDiv.style.backgroundImage = 'none';
            }
            console.log('Баннер обновлён в DOM');
        }
        
        // Обновляем данные в памяти
        if (window.viewingProfileUserData) {
            window.viewingProfileUserData.banner = colorOrUrl || null;
        }
        
        if (userId === currentUser?.uid && currentUserData) {
            currentUserData.banner = colorOrUrl || null;
        }
        
    } catch (err) {
        console.error('Ошибка сохранения баннера:', err);
        showNotification('Ошибка: ' + err.message, 'error');
    }
};

window.closeColorPickerModal = function() {
    var modal = document.getElementById('color-picker-modal');
    if (modal) modal.remove();
};

window.uploadProfileBannerImage = async function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        showNotification('Загрузка баннера...', 'info');
        
        try {
            var url = await uploadToImgBB(file);
            console.log('Загружен URL баннера:', url);
            await window.setProfileBanner(url);
        } catch (err) {
            console.error('Ошибка загрузки:', err);
            showNotification('Ошибка загрузки: ' + err.message, 'error');
        }
    };
    input.click();
};

window.editProfileBanner = function() {
    var userId = window.viewingProfileUserId || currentUser?.uid;
    if (!userId) return;
    
    var isOwnProfile = (userId === currentUser?.uid);
    var isAdmin = window.isSuperAdmin === true;
    
    if (!isOwnProfile && !isAdmin) {
        showNotification('Вы не можете редактировать чужой профиль', 'error');
        return;
    }
    
    var colors = ['#228B22', '#556B2F', '#1a5c1a', '#32CD32', '#6b8e6b', '#000000', '#1E90FF', '#FFD700', '#FFA500', '#FF69B4', '#87CEEB', '#9370DB'];
    
    var oldColorModal = document.getElementById('color-picker-modal');
    if (oldColorModal) oldColorModal.remove();
    
    var modal = document.createElement('div');
    modal.id = 'color-picker-modal';
    modal.className = 'modal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <div class="modal-header">
                <h3>Выберите баннер</h3>
                <button onclick="window.closeColorPickerModal()" class="btn-close">×</button>
            </div>
            <div class="banner-color-picker" style="display:flex; flex-wrap:wrap; gap:10px; padding:15px; justify-content:center;">
                ${colors.map(c => `<div class="banner-color-option" style="background:${c}; width:40px; height:40px; border-radius:50%; cursor:pointer; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.2);" onclick="window.setProfileBanner('${c}')"></div>`).join('')}
            </div>
            <div style="padding:10px; text-align:center;">
                <button onclick="window.uploadProfileBannerImage()" class="btn-primary" style="width: auto; padding: 8px 20px;">📷 Загрузить картинку/GIF</button>
            </div>
            <div style="padding:10px; text-align:center;">
                <button onclick="window.setProfileBanner('')" class="btn-secondary">Сбросить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
};

window.openChannelProfile = function(chatId) {
    console.log('openChannelProfile вызван для:', chatId);
};

window.openUserProfile = openUserProfileFull;

if (typeof initSliceSound === 'function') initSliceSound();

// Экспорт в глобальную область
window.closeCreateSliceModal = closeCreateSliceModal;
window.addSliceMedia = addSliceMedia;
window.removeSliceMedia = removeSliceMedia;
window.showCreateSliceModal = showCreateSliceModal;
window.publishSlice = publishSlice;
window.startPrivateChatFromProfile = startPrivateChatFromProfile;
window.editProfileUserTag = editProfileUserTag;
window.openUserProfileFull = openUserProfileFull;

console.log('✅ slices.js полностью загружен');
