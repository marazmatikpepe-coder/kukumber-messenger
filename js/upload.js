// UPLOAD - ImgBB с прогрессом загрузки
var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;
var currentUploadXHR = null;
var currentUploadChatId = null;

function uploadImageToImgBBWithProgress(file, onProgress, onCancel) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('Нет файла'));
            return;
        }
        if (!file.type.startsWith('image/')) {
            showNotification('Пожалуйста, выберите изображение', 'error');
            reject(new Error('Не изображение'));
            return;
        }
        if (file.size > 32 * 1024 * 1024) {
            showNotification('Файл слишком большой (макс. 32 МБ)', 'error');
            reject(new Error('Файл слишком большой'));
            return;
        }
        
        var formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);
        
        var xhr = new XMLHttpRequest();
        currentUploadXHR = xhr;
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable && onProgress) {
                var percent = (e.loaded / e.total) * 100;
                var loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
                var totalMB = (e.total / (1024 * 1024)).toFixed(1);
                onProgress(percent, loadedMB, totalMB);
            }
        });
        
        xhr.onload = function() {
            currentUploadXHR = null;
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        resolve({ url: data.data.url });
                    } else {
                        reject(new Error('Ошибка ImgBB'));
                    }
                } catch(e) {
                    reject(new Error('Ошибка ответа сервера'));
                }
            } else {
                reject(new Error('Ошибка загрузки: ' + xhr.status));
            }
        };
        
        xhr.onerror = function() {
            currentUploadXHR = null;
            reject(new Error('Ошибка сети'));
        };
        
        xhr.onabort = function() {
            currentUploadXHR = null;
            reject(new Error('Загрузка отменена'));
        };
        
        xhr.open('POST', 'https://api.imgbb.com/1/upload');
        xhr.send(formData);
    });
}

function cancelUpload() {
    if (currentUploadXHR) {
        currentUploadXHR.abort();
        currentUploadXHR = null;
        hideUploadProgressModal();
        showNotification('Загрузка отменена', 'info');
    }
}

function showUploadProgressModal(file, chatId) {
    currentUploadChatId = chatId;
    var modal = document.getElementById('upload-progress-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'upload-progress-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="upload-progress-container">
                <div class="upload-progress-header">
                    <h3>Отправка фото</h3>
                    <button onclick="cancelUpload()" class="upload-cancel-btn">×</button>
                </div>
                <div class="upload-progress-preview">
                    <img id="upload-progress-img" src="">
                </div>
                <div class="upload-progress-circle-container">
                    <svg class="upload-progress-circle" width="80" height="80" viewBox="0 0 80 80">
                        <circle class="progress-circle-bg" cx="40" cy="40" r="35" fill="none" stroke="#e0e0e0" stroke-width="4"/>
                        <circle class="progress-circle-fill" cx="40" cy="40" r="35" fill="none" stroke="#228B22" stroke-width="4" stroke-dasharray="219.9" stroke-dashoffset="219.9" stroke-linecap="round"/>
                    </svg>
                    <div class="upload-progress-percent">0%</div>
                </div>
                <div class="upload-progress-stats">
                    <span id="upload-progress-loaded">0</span> / <span id="upload-progress-total">0</span> МБ
                </div>
                <div class="upload-progress-bar-container">
                    <div class="upload-progress-bar" id="upload-progress-bar"></div>
                </div>
                <button onclick="cancelUpload()" class="upload-cancel-button">Отменить</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = document.getElementById('upload-progress-img');
        if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    var loadedSpan = document.getElementById('upload-progress-loaded');
    var totalSpan = document.getElementById('upload-progress-total');
    if (totalSpan) totalSpan.textContent = (file.size / (1024 * 1024)).toFixed(1);
    
    modal.classList.remove('hidden');
}

function hideUploadProgressModal() {
    var modal = document.getElementById('upload-progress-modal');
    if (modal) modal.classList.add('hidden');
    currentUploadChatId = null;
}

function updateUploadProgress(percent, loadedMB, totalMB) {
    var percentSpan = document.querySelector('.upload-progress-percent');
    if (percentSpan) percentSpan.textContent = Math.round(percent) + '%';
    
    var loadedSpan = document.getElementById('upload-progress-loaded');
    if (loadedSpan) loadedSpan.textContent = loadedMB;
    
    var bar = document.getElementById('upload-progress-bar');
    if (bar) bar.style.width = percent + '%';
    
    var circle = document.querySelector('.progress-circle-fill');
    if (circle) {
        var circumference = 219.9;
        var offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }
}

function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        return;
    }
    if (!currentChatId) {
        showNotification('Сначала выберите чат', 'error');
        return;
    }
    pendingImageFile = file;
    showUploadProgressModal(file, currentChatId);
    
    uploadImageToImgBBWithProgress(file, 
        function(percent, loadedMB, totalMB) {
            updateUploadProgress(percent, loadedMB, totalMB);
        },
        function() {
            hideUploadProgressModal();
        }
    ).then(function(data) {
        hideUploadProgressModal();
        var captionInput = document.getElementById('image-caption');
        var caption = captionInput ? captionInput.value.trim() : '';
        var message = {
            type: 'image',
            imageUrl: data.url,
            caption: caption,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        return database.ref('messages/' + currentChatId).push(message);
    }).then(function() {
        return database.ref('chats/' + currentChatId).update({
            lastMessage: '📷 Фото',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
    }).then(function() {
        showNotification('Фото отправлено!', 'success');
        var captionInput = document.getElementById('image-caption');
        if (captionInput) captionInput.value = '';
    }).catch(function(error) {
        if (error.message !== 'Загрузка отменена') {
            showNotification('Ошибка отправки фото: ' + error.message, 'error');
        }
        hideUploadProgressModal();
    });
    
    event.target.value = '';
}

function closeImagePreview() {
    var modal = document.getElementById('image-preview-modal');
    if (modal) modal.classList.add('hidden');
    pendingImageFile = null;
}

function confirmImageSend() {
    // Эта функция больше не нужна, так как отправка через прогресс
    closeImagePreview();
}

// Аватарки групп, каналов, профиля
function previewGroupAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        groupAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('group-avatar-preview');
            if (preview) {
                preview.style.backgroundImage = 'url(' + e.target.result + ')';
                preview.style.backgroundSize = 'cover';
                preview.textContent = '';
            }
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        channelAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('channel-avatar-preview');
            if (preview) {
                preview.style.backgroundImage = 'url(' + e.target.result + ')';
                preview.style.backgroundSize = 'cover';
                preview.textContent = '';
            }
        };
        reader.readAsDataURL(file);
    }
}

function previewEditAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('edit-avatar-preview');
            if (preview) {
                preview.style.backgroundImage = 'url(' + e.target.result + ')';
                preview.style.backgroundSize = 'cover';
                preview.textContent = '';
            }
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile = file;
    }
}
