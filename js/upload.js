// UPLOAD - ImgBB для фото + Catbox для файлов + Видеокружок (исправлен)

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
var isCirclePaused = false;
var currentFacingMode = 'user'; // 'user' или 'environment'
var circleVideoBlob = null;

// Получить видео-медиа для кружка
async function getCircleMedia(facingMode) {
    try {
        return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: facingMode } },
            audio: true
        });
    } catch (err) {
        // Если точная камера не найдена, пробуем любую
        return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: true
        });
    }
}

// Открыть модалку кружка и сразу начать запись
async function startVideoCircle() {
    // Закрываем старую модалку если есть
    closeCircleModal();
    
    // Показываем новую
    const modal = document.getElementById('circle-video-modal');
    modal.classList.remove('hidden');
    
    // Сбрасываем состояние
    circleSeconds = 0;
    isCircleRecording = false;
    isCirclePaused = false;
    circleVideoBlob = null;
    circleChunks = [];
    updateCircleTimerDisplay();
    updateCircleProgress(0);
    
    // Скрываем/показываем кнопки
    document.getElementById('circle-pause-btn').classList.remove('hidden');
    document.getElementById('circle-play-btn').classList.add('hidden');
    
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
        
        // АВТОМАТИЧЕСКИ НАЧИНАЕМ ЗАПИСЬ
        setTimeout(() => {
            startCircleRecording();
        }, 100);
        
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
        try { circleRecorder.stop(); } catch(e) {}
    }
    isCircleRecording = false;
    isCirclePaused = false;
}

function setupCircleButtons() {
    const stopBtn = document.getElementById('circle-stop-btn');
    const pauseBtn = document.getElementById('circle-pause-btn');
    const playBtn = document.getElementById('circle-play-btn');
    const deleteBtn = document.getElementById('circle-delete-btn');
    const sendBtn = document.getElementById('circle-send-btn');
    const flipBtn = document.getElementById('circle-flip-camera');
    const closeBtn = document.getElementById('circle-close-btn');
    
    // Убираем активные классы
    deleteBtn.classList.remove('active');
    sendBtn.classList.remove('active');
    
    // Кнопка стоп (останавливает запись и показывает кнопки отправки/удаления)
    stopBtn.onclick = () => {
        if (isCircleRecording) {
            stopCircleRecording(true);
        }
    };
    
    // Пауза
    pauseBtn.onclick = () => {
        if (isCircleRecording && circleRecorder && circleRecorder.state === 'recording') {
            circleRecorder.pause();
            isCirclePaused = true;
            isCircleRecording = false;
            pauseBtn.classList.add('hidden');
            playBtn.classList.remove('hidden');
            if (circleTimerInterval) clearInterval(circleTimerInterval);
        }
    };
    
    // Возобновление
    playBtn.onclick = () => {
        if (circleRecorder && circleRecorder.state === 'paused') {
            circleRecorder.resume();
            isCirclePaused = false;
            isCircleRecording = true;
            playBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
            // Возобновляем таймер
            if (circleTimerInterval) clearInterval(circleTimerInterval);
            circleTimerInterval = setInterval(updateCircleTimer, 1000);
        }
    };
    
    // Отправка
    sendBtn.onclick = () => {
        if (circleVideoBlob) {
            sendCircleVideo(circleVideoBlob);
        } else if (isCircleRecording) {
            // Если идёт запись, останавливаем и отправляем
            stopCircleRecording(true);
        }
    };
    
    // Удаление
    deleteBtn.onclick = () => {
        if (circleVideoBlob) {
            circleVideoBlob = null;
            circleSeconds = 0;
            circleChunks = [];
            updateCircleTimerDisplay();
            updateCircleProgress(0);
            deleteBtn.classList.remove('active');
            sendBtn.classList.remove('active');
            showNotification('Видео удалено', 'info');
            // Можно начать запись заново
            startCircleRecording();
        } else if (isCircleRecording) {
            stopCircleRecording(false);
            startCircleRecording();
        }
    };
    
    // Переключение камеры
    flipBtn.onclick = async () => {
        if (isCircleRecording) {
            showNotification('Сначала остановите запись', 'info');
            return;
        }
        const newMode = currentFacingMode === 'user' ? 'environment' : 'user';
        try {
            const newStream = await getCircleMedia(newMode);
            if (circleStream) {
                circleStream.getTracks().forEach(t => t.stop());
            }
            circleStream = newStream;
            currentFacingMode = newMode;
            const video = document.getElementById('circle-video-preview');
            video.srcObject = circleStream;
        } catch (err) {
            showNotification('Не удалось переключить камеру', 'error');
        }
    };
    
    // Закрытие
    closeBtn.onclick = () => {
        closeCircleModal();
    };
}

