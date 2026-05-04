// UPLOAD - ImgBB для фото + Catbox для файлов + полноэкранный предпросмотр

var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImages = [];
var currentCaption = '';

// === КРУГОВОЙ ПРОГРЕСС ===
var progressModal = null;
var currentUploadXhr = null;

function showProgressModalForImages(totalImages) {
    if (progressModal) progressModal.remove();
    
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
                    <span class="progress-current">1</span>
                    <span> / </span>
                    <span class="progress-total">${totalImages}</span>
                    <span> фото</span>
                </div>
            </div>
            <div class="progress-subtext">Загрузка...</div>
            <button id="cancel-upload-btn" class="progress-cancel-btn">Отменить</button>
        </div>
    `;
    
    var style = document.getElementById('progress-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'progress-styles';
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
            }
            .progress-subtext {
                text-align: center;
                margin-top: 15px;
                color: #666;
                font-size: 14px;
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
            .fullscreen-preview {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: #000;
                z-index: 10001;
                display: flex;
                flex-direction: column;
            }
            .preview-close {
                position: absolute;
                top: 20px;
                left: 20px;
                width: 44px;
                height: 44px;
                background: rgba(0,0,0,0.6);
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 24px;
                cursor: pointer;
                z-index: 10;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .preview-image-container {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .preview-image-container img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }
            .preview-footer {
                background: rgba(0,0,0,0.8);
                padding: 15px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .preview-caption-input {
                background: rgba(255,255,255,0.1);
                border: none;
                border-radius: 24px;
                padding: 12px 16px;
                color: white;
                font-size: 16px;
                outline: none;
            }
            .preview-caption-input::placeholder {
                color: rgba(255,255,255,0.5);
            }
            .preview-actions {
                display: flex;
                gap: 12px;
                justify-content: space-between;
            }
            .preview-add-btn {
                background: rgba(255,255,255,0.2);
                border: none;
                border-radius: 30px;
                padding: 10px 20px;
                color: white;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .preview-send-btn {
                background: #228B22;
                border: none;
                border-radius: 30px;
                padding: 10px 24px;
                color: white;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
            }
            .photo-counter {
                background: rgba(0,0,0,0.6);
                border-radius: 20px;
                padding: 5px 12px;
                font-size: 14px;
                color: white;
                position: absolute;
                top: 20px;
                right: 20px;
            }
        `;
        document.head.appendChild(style);
    }
    
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

