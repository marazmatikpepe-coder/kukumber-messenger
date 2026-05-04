// UPLOAD - ImgBB для фото
var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;
var currentUploadXhr = null;

// Показываем круговой прогресс
function showCircularProgress() {
    var modal = document.getElementById('upload-progress-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'upload-progress-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
        
        var style = document.createElement('style');
        style.textContent = `
            #upload-progress-modal .progress-container {
                background: white;
                border-radius: 20px;
                padding: 25px;
                text-align: center;
                min-width: 200px;
            }
            #upload-progress-modal .progress-circle {
                position: relative;
                width: 120px;
                height: 120px;
                margin: 0 auto;
            }
            #upload-progress-modal .progress-circle svg {
                width: 100%;
                height: 100%;
                transform: rotate(-90deg);
            }
            #upload-progress-modal .progress-circle circle {
                transition: stroke-dashoffset 0.2s;
            }
            #upload-progress-modal .progress-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 18px;
                font-weight: bold;
                color: #333;
            }
            #upload-progress-modal .progress-subtext {
                text-align: center;
                margin-top: 12px;
                color: #666;
                font-size: 13px;
            }
            #upload-progress-modal .cancel-btn {
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 30px;
                padding: 8px 25px;
                margin-top: 15px;
                cursor: pointer;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }
    
    var radius = 50;
    var circumference = 2 * Math.PI * radius;
    
    modal.innerHTML = `
        <div class="progress-container">
            <div class="progress-circle">
                <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#ddd" stroke-width="6"/>
                    <circle class="progress-fill" cx="60" cy="60" r="50" fill="none" stroke="#32CD32" stroke-width="6" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" stroke-linecap="round"/>
                </svg>
                <div class="progress-text">0%</div>
            </div>
            <div class="progress-subtext">Загрузка фото...</div>
            <button class="cancel-btn" id="cancel-upload">Отменить</button>
        </div>
    `;
    modal.style.display = 'flex';
    
    document.getElementById('cancel-upload').onclick = function() {
        if (currentUploadXhr) {
            currentUploadXhr.abort();
            closeCircularProgress();
            showNotification('Загрузка отменена', 'info');
        }
    };
    
    return { modal, circumference };
}

function updateCircularProgressPercent(percent) {
    var circle = document.querySelector('#upload-progress-modal .progress-fill');
    var text = document.querySelector('#upload-progress-modal .progress-text');
    if (circle && text) {
        var radius = 50;
        var circumference = 2 * Math.PI * radius;
        var offset = circumference * (1 - percent / 100);
        circle.style.strokeDashoffset = offset;
        text.textContent = Math.round(percent) + '%';
    }
}

function closeCircularProgress() {
    var modal = document.getElementById('upload-progress-modal');
    if (modal) modal.style.display = 'none';
    currentUploadXhr = null;
}

// Открыть предпросмотр фото
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        sendAnyFile(file);
        event.target.value = '';
        return;
    }
    
    pendingImageFile = file;
    var reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('preview-image').src = e.target.result;
        document.getElementById('image-caption').value = '';
        document.getElementById('image-preview-modal').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function closeImagePreview() {
    document.getElementById('image-preview-modal').classList.add('hidden');
    pendingImageFile = null;
}

// Отправить фото
function confirmImageSend() {
    if (!pendingImageFile || !currentChatId) {
        showNotification('Ошибка отправки', 'error');
        closeImagePreview();
        return;
    }
    
    var caption = document.getElementById('image-caption').value.trim();
    var file = pendingImageFile;
    
    closeImagePreview();
    
    // Показываем круговой прогресс
    showCircularProgress();
    
    var formData = new FormData();
    formData.append('image', file);
    formData.append('key', IMGBB_API_KEY);
    
    var xhr = new XMLHttpRequest();
    currentUploadXhr = xhr;
    
    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            var percent = (e.loaded / e.total) * 100;
            updateCircularProgressPercent(percent);
        }
    };
    
    xhr.onload = function() {
        closeCircularProgress();
        if (xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    var message = {
                        type: 'image',
                        imageUrl: data.data.url,
                        caption: caption,
                        senderId: currentUser.uid,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    };
                    database.ref('messages/' + currentChatId).push(message)
                        .then(function() {
                            var lastMsg = caption ? '📷 ' + caption.substring(0, 47) : '📷 Фото';
                            return database.ref('chats/' + currentChatId).update({
                                lastMessage: lastMsg,
                                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
                            });
                        })
                        .then(function() {
                            showNotification('Фото отправлено!', 'success');
                        })
                        .catch(function(err) {
                            console.error('Firebase error:', err);
                            showNotification('Ошибка сохранения', 'error');
                        });
                } else {
                    showNotification('Ошибка ImgBB: ' + JSON.stringify(data), 'error');
                }
            } catch(e) {
                showNotification('Ошибка ответа сервера', 'error');
            }
        } else {
            showNotification('Ошибка загрузки (статус ' + xhr.status + ')', 'error');
        }
        currentUploadXhr = null;
    };
    
    xhr.onerror = function() {
        closeCircularProgress();
        showNotification('Ошибка сети', 'error');
        currentUploadXhr = null;
    };
    
    xhr.open('POST', 'https://api.imgbb.com/1/upload', true);
    xhr.send(formData);
}

// Отправка любых файлов (не фото)
async function sendAnyFile(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('Загрузка файла...', 'info');
    
    var formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);
    
    try {
        var response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: formData
        });
        var url = await response.text();
        if (!url.startsWith('https://')) throw new Error('Ошибка');
        
        var message = file.type.startsWith('audio/') ? {
            type: 'audio', audioUrl: url, senderId: currentUser.uid, timestamp: firebase.database.ServerValue.TIMESTAMP
        } : {
            type: 'file', fileName: file.name, fileUrl: url, fileSize: file.size, senderId: currentUser.uid, timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref('messages/' + currentChatId).push(message);
        await database.ref('chats/' + currentChatId).update({
            lastMessage: file.type.startsWith('audio/') ? '🎤 Голосовое' : '📎 ' + file.name,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('Файл отправлен!', 'success');
    } catch(e) {
        showNotification('Ошибка загрузки файла', 'error');
    }
}

// Голосовые сообщения
var mediaRecorder, audioChunks, isRecording = false;

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                var blob = new Blob(audioChunks, { type: 'audio/webm' });
                var file = new File([blob], 'voice.webm', { type: 'audio/webm' });
                sendAnyFile(file);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            var btn = document.getElementById('voice-record-btn');
            if (btn) btn.classList.add('recording');
        })
        .catch(() => showNotification('Нет доступа к микрофону', 'error'));
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        var btn = document.getElementById('voice-record-btn');
        if (btn) btn.classList.remove('recording');
    }
}

// Аватарки
function previewGroupAvatar(e) {
    var file = e.target.files[0];
    if (file) {
        groupAvatarFile = file;
        var reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('group-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('group-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('group-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(e) {
    var file = e.target.files[0];
    if (file) {
        channelAvatarFile = file;
        var reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('channel-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('channel-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('channel-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewEditAvatar(e) {
    var file = e.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = ev => {
            document.getElementById('edit-avatar-preview').style.backgroundImage = 'url(' + ev.target.result + ')';
            document.getElementById('edit-avatar-preview').style.backgroundSize = 'cover';
            document.getElementById('edit-avatar-preview').textContent = '';
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile = file;
    }
}

// Функция для отладки (можно вызвать в консоли)
window.testImgBB = function() {
    var testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    var formData = new FormData();
    formData.append('image', testFile);
    formData.append('key', IMGBB_API_KEY);
    fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => console.log('ImgBB тест:', data))
        .catch(err => console.error('ImgBB ошибка:', err));
};
