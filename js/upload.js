// UPLOAD - ImgBB для фото + AssemblyAI для голосовых (транскрипция)

var IMGBB_API_KEY = 'd8a9dad272290e9bd78173da55a97d77';
var pendingImageFile = null;

// Ваш ключ AssemblyAI (уже вставлен)
const ASSEMBLYAI_API_KEY = 'eb495c28360c4a7fb5d186809484dbbc';

// === ЗАГРУЗКА НА CATBOX (для файлов) ===
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

// === ТРАНСКРИПЦИЯ АУДИО ЧЕРЕЗ ASSEMBLYAI ===
async function transcribeAudio(audioBlob) {
    try {
        // 1. Загружаем аудио в AssemblyAI
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');
        
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: { 'authorization': ASSEMBLYAI_API_KEY },
            body: formData
        });
        
        const uploadData = await uploadResponse.json();
        const audioUrl = uploadData.upload_url;
        
        if (!audioUrl) throw new Error('Ошибка загрузки аудио');
        
        // 2. Запускаем транскрипцию
        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'authorization': ASSEMBLYAI_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ audio_url: audioUrl })
        });
        
        const transcriptData = await transcriptResponse.json();
        const transcriptId = transcriptData.id;
        
        // 3. Ждём завершения транскрипции (до 10 секунд)
        let result = null;
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: { 'authorization': ASSEMBLYAI_API_KEY }
            });
            result = await pollingResponse.json();
            
            if (result.status === 'completed') break;
            if (result.status === 'error') throw new Error('Ошибка транскрипции');
        }
        
        return result.text || '🎤 Голосовое сообщение';
    } catch (error) {
        console.error('Ошибка AssemblyAI:', error);
        return null;
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
        const url = await uploadToCatbox(file);
        
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
        else if (file.type.startsWith('video/')) lastMsg = '🎬 ' + file.name;
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

// === ГОЛОСОВЫЕ СООБЩЕНИЯ С ТРАНСКРИПЦИЕЙ ===
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
    
    showNotification('Распознавание речи...', 'info');
    
    try {
        // Транскрибируем аудио в текст через AssemblyAI
        const transcribedText = await transcribeAudio(blob);
        
        if (transcribedText && transcribedText !== '🎤 Голосовое сообщение') {
            // Отправляем как текстовое сообщение
            var message = {
                type: 'text',
                text: '🎤 ' + transcribedText,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            await database.ref('messages/' + currentChatId).push(message);
            
            var lastMsg = transcribedText.length > 50 ? transcribedText.substring(0, 47) + '...' : transcribedText;
            await database.ref('chats/' + currentChatId).update({
                lastMessage: '🎤 ' + lastMsg,
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
            showNotification('Голосовое отправлено как текст!', 'success');
        } else {
            // Если транскрипция не удалась, отправляем аудиофайл
            showNotification('Отправка голосового сообщения...', 'info');
            const url = await uploadToCatbox(new File([blob], 'voice_' + Date.now() + '.webm', { type: 'audio/webm' }));
            
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
            showNotification('Голосовое отправлено!', 'success');
        }
    } catch (error) {
        console.error(error);
        showNotification('Ошибка отправки', 'error');
    }
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
