// UPLOAD - ImgBB для фото + Catbox для файлов + Видеокружок

var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;

// === ВИДЕОКРУЖОК ===
var circleStream = null;
var circleRecorder = null;
var circleChunks = [];
var circleTimerInterval = null;
var circleSeconds = 0;
var circleMaxSeconds = 60;
var isCircleRecording = false;
var currentFacingMode = 'user'; // 'user' или 'environment'
var circleVideoBlob = null;

// Получить видео-медиа для кружка
async function getCircleMedia(facingMode) {
    return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facingMode } },
        audio: true
    }).catch(async () => {
        // Если точная камера не найдена, пробуем любую
        return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: true
        });
    });
}

// Открыть модалку кружка
async function startVideoCircle() {
    // Закрываем старую модалку если есть
    closeCircleModal();
    
    // Показываем новую
    const modal = document.getElementById('circle-video-modal');
    modal.classList.remove('hidden');
    
    // Сбрасываем состояние
    circleSeconds = 0;
    isCircleRecording = false;
    circleVideoBlob = null;
    updateCircleTimerDisplay();
    updateCircleProgress(0);
    
    // Получаем видео с фронтальной камеры
    try {
        if (circleStream) {
            circleStream.getTracks().forEach(t => t.stop());
        }
        circleStream = await getCircleMedia('user');
        currentFacingMode = 'user';
        const video = document.getElementById('circle-video-preview');
        video.srcObject = circleStream;
        
        // Настройка кнопок
        setupCircleButtons();
        
    } catch (err) {
        console.error('Ошибка доступа к камере:', err);
        showNotification('Не удалось получить доступ к камере', 'error');
        closeCircleModal();
    }
}

function closeCircleModal() {
    const modal = document.getElementById('circle-video-modal');
    modal.classList.add('hidden');
    
    if (circleStream) {
        circleStream.getTracks().forEach(t => t.stop());
        circleStream = null;
    }
    if (circleTimerInterval) {
        clearInterval(circleTimerInterval);
        circleTimerInterval = null;
    }
    if (circleRecorder && isCircleRecording) {
        circleRecorder.stop();
    }
    isCircleRecording = false;
}

function setupCircleButtons() {
    const video = document.getElementById('circle-video-preview');
    const stopBtn = document.getElementById('circle-stop-btn');
    const deleteBtn = document.getElementById('circle-delete-btn');
    const sendBtn = document.getElementById('circle-send-btn');
    const flipBtn = document.getElementById('circle-flip-camera');
    
    // Убираем активные классы
    deleteBtn.classList.remove('active');
    sendBtn.classList.remove('active');
    stopBtn.classList.remove('recording');
    
    // Обработчики для drag & drop удаления
    let isDragging = false;
    
    deleteBtn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'delete');
        isDragging = true;
    });
    
    deleteBtn.addEventListener('dragend', () => {
        setTimeout(() => { isDragging = false; }, 100);
    });
    
    // При наведении на deleteBtn при перетаскивании
    deleteBtn.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (isCircleRecording) {
            deleteBtn.classList.add('active');
        }
    });
    
    deleteBtn.addEventListener('dragleave', () => {
        deleteBtn.classList.remove('active');
    });
    
    // Обработчик для отправки (можно нажать во время записи)
    sendBtn.onclick = () => {
        if (circleVideoBlob) {
            // Если уже записано, отправляем
            sendCircleVideo(circleVideoBlob);
        } else if (isCircleRecording) {
            // Если идёт запись, останавливаем и отправляем
            stopCircleRecording(true);
        }
    };
    
    // Обработчик удаления (можно перетащить или нажать)
    deleteBtn.onclick = () => {
        if (circleVideoBlob) {
            // Если уже записано, удаляем
            circleVideoBlob = null;
            circleSeconds = 0;
            updateCircleTimerDisplay();
            updateCircleProgress(0);
            deleteBtn.classList.remove('active');
            sendBtn.classList.remove('active');
            showNotification('Видео удалено', 'info');
        } else if (isCircleRecording) {
            // Если идёт запись, останавливаем и удаляем
            stopCircleRecording(false);
        }
    };
    
    // Переключение камеры
    flipBtn.onclick = async () => {
        if (isCircleRecording) return;
        
        const newMode = currentFacingMode === 'user' ? 'environment' : 'user';
        try {
            const newStream = await getCircleMedia(newMode);
            if (circleStream) {
                circleStream.getTracks().forEach(t => t.stop());
            }
            circleStream = newStream;
            currentFacingMode = newMode;
            video.srcObject = circleStream;
        } catch (err) {
            showNotification('Не удалось переключить камеру', 'error');
        }
    };
    
    // Обработчик кнопки стоп/запись
    stopBtn.onclick = () => {
        if (isCircleRecording) {
            stopCircleRecording(true);
        } else {
            startCircleRecording();
        }
    };
}