function updateProgressForImages(current, total, progressPercent) {
    var currentSpan = document.querySelector('#upload-progress-modal .progress-current');
    if (currentSpan) currentSpan.textContent = current;
    
    var circle = document.querySelector('#upload-progress-modal .progress-fill');
    if (circle) {
        var radius = 45;
        var circumference = 2 * Math.PI * radius;
        var offset = circumference * (1 - (progressPercent / 100));
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

// === ПОЛНОЭКРАННЫЙ ПРЕДПРОСМОТР ===
function showFullscreenPreview(files, startIndex) {
    var currentIndex = startIndex || 0;
    pendingImages = files;
    
    var modal = document.createElement('div');
    modal.className = 'fullscreen-preview';
    modal.innerHTML = `
        <button class="preview-close">✕</button>
        <div class="photo-counter"><span id="photo-counter-current">${currentIndex + 1}</span> / <span id="photo-counter-total">${files.length}</span></div>
        <div class="preview-image-container">
            <img id="preview-main-image" src="">
        </div>
        <div class="preview-footer">
            <input type="text" class="preview-caption-input" id="preview-caption" placeholder="Добавить подпись...">
            <div class="preview-actions">
                <button class="preview-add-btn" id="preview-add-photo-btn">📷 Добавить фото</button>
                <button class="preview-send-btn" id="preview-send-btn">Отправить (${files.length})</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    function loadImage(index) {
        var file = files[index];
        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('preview-main-image').src = e.target.result;
            document.getElementById('photo-counter-current').textContent = index + 1;
        };
        reader.readAsDataURL(file);
    }
    
    loadImage(currentIndex);
    
    // Крестик
    modal.querySelector('.preview-close').onclick = function() {
        modal.remove();
        pendingImages = [];
    };
    
    // Добавить фото
    modal.querySelector('#preview-add-photo-btn').onclick = function() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = function(e) {
            var newFiles = Array.from(e.target.files);
            pendingImages = [...pendingImages, ...newFiles];
            document.getElementById('photo-counter-total').textContent = pendingImages.length;
            document.getElementById('preview-send-btn').textContent = `Отправить (${pendingImages.length})`;
            loadImage(pendingImages.length - 1);
        };
        input.click();
    };
    
    // Отправить
    modal.querySelector('#preview-send-btn').onclick = function() {
        var caption = document.getElementById('preview-caption').value;
        currentCaption = caption;
        modal.remove();
        sendMultipleImages(pendingImages, caption);
    };
}

function sendMultipleImages(files, caption) {
    if (!currentChatId) {
        showNotification('Ошибка: чат не выбран', 'error');
        return;
    }
    
    if (files.length === 0) return;
    
    showProgressModalForImages(files.length);
    
    var completed = 0;
    var failed = false;
    var sentMessages = [];
    
    files.forEach(function(file, index) {
        uploadImageToImgBB(file, function(loaded, total) {
            var percent = (loaded / total) * 100;
            updateProgressForImages(completed + 1, files.length, percent);
        })
            .then(function(data) {
                if (failed) return;
                var message = {
                    type: 'image',
                    imageUrl: data.url,
                    caption: index === 0 ? caption : '',
                    senderId: currentUser.uid,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
                return database.ref('messages/' + currentChatId).push(message);
            })
            .then(function() {
                completed++;
                updateProgressForImages(completed, files.length, 100);
                
                if (completed === files.length) {
                    closeProgressModal();
                    var lastMsg = caption ? '📷 ' + caption : '📷 Фото';
                    if (lastMsg.length > 50) lastMsg = lastMsg.substring(0, 47) + '...';
                    database.ref('chats/' + currentChatId).update({
                        lastMessage: lastMsg,
                        lastMessageTime: firebase.database.ServerValue.TIMESTAMP
                    });
                    showNotification('Фото отправлены!', 'success');
                    pendingImages = [];
                    currentCaption = '';
                }
            })
            .catch(function(err) {
                if (!failed) {
                    failed = true;
                    closeProgressModal();
                    showNotification('Ошибка отправки фото: ' + (err.message || 'Неизвестная ошибка'), 'error');
                }
            });
    });
}

// === ЗАГРУЗКА НА IMGBB ===
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
        
        if (onProgress) {
            xhr.upload.onprogress = function(event) {
                if (event.lengthComputable) {
                    onProgress(event.loaded, event.total);
                }
            };
        }
        
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

// === ЗАГРУЗКА НА CATBOX (для файлов) ===
async function uploadToCatbox(file, onProgress) {
    return new Promise((resolve, reject) => {
        var formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', file);
        
        var xhr = new XMLHttpRequest();
        
        if (onProgress) {
            xhr.upload.onprogress = function(event) {
                if (event.lengthComputable) {
                    onProgress(event.loaded, event.total);
                }
            };
        }
        
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
        };
        
        xhr.onerror = function() {
            reject(new Error('Сетевая ошибка'));
        };
        
        xhr.open('POST', 'https://catbox.moe/user/api.php', true);
        xhr.send(formData);
    });
}

// === ОБРАБОТКА ВЫБОРА ФАЙЛА ===
function handleFileSelect(event) {
    var files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    var validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
        // Не фото — отправляем как обычный файл
        sendAnyFile(files[0]);
    } else {
        showFullscreenPreview(validFiles, 0);
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

// Совместимость со старым кодом (если где-то вызывается)
function showImagePreview(file) {
    // Перенаправляем на новый функционал
    handleFileSelect({ target: { files: [file] } });
}

function closeImagePreview() {
    // Закрываем полноэкранный предпросмотр если он открыт
    var preview = document.querySelector('.fullscreen-preview');
    if (preview) preview.remove();
    pendingImages = [];
}
