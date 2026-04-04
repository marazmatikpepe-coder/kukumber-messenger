// ========================================
// KUKUMBER MESSENGER - VIDEO/AUDIO CALLS
// ========================================

let peer = null;
let localStream = null;
let currentCall = null;
let incomingCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;

// ========================================
// ИНИЦИАЛИЗАЦИЯ PEERJS
// ========================================

function initializePeer() {
    if (peer) return;
    if (!currentUser) return;
    
    peer = new Peer(currentUser.uid, {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        console.log('PeerJS подключен, ID:', id);
    });

    peer.on('call', (call) => {
        console.log('Входящий звонок от:', call.peer);
        handleIncomingCall(call);
    });

    peer.on('error', (error) => {
        console.error('PeerJS ошибка:', error);
        
        if (error.type === 'peer-unavailable') {
            showNotification('Пользователь недоступен', 'error');
        } else {
            showNotification('Ошибка соединения', 'error');
        }
        
        endCall();
    });
    
    peer.on('disconnected', () => {
        console.log('PeerJS отключен, переподключаем...');
        peer.reconnect();
    });
}

// ========================================
// ИСХОДЯЩИЕ ЗВОНКИ
// ========================================

async function startVoiceCall() {
    await startCall(false);
}

async function startVideoCall() {
    await startCall(true);
}

async function startCall(withVideo) {
    if (!currentChatId || !currentChatUser) {
        showNotification('Сначала выберите чат', 'error');
        return;
    }
    
    initializePeer();
    
    try {
        // Запрашиваем доступ к медиа
        localStream = await navigator.mediaDevices.getUserMedia({
            video: withVideo,
            audio: true
        });
        
        isVideoEnabled = withVideo;
        isAudioEnabled = true;
        
        // Показываем модальное окно звонка
        showCallModal(withVideo);
        
        // Показываем локальное видео
        if (withVideo) {
            document.getElementById('local-video').srcObject = localStream;
            document.getElementById('call-avatar').classList.add('hidden');
        } else {
            document.getElementById('call-avatar').classList.remove('hidden');
        }
        
        // Получаем ID собеседника
        const otherUserId = currentChatUser.odUserId;
        
        document.getElementById('call-username').textContent = currentChatUser.username || 'Пользователь';
        document.getElementById('call-status').textContent = 'Вызов...';
        
        // Звоним
        currentCall = peer.call(otherUserId, localStream, {
            metadata: {
                callerName: currentUserData?.username || 'Пользователь',
                isVideo: withVideo
            }
        });
        
        setupCallListeners(currentCall);
        
    } catch (error) {
        console.error('Ошибка начала звонка:', error);
        
        if (error.name === 'NotAllowedError') {
            showNotification('Разрешите доступ к камере/микрофону', 'error');
        } else if (error.name === 'NotFoundError') {
            showNotification('Камера или микрофон не найдены', 'error');
        } else {
            showNotification('Не удалось начать звонок', 'error');
        }
        
        endCall();
    }
}

// ========================================
// ВХОДЯЩИЕ ЗВОНКИ
// ========================================

function handleIncomingCall(call) {
    incomingCall = call;
    
    const callerName = call.metadata?.callerName || 'Неизвестный';
    const isVideo = call.metadata?.isVideo || false;
    
    // Показываем модальное окно входящего звонка
    document.getElementById('incoming-call-username').textContent = callerName;
    document.getElementById('incoming-call-type').textContent = isVideo ? 'Видеозвонок' : 'Аудиозвонок';
    document.getElementById('incoming-call-modal').classList.remove('hidden');
    
    // Воспроизводим звук звонка (опционально)
    playRingtone();
}

async function acceptCall() {
    if (!incomingCall) return;
    
    const isVideo = incomingCall.metadata?.isVideo || false;
    
    try {
        // Запрашиваем медиа
        localStream = await navigator.mediaDevices.getUserMedia({
            video: isVideo,
            audio: true
        });
        
        isVideoEnabled = isVideo;
        isAudioEnabled = true;
        
        // Скрываем окно входящего звонка
        document.getElementById('incoming-call-modal').classList.add('hidden');
        stopRingtone();
        
        // Показываем окно звонка
        showCallModal(isVideo);
        
        if (isVideo) {
            document.getElementById('local-video').srcObject = localStream;
            document.getElementById('call-avatar').classList.add('hidden');
        } else {
            document.getElementById('call-avatar').classList.remove('hidden');
        }
        
        document.getElementById('call-username').textContent = incomingCall.metadata?.callerName || 'Пользователь';
        document.getElementById('call-status').textContent = 'Соединение...';
        
        // Отвечаем на звонок
        incomingCall.answer(localStream);
        currentCall = incomingCall;
        incomingCall = null;
        
        setupCallListeners(currentCall);
        
    } catch (error) {
        console.error('Ошибка принятия звонка:', error);
        showNotification('Не удалось принять звонок', 'error');
        rejectCall();
    }
}

function rejectCall() {
    if (incomingCall) {
        incomingCall.close();
        incomingCall = null;
    }
    
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
}

// ========================================
// ОБРАБОТКА ЗВОНКА
// ========================================

function setupCallListeners(call) {
    call.on('stream', (remoteStream) => {
        console.log('Получен удалённый поток');
        document.getElementById('remote-video').srcObject = remoteStream;
        document.getElementById('call-status').textContent = 'Подключено';
        
        // Запускаем таймер
        startCallTimer();
    });
    
    call.on('close', () => {
        console.log('Звонок завершён');
        endCall();
    });
    
    call.on('error', (error) => {
        console.error('Ошибка звонка:', error);
        showNotification('Ошибка во время звонка', 'error');
        endCall();
    });
}

// ========================================
// УПРАВЛЕНИЕ ЗВОНКОМ
// ========================================

function toggleMute() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioEnabled = !isAudioEnabled;
        audioTrack.enabled = isAudioEnabled;
        
        const btn = document.getElementById('mute-btn');
        btn.textContent = isAudioEnabled ? '🎤' : '🔇';
        btn.classList.toggle('muted', !isAudioEnabled);
    }
}

function toggleVideo() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoEnabled = !isVideoEnabled;
        videoTrack.enabled = isVideoEnabled;
        
        const btn = document.getElementById('video-btn');
        btn.textContent = isVideoEnabled ? '📹' : '📷';
        btn.classList.toggle('muted', !isVideoEnabled);
    }
}

function endCall() {
    // Останавливаем таймер
    stopCallTimer();
    
    // Закрываем звонок
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    // Останавливаем медиа потоки
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Очищаем видео элементы
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    
    // Скрываем модальное окно
    document.getElementById('call-modal').classList.add('hidden');
    
    // Сбрасываем состояние
    isVideoEnabled = true;
    isAudioEnabled = true;
    
    document.getElementById('mute-btn').textContent = '🎤';
    document.getElementById('mute-btn').classList.remove('muted');
    document.getElementById('video-btn').textContent = '📹';
    document.getElementById('video-btn').classList.remove('muted');
}

function showCallModal(isVideo) {
    document.getElementById('call-modal').classList.remove('hidden');
    document.getElementById('video-btn').style.display = isVideo ? 'flex' : 'none';
    
    if (!isVideo) {
        document.getElementById('local-video').style.display = 'none';
    } else {
        document.getElementById('local-video').style.display = 'block';
    }
}