function startCircleRecording() {
    if (!circleStream) return;
    
    circleChunks = [];
    circleSeconds = 0;
    isCircleRecording = true;
    
    const stopBtn = document.getElementById('circle-stop-btn');
    stopBtn.classList.add('recording');
    
    // Запускаем таймер
    if (circleTimerInterval) clearInterval(circleTimerInterval);
    circleTimerInterval = setInterval(() => {
        if (circleSeconds < circleMaxSeconds && isCircleRecording) {
            circleSeconds++;
            updateCircleTimerDisplay();
            updateCircleProgress((circleSeconds / circleMaxSeconds) * 100);
            
            if (circleSeconds >= circleMaxSeconds) {
                // Максимум достигнут, останавливаем запись
                stopCircleRecording(true);
            }
        }
    }, 1000);
    
    // Создаём медиарекордер
    try {
        circleRecorder = new MediaRecorder(circleStream, { mimeType: 'video/webm' });
        circleRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                circleChunks.push(e.data);
            }
        };
        circleRecorder.onstop = () => {
            if (circleChunks.length > 0) {
                circleVideoBlob = new Blob(circleChunks, { type: 'video/webm' });
                const sendBtn = document.getElementById('circle-send-btn');
                const deleteBtn = document.getElementById('circle-delete-btn');
                sendBtn.classList.add('active');
                deleteBtn.classList.add('active');
                showNotification('Запись завершена! Нажмите "Отправить" или перетащите на корзину для удаления', 'success');
            }
            isCircleRecording = false;
            if (circleTimerInterval) clearInterval(circleTimerInterval);
            const stopBtn = document.getElementById('circle-stop-btn');
            stopBtn.classList.remove('recording');
        };
        
        circleRecorder.start(100);
    } catch (err) {
        console.error('Ошибка записи:', err);
        showNotification('Ошибка записи видео', 'error');
        stopCircleRecording(false);
    }
}

function stopCircleRecording(sendAfterStop = true) {
    if (circleRecorder && circleRecorder.state === 'recording') {
        circleRecorder.stop();
    }
    if (circleTimerInterval) {
        clearInterval(circleTimerInterval);
        circleTimerInterval = null;
    }
    const stopBtn = document.getElementById('circle-stop-btn');
    stopBtn.classList.remove('recording');
    
    // Если нужно отправить после остановки
    if (sendAfterStop && circleVideoBlob) {
        sendCircleVideo(circleVideoBlob);
    } else if (!sendAfterStop) {
        // Удаляем запись
        circleVideoBlob = null;
        circleSeconds = 0;
        updateCircleTimerDisplay();
        updateCircleProgress(0);
        const sendBtn = document.getElementById('circle-send-btn');
        const deleteBtn = document.getElementById('circle-delete-btn');
        sendBtn.classList.remove('active');
        deleteBtn.classList.remove('active');
        showNotification('Запись удалена', 'info');
    }
}

function sendCircleVideo(blob) {
    if (!blob || !currentChatId) {
        showNotification('Ошибка отправки', 'error');
        return;
    }
    
    showNotification('Отправка видео...', 'info');
    const file = new File([blob], 'circle_' + Date.now() + '.webm', { type: 'video/webm' });
    
    uploadToCatbox(file)
        .then(url => {
            const message = {
                type: 'video_circle',
                videoUrl: url,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('messages/' + currentChatId).push(message);
        })
        .then(() => {
            database.ref('chats/' + currentChatId).update({
                lastMessage: '📹 Видеокружок',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
            showNotification('Видеокружок отправлен!', 'success');
            closeCircleModal();
        })
        .catch(err => {
            console.error(err);
            showNotification('Ошибка отправки видео', 'error');
        });
}

function updateCircleTimerDisplay() {
    const mins = Math.floor(circleSeconds / 60).toString().padStart(2, '0');
    const secs = (circleSeconds % 60).toString().padStart(2, '0');
    document.getElementById('circle-timer').textContent = `${mins}:${secs}`;
}

function updateCircleProgress(percent) {
    document.getElementById('circle-progress-fill').style.width = `${percent}%`;
}

// === ЗАГРУЗКА НА CATBOX ===
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

// === ЗАГРУЗКА НА IMGBB ===
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

// === ОБРАБОТКА ФАЙЛОВ ===
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

// === ФОТО ===
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
