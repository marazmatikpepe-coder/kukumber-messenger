// UPLOAD - ImgBB для фото + Catbox для файлов + круговой прогресс

var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;

// === КРУГОВОЙ ПРОГРЕСС ===
var currentUploadXhr = null;
var progressModal = null;

function showProgressModal(fileSize) {
    // Закрываем старую модалку если есть
    if (progressModal) progressModal.remove();
    
    var totalMB = (fileSize / (1024 * 1024)).toFixed(1);
    
    progressModal = document.createElement('div');
    progressModal.className = 'modal';
    progressModal.id = 'upload-progress-modal';
    progressModal.style.display = 'flex';
    progressModal.innerHTML = `
        <div class="progress-container">
            <div class="progress-circle">
                <svg viewBox="0 0 100 100">
                    <circle class="progress-bg" cx="50" cy="50" r="45" fill="none" stroke="#ddd" stroke-width="8"/>
                    <circle class="progress-fill" cx="50" cy="50" r="45" fill="none" stroke="#32CD32" stroke-width="8" stroke-dasharray="283" stroke-dashoffset="283" stroke-linecap="round"/>
                </svg>
                <div class="progress-text">
                    <span class="progress-loaded">0.0</span>
                    <span> / </span>
                    <span class="progress-total">${totalMB}</span>
                    <span> MB</span>
                </div>
            </div>
            <button id="cancel-upload-btn" class="progress-cancel-btn">Отменить</button>
        </div>
    `;
    
    // Стили добавляем динамически
    var style = document.createElement('style');
    style.textContent = `
        .progress-container {
            background: white;
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            min-width: 280px;
        }
        .progress-circle {
            position: relative;
            width: 180px;
            height: 180px;
            margin: 0 auto;
        }
        .progress-circle svg {
            width: 100%;
            height: 100%;
            transform: rotate(-90deg);
        }
        .progress-fill {
            transition: stroke-dashoffset 0.2s ease;
        }
        .progress-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            color: #333;
            white-space: nowrap;
        }
        .progress-text span {
            font-size: 16px;
        }
        .progress-cancel-btn {
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 40px;
            padding: 10px 30px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            transition: all 0.2s;
        }
        .progress-cancel-btn:hover {
            background: #c82333;
            transform: scale(1.02);
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(progressModal);
    
    var cancelBtn = document.getElementById('cancel-upload-btn');
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            if (currentUploadXhr) {
                currentUploadXhr.abort();
                showNotification('Загрузка отменена', 'info');
            }
            closeProgressModal();
        };
    }
}

function updateProgress(loaded, total) {
    var percent = total > 0 ? (loaded / total) : 0;
    var loadedMB = (loaded / (1024 * 1024)).toFixed(1);
    var totalMB = (total / (1024 * 1024)).toFixed(1);
    
    var textSpan = document.querySelector('#upload-progress-modal .progress-loaded');
    if (textSpan) textSpan.textContent = loadedMB;
    
    var circle = document.querySelector('#upload-progress-modal .progress-fill');
    if (circle) {
        var radius = 45;
        var circumference = 2 * Math.PI * radius;
        var offset = circumference * (1 - percent);
        circle.style.strokeDashoffset = offset;
    }
}

function closeProgressModal() {
    if (progressModal) {
        progressModal.remove();
        progressModal = null;
    }
    currentUploadXhr = null;
}

// === ЗАГРУЗКА НА CATBOX (для файлов) ===
async function uploadToCatbox(file, onProgress) {
    return new Promise((resolve, reject) => {
        var formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', file);
        
        var xhr = new XMLHttpRequest();
        currentUploadXhr = xhr;
        
        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable && onProgress) {
                onProgress(event.loaded, event.total);
            }
        };
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                var url = xhr.responseText;
                if (url.startsWith('https://')) {
                    resolve(url);
                } else {
                    reject(new Error('Ошибка загрузки на Catbox'));
                }
            } else {
                reject(new Error('Ошибка загрузки'));
            }
            currentUploadXhr = null;
        };
        
        xhr.onerror = function() {
            reject(new Error('Сетевая ошибка'));
            currentUploadXhr = null;
        };
        
        xhr.onabort = function() {
            reject(new Error('Загрузка отменена'));
            currentUploadXhr = null;
        };
        
        xhr.open('POST', 'https://catbox.moe/user/api.php', true);
        xhr.send(formData);
    });
}

// === ЗАГРУЗКА НА IMGBB (с прогрессом) ===
function uploadImageToImgBB(file, onProgress) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Не изображение'));
            return;
        }
        if (file.size > 32 * 1024 * 1024) {
            reject(new Error('Файл >32 МБ'));
            return;
        }
        
        var formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);
        
        var xhr = new XMLHttpRequest();
        currentUploadXhr = xhr;
        
        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable && onProgress) {
                onProgress(event.loaded, event.total);
            }
        };
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        resolve({ url: data.data.url });
                    } else {
                        reject(new Error('Ошибка ImgBB'));
                    }
                } catch(e) {
                    reject(new Error('Ошибка обработки ответа'));
                }
            } else {
                reject(new Error('Ошибка загрузки'));
            }
            currentUploadXhr = null;
        };
        
        xhr.onerror = function() {
            reject(new Error('Сетевая ошибка'));
            currentUploadXhr = null;
        };
        
        xhr.onabort = function() {
            reject(new Error('Загрузка отменена'));
            currentUploadXhr = null;
        };
        
        xhr.open('POST', 'https://api.imgbb.com/1/upload', true);
        xhr.send(formData);
    });
}

// === ОБРАБОТКА ВЫБОРА ФАЙЛА ===
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    if (file.type.startsWith('image/')) {
        showImagePreview(file);
    } else {
        sendAnyFile(file);
    }
    event.target.value = '';
}

async function sendAnyFile(file) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('Загрузка файла...', 'info');
    
    try {
        const url = await uploadToCatbox(file, null);
        
        var message = {};
        if (file.type.startsWith('audio/')) {
            message = {
                type: 'audio',
                audioUrl: url,
                fileName: file.name,
                fileSize: file.size,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
        } else {
            message = {
                type: 'file',
                fileName: file.name,
                fileUrl: url,
                fileSize: file.size,
                fileType: file.type,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
        }
        
        await database.ref('messages/' + currentChatId).push(message);
        
        var lastMsg = '';
        if (file.type.startsWith('audio/')) lastMsg = '🎤 Голосовое сообщение';
        else lastMsg = '📎 ' + file.name;
        if (lastMsg.length > 50) lastMsg = lastMsg.substring(0, 47) + '...';
        
        await database.ref('chats/' + currentChatId).update({
            lastMessage: lastMsg,
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('Файл отправлен!', 'success');
    } catch (error) {
        console.error(error);
        showNotification('Ошибка загрузки файла', 'error');
    }
}

// === ФОТО С ПРОГРЕССОМ ===
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
    var totalSize = file.size;
    
    // Показываем модалку прогресса
    showProgressModal(totalSize);
    
    uploadImageToImgBB(file, function(loaded, total) {
        updateProgress(loaded, total);
    })
        .then(data => {
            closeProgressModal();
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
            closeImagePreview();
        })
        .catch(err => {
            closeProgressModal();
            showNotification('Ошибка отправки фото: ' + (err.message || 'Неизвестная ошибка'), 'error');
            console.error(err);
        });
    pendingImageFile = null;
}

// === ГОЛОСОВЫЕ ===
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

async function sendAudioMessage(blob) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    showNotification('Отправка голосового сообщения...', 'info');
    var file = new File([blob], 'voice_' + Date.now() + '.webm', { type: 'audio/webm' });
    
    try {
        const url = await uploadToCatbox(file, null);
        
        var message = {
            type: 'audio',
            audioUrl: url,
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        await database.ref('messages/' + currentChatId).push(message);
        await database.ref('chats/' + currentChatId).update({
            lastMessage: '🎤 Голосовое сообщение',
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('Голосовое сообщение отправлено!', 'success');
    } catch (error) {
        console.error(error);
        showNotification('Ошибка отправки голосового сообщения', 'error');
    }
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