function startCircleRecording() {
    if (!circleStream) return;
    
    circleChunks = [];
    circleSeconds = 0;
    isCircleRecording = true;
    isCirclePaused = false;
    circleVideoBlob = null;
    
    updateCircleTimerDisplay();
    updateCircleProgress(0);
    
    // Скрываем кнопки отправки/удаления
    document.getElementById('circle-delete-btn').classList.remove('active');
    document.getElementById('circle-send-btn').classList.remove('active');
    document.getElementById('circle-pause-btn').classList.remove('hidden');
    document.getElementById('circle-play-btn').classList.add('hidden');
    
    // Запускаем таймер
    if (circleTimerInterval) clearInterval(circleTimerInterval);
    circleTimerInterval = setInterval(updateCircleTimer, 1000);
    
    // Создаём медиарекордер
    try {
        circleRecorder = new MediaRecorder(circleStream, { mimeType: 'video/webm' });
        circleRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                circleChunks.push(e.data);
            }
        };
        circleRecorder.onstop = () => {
            if (circleChunks.length > 0 && !circleVideoBlob) {
                circleVideoBlob = new Blob(circleChunks, { type: 'video/webm' });
                const sendBtn = document.getElementById('circle-send-btn');
                const deleteBtn = document.getElementById('circle-delete-btn');
                sendBtn.classList.add('active');
                deleteBtn.classList.add('active');
                showNotification('Запись завершена! Нажмите "Отправить" или "Удалить"', 'success');
            }
            isCircleRecording = false;
            if (circleTimerInterval) clearInterval(circleTimerInterval);
        };
        
        circleRecorder.start(100);
    } catch (err) {
        console.error('Ошибка записи:', err);
        showNotification('Ошибка записи видео', 'error');
        stopCircleRecording(false);
    }
}

function stopCircleRecording(sendAfterStop = true) {
    if (circleRecorder && (circleRecorder.state === 'recording' || circleRecorder.state === 'paused')) {
        circleRecorder.stop();
    }
    if (circleTimerInterval) {
        clearInterval(circleTimerInterval);
        circleTimerInterval = null;
    }
    
    // Если нужно отправить после остановки и есть blob
    if (sendAfterStop && circleVideoBlob) {
        sendCircleVideo(circleVideoBlob);
    } else if (!sendAfterStop) {
        circleVideoBlob = null;
        circleChunks = [];
        circleSeconds = 0;
        updateCircleTimerDisplay();
        updateCircleProgress(0);
        document.getElementById('circle-delete-btn').classList.remove('active');
        document.getElementById('circle-send-btn').classList.remove('active');
    }
}

function updateCircleTimer() {
    if (circleSeconds < circleMaxSeconds && isCircleRecording && !isCirclePaused) {
        circleSeconds++;
        updateCircleTimerDisplay();
        updateCircleProgress((circleSeconds / circleMaxSeconds) * 100);
        
        if (circleSeconds >= circleMaxSeconds) {
            // Максимум достигнут, останавливаем запись
            stopCircleRecording(true);
        }
    }
}

function sendCircleVideo(blob) {
    if (!blob || !currentChatId) {
        showNotification('Ошибка отправки: чат не выбран', 'error');
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
            console.error('Ошибка отправки видео:', err);
            showNotification('Ошибка отправки видео. Попробуйте ещё раз.', 'error');
        });
}

function updateCircleTimerDisplay() {
    const mins = Math.floor(circleSeconds / 60).toString().padStart(2, '0');
    const secs = (circleSeconds % 60).toString().padStart(2, '0');
    document.getElementById('circle-current-time').textContent = `${mins}:${secs}`;
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
