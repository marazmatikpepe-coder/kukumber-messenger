// ========================================
// KUKUMBER MESSENGER - UPLOAD (ImgBB)
// ========================================

var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;

// ========================================
// ЗАГРУЗКА НА IMGBB
// ========================================

function uploadImageToImgBB(file) {
    return new Promise(function(resolve, reject) {
        if (!file) {
            reject(new Error('Нет файла'));
            return;
        }
        
        var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.indexOf(file.type) === -1) {
            showNotification('Поддерживаются только изображения', 'error');
            reject(new Error('Неверный тип файла'));
            return;
        }
        
        if (file.size > 32 * 1024 * 1024) {
            showNotification('Файл слишком большой (макс. 32 МБ)', 'error');
            reject(new Error('Файл слишком большой'));
            return;
        }
        
        showUploadProgress(true);
        
        var formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);
        
        fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            showUploadProgress(false);
            
            if (data.success) {
                resolve({
                    url: data.data.url,
                    thumbUrl: data.data.thumb ? data.data.thumb.url : data.data.url,
                    displayUrl: data.data.display_url
                });
            } else {
                showNotification('Ошибка загрузки изображения', 'error');
                reject(new Error('Ошибка загрузки'));
            }
        })
        .catch(function(error) {
            showUploadProgress(false);
            console.error('Ошибка upload:', error);
            showNotification('Ошибка загрузки изображения', 'error');
            reject(error);
        });
    });
}

// ========================================
// ИНДИКАТОР ЗАГРУЗКИ
// ========================================

function showUploadProgress(show) {
    var progressDiv = document.getElementById('upload-progress');
    
    if (show && !progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'upload-progress';
        progressDiv.className = 'upload-progress';
        progressDiv.innerHTML = '<div class="upload-progress-content"><div class="spinner"></div><p>Загрузка...</p></div>';
        document.body.appendChild(progressDiv);
    } else if (!show && progressDiv) {
        progressDiv.remove();
    }
}

// ========================================
// ОТПРАВКА ФОТО В ЧАТ
// ========================================

function handleFileSelect(event) {
    var file = event.target.files[0];
    if (file) {
        showImagePreview(file);
    }
    event.target.value = '';
}

function showImagePreview(file) {
    pendingImageFile = file;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('preview-image').src = e.target.result;
        document.getElementById('image-caption').value = '';
        document.getElementById('image-preview-modal').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function closeImagePreview() {
    document.getElementById('image-preview-modal').classList.add('hidden');
    pendingImageFile = null;
}

function confirmImageSend() {
    if (!pendingImageFile || !currentChatId) {
        showNotification('Ошибка отправки', 'error');
        return;
    }
    
    var caption = document.getElementById('image-caption').value.trim();
    var file = pendingImageFile;
    
    closeImagePreview();
    
    uploadImageToImgBB(file)
    .then(function(imageData) {
        var message = {
            type: 'image',
            imageUrl: imageData.url,
            thumbUrl: imageData.thumbUrl,
            caption: caption,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        return database.ref('messages/' + currentChatId).push(message);
    })
    .then(function() {
        return database.ref('chats/' + currentChatId).update({
            lastMessage: '📷 Фото',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    })
    .then(function() {
        showNotification('Фото отправлено!', 'success');
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка отправки фото', 'error');
    });
    
    pendingImageFile = null;
}

// ========================================
// ЗАГРУЗКА АВАТАРКИ ПОЛЬЗОВАТЕЛЯ
// ========================================

function handleAvatarChange(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    event.target.value = '';
    
    uploadImageToImgBB(file)
    .then(function(imageData) {
        return database.ref('users/' + currentUser.uid + '/avatar').set(imageData.url);
    })
    .then(function() {
        showNotification('Аватарка обновлена!', 'success');
        var avatarEl = document.getElementById('user-avatar');
        if (avatarEl && currentUserData) {
            avatarEl.style.backgroundImage = 'url(' + currentUserData.avatar + ')';
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.textContent = '';
        }
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки аватарки', 'error');
    });
}

// ========================================
// АВАТАРКА ГРУППЫ
// ========================================

function previewGroupAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        groupAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('group-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

// ========================================
// АВАТАРКА КАНАЛА
// ========================================

function previewChannelAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        channelAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('channel-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}
