// UPLOAD - ImgBB для фото + Catbox для остальных файлов
var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;

// === ЗАГРУЗКА НА CATBOX (для видео, аудио, документов) ===
async function uploadToCatbox(file) {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);
    
    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData
    });
    
    const url = await response.text();
    if (url.startsWith('https://')) {
        return url;
    } else {
        throw new Error('Ошибка загрузки на Catbox');
    }
}

// === ЗАГРУЗКА НА IMGBB (только фото) ===
function uploadImageToImgBB(file) {
    return new Promise((resolve, reject) => {
        if (!file) { reject(new Error('Нет файла')); return; }
        if (!file.type.startsWith('image/')) { reject(new Error('Не изображение')); return; }
        if (file.size > 32 * 1024 * 1024) { reject(new Error('Файл >32 МБ')); return; }
        
        showUploadProgress(true);
        var formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);
        
        fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                showUploadProgress(false);
                if (data.success) resolve({ url: data.data.url });
                else reject('Ошибка ImgBB');
            })
            .catch(error => {
                showUploadProgress(false);
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

// === ОБРАБОТКА ВЫБОРА ФАЙЛА (фото и другие файлы) ===
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    if (file.type.startsWith('image/')) {
        showImagePreview(file);
    } else {
        // Отправляем видео, аудио, документы напрямую через Catbox
        sendAnyFile(file);
    }
    event.target.value = '';
}

function sendAnyFile(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('Загрузка файла...', 'info');
    
    uploadToCatbox(file)
        .then(url => {
            var message = {
                type: 'file',
                fileName: file.name,
                fileUrl: url,
                fileSize: file.size,
                fileType: file.type,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('messages/' + currentChatId).push(message);
        })
        .then(() => {
            var lastMsg = '📎 ' + file.name;
            if (lastMsg.length > 50) lastMsg = lastMsg.substring(0, 47) + '...';
            return database.ref('chats/' + currentChatId).update({
                lastMessage: lastMsg,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => {
            showNotification('Файл отправлен!', 'success');
        })
        .catch(error => {
            console.error(error);
            showNotification('Ошибка загрузки файла', 'error');
        });
}

// === ФОТО (с предпросмотром) ===
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
        .then(data => {
            var message = {
                type: 'image',
                imageUrl: data.url,
                caption: caption,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('messages/' + currentChatId).push(message);
        })
        .then(() => {
            var lastMsg = caption ? '📷 ' + caption : '📷 Фото';
            if (lastMsg.length > 50) lastMsg = lastMsg.substring(0, 47) + '...';
            return database.ref('chats/' + currentChatId).update({
                lastMessage: lastMsg,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => {
            showNotification('Фото отправлено!', 'success');
        })
        .catch(err => {
            showNotification('Ошибка отправки фото', 'error');
            console.error(err);
        });
    pendingImageFile = null;
}

// === ГОЛОСОВЫЕ СООБЩЕНИЯ (через Catbox) ===
var mediaRecorder, audioChunks, isRecording = false;

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                var blob = new Blob(audioChunks, { type: 'audio/webm' });
                sendAudioMessage(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            var btn = document.getElementById('voice-record-btn');
            if (btn) btn.classList.add('recording');
        })
        .catch(err => showNotification('Нет доступа к микрофону', 'error'));
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        var btn = document.getElementById('voice-record-btn');
        if (btn) btn.classList.remove('recording');
    }
}

function sendAudioMessage(blob) {
    if (!currentChatId) return;
    var file = new File([blob], 'audio_' + Date.now() + '.webm', { type: 'audio/webm' });
    uploadToCatbox(file).then(url => {
        var message = {
            type: 'audio',
            audioUrl: url,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        database.ref('messages/' + currentChatId).push(message).then(() => {
            database.ref('chats/' + currentChatId).update({
                lastMessage: '🎤 Голосовое сообщение',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        });
    }).catch(err => showNotification('Ошибка загрузки аудио', 'error'));
}

// === ВИДЕОКРУЖКИ (через Catbox) ===
var videoRecorder, videoChunks, isVideoRecording = false;

function startVideoCircle() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            videoRecorder = new MediaRecorder(stream);
            videoChunks = [];
            videoRecorder.ondataavailable = e => videoChunks.push(e.data);
            videoRecorder.onstop = () => {
                var blob = new Blob(videoChunks, { type: 'video/webm' });
                sendVideoMessage(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            videoRecorder.start();
            isVideoRecording = true;
            var btn = document.getElementById('video-record-btn');
            if (btn) btn.classList.add('recording');
            setTimeout(() => { if (isVideoRecording) stopVideoCircle(); }, 15000);
        })
        .catch(err => showNotification('Нет доступа к камере', 'error'));
}

function stopVideoCircle() {
    if (videoRecorder && isVideoRecording) {
        videoRecorder.stop();
        isVideoRecording = false;
        var btn = document.getElementById('video-record-btn');
        if (btn) btn.classList.remove('recording');
    }
}

function sendVideoMessage(blob) {
    if (!currentChatId) return;
    var file = new File([blob], 'video_' + Date.now() + '.webm', { type: 'video/webm' });
    uploadToCatbox(file).then(url => {
        var message = {
            type: 'video_circle',
            videoUrl: url,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        database.ref('messages/' + currentChatId).push(message).then(() => {
            database.ref('chats/' + currentChatId).update({
                lastMessage: '📹 Видеокружок',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        });
    }).catch(err => showNotification('Ошибка загрузки видео', 'error'));
}

// === АВАТАРКИ ===
function previewGroupAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        groupAvatarFile = file;
        var reader = new FileReader();
        reader.onload = e => {
            var preview = document.getElementById('group-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        channelAvatarFile = file;
        var reader = new FileReader();
        reader.onload = e => {
            var preview = document.getElementById('channel-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewEditAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = e => {
            var preview = document.getElementById('edit-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile = file;
    }
}
