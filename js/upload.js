// UPLOAD - ImgBB (только фото)
var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;

function uploadImageToImgBB(file) {
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
        showUploadProgress(true);
        var formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);
        fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            showUploadProgress(false);
            if (data.success) {
                resolve({ url: data.data.url });
            } else {
                showNotification('Ошибка загрузки на ImgBB', 'error');
                reject(new Error('Ошибка ImgBB'));
            }
        })
        .catch(error => {
            showUploadProgress(false);
            console.error(error);
            showNotification('Ошибка сети при загрузке', 'error');
            reject(error);
        });
    });
}

function showUploadProgress(show) {
    var div = document.getElementById('upload-progress');
    if (show && !div) {
        div = document.createElement('div');
        div.id = 'upload-progress';
        div.className = 'upload-progress';
        div.innerHTML = '<div class="upload-progress-content"><div class="spinner"></div><p>Загрузка...</p></div>';
        document.body.appendChild(div);
    } else if (!show && div) {
        div.remove();
    }
}

function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showNotification('Выберите изображение', 'error');
        return;
    }
    showImagePreview(file);
    event.target.value = ''; // очищаем, чтобы можно было выбрать тот же файл снова
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
        showNotification('Ошибка: нет файла или чата', 'error');
        return;
    }
    var caption = document.getElementById('image-caption').value.trim();
    var file = pendingImageFile;
    closeImagePreview();
    uploadImageToImgBB(file)
        .then(function(data) {
            var message = {
                type: 'image',
                imageUrl: data.url,
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
            console.error(error);
            showNotification('Ошибка отправки фото', 'error');
        });
    pendingImageFile = null;
}

// Остальные функции (аватарки групп, каналов, профиля) – они не влияют на отправку фото
function previewGroupAvatar(event) { /* ... */ }
function previewChannelAvatar(event) { /* ... */ }
function previewEditAvatar(event) { /* ... */ }
