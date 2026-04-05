// Cloudinary Configuration
// ⚠️ ЗАМЕНИТЕ НА ВАШИ ДАННЫЕ
const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; // например 'dk8iyswpl'
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UNSIGNED_PRESET'; // например 'my_preset'

const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

var pendingImageFile = null;
var mediaRecorder, audioChunks, isRecording = false;
var videoRecorder, videoChunks, isVideoRecording = false;

function uploadToCloudinary(file, resourceType = 'auto') {
    return new Promise((resolve, reject) => {
        if (!file) { reject(new Error('Нет файла')); return; }
        if (file.size > 20 * 1024 * 1024) { showNotification('Файл >20 МБ', 'error'); reject(new Error('Слишком большой')); return; }
        showUploadProgress(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        let uploadUrl = CLOUDINARY_API_URL;
        if (resourceType === 'image') uploadUrl = CLOUDINARY_API_URL.replace('/upload', '/image/upload');
        if (resourceType === 'video') uploadUrl = CLOUDINARY_API_URL.replace('/upload', '/video/upload');
        fetch(uploadUrl, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                showUploadProgress(false);
                if (data.secure_url) resolve({ url: data.secure_url });
                else { showNotification('Ошибка загрузки', 'error'); reject(new Error(data.error?.message)); }
            })
            .catch(err => { showUploadProgress(false); showNotification('Ошибка сети', 'error'); reject(err); });
    });
}

function showUploadProgress(show) {
    let div = document.getElementById('upload-progress');
    if (show && !div) {
        div = document.createElement('div');
        div.id = 'upload-progress';
        div.className = 'upload-progress';
        div.innerHTML = '<div class="upload-progress-content"><div class="spinner"></div><p>Загрузка...</p></div>';
        document.body.appendChild(div);
    } else if (!show && div) div.remove();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) showImagePreview(file);
    event.target.value = '';
}

function showImagePreview(file) {
    pendingImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
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
    if (!pendingImageFile || !currentChatId) { showNotification('Ошибка', 'error'); return; }
    const caption = document.getElementById('image-caption').value.trim();
    const file = pendingImageFile;
    closeImagePreview();
    uploadToCloudinary(file, 'image')
        .then(data => {
            const message = {
                type: 'image',
                imageUrl: data.url,
                caption: caption,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('messages/' + currentChatId).push(message);
        })
        .then(() => {
            return database.ref('chats/' + currentChatId).update({
                lastMessage: '📷 Фото',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .then(() => showNotification('Фото отправлено!', 'success'))
        .catch(err => showNotification('Ошибка отправки фото', 'error'));
    pendingImageFile = null;
}

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                sendAudioMessage(audioBlob);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            const btn = document.getElementById('voice-record-btn');
            if (btn) btn.classList.add('recording');
        })
        .catch(err => showNotification('Нет доступа к микрофону', 'error'));
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        const btn = document.getElementById('voice-record-btn');
        if (btn) btn.classList.remove('recording');
    }
}

function sendAudioMessage(blob) {
    if (!currentChatId) return;
    const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
    uploadToCloudinary(file, 'video')
        .then(data => {
            const message = {
                type: 'audio',
                audioUrl: data.url,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('messages/' + currentChatId).push(message);
        })
        .then(() => {
            return database.ref('chats/' + currentChatId).update({
                lastMessage: '🎤 Голосовое',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .catch(err => showNotification('Ошибка загрузки аудио', 'error'));
}

function startVideoCircle() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            videoRecorder = new MediaRecorder(stream);
            videoChunks = [];
            videoRecorder.ondataavailable = e => videoChunks.push(e.data);
            videoRecorder.onstop = () => {
                const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
                sendVideoMessage(videoBlob);
                stream.getTracks().forEach(t => t.stop());
            };
            videoRecorder.start();
            isVideoRecording = true;
            const btn = document.getElementById('video-record-btn');
            if (btn) btn.classList.add('recording');
            setTimeout(() => { if (isVideoRecording) stopVideoCircle(); }, 15000);
        })
        .catch(err => showNotification('Нет доступа к камере', 'error'));
}

function stopVideoCircle() {
    if (videoRecorder && isVideoRecording) {
        videoRecorder.stop();
        isVideoRecording = false;
        const btn = document.getElementById('video-record-btn');
        if (btn) btn.classList.remove('recording');
    }
}

function sendVideoMessage(blob) {
    if (!currentChatId) return;
    const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
    uploadToCloudinary(file, 'video')
        .then(data => {
            const message = {
                type: 'video_circle',
                videoUrl: data.url,
                senderId: currentUser.uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            return database.ref('messages/' + currentChatId).push(message);
        })
        .then(() => {
            return database.ref('chats/' + currentChatId).update({
                lastMessage: '📹 Кружок',
                lastMessageTime: firebase.database.ServerValue.TIMESTAMP
            });
        })
        .catch(err => showNotification('Ошибка загрузки видео', 'error'));
}

function previewGroupAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        groupAvatarFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            const preview = document.getElementById('group-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewChannelAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        channelAvatarFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            const preview = document.getElementById('channel-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
    }
}

function previewEditAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const preview = document.getElementById('edit-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile = file;
    }
}
