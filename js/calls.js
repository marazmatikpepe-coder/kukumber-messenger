// ========================================
// KUKUMBER MESSENGER - VIDEO/AUDIO CALLS
// ========================================

let peer = null;
let localStream = null;
let currentCall = null;
let incomingCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let callTimer = null;
let callSeconds = 0;

// ========================================
// ИНИЦИАЛИЗАЦИЯ PEERJS
// ========================================

function initializePeer() {
    if (peer) return;
    if (!currentUser) return;
    
    try {
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
            // Не показываем ошибку пользователю при потере соединения
            if (error.type === 'peer-unavailable') {
                showNotification('Пользователь недоступен', 'error');
            }
            endCall();
        });
        
        peer.on('disconnected', () => {
            console.log('PeerJS отключен');
            // Пытаемся переподключиться
            if (peer && !peer.destroyed) {
                setTimeout(() => {
                    try {
                        peer.reconnect();
                    } catch (e) {
                        console.log('Не удалось переподключиться');
                    }
                }, 3000);
            }
        });
    } catch (e) {
        console.error('Ошибка инициализации PeerJS:', e);
    }
}

// ========================================
// ТАЙМЕР ЗВОНКА
// ========================================

function startCallTimer() {
    callSeconds = 0;
    updateCallTimerDisplay();
    
    if (callTimer) {
        clearInterval(callTimer);
    }
    
    callTimer = setInterval(() => {
        callSeconds++;
        updateCallTimerDisplay();
    }, 1000);
}

function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    callSeconds = 0;
    
    const timerEl = document.getElementById('call-timer');
    if (timerEl) {
        timerEl.textContent = '00:00';
    }
}

function updateCallTimerDisplay() {
    const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
    const secs = (callSeconds % 60).toString().padStart(2, '0');
    
    const timerEl = document.getElementById('call-timer');
    if (timerEl) {
        timerEl.textContent = `${mins}:${secs}`;
    }
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
    
    // Проверяем тип чата
    if (currentChatUser.type === 'group' || currentChatUser.type === 'channel') {
        showNotification('Звонки доступны только в личных чатах', 'info');
        return;
    }
    
    initializePeer();
    
    if (!peer) {
        showNotification('Ошибка подключения', 'error');
        return;
    }
    
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
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
        
        if (withVideo) {
            document.getElementById('call-avatar').classList.add('hidden');
        } else {
            document.getElementById('call-avatar').classList.remove('hidden');
        }
        
        // Получаем ID собеседника
        const otherUserId = currentChatUser.otherUserId;
        
        if (!otherUserId) {
            showNotification('Не удалось определить собеседника', 'error');
            endCall();
            return;
        }
        
        const chatUsername = document.getElementById('chat-username');
        document.getElementById('call-username').textContent = chatUsername ? chatUsername.textContent : 'Пользователь';
        document.getElementById('call-status').textContent = 'Вызов...';
        
        // Звоним
        currentCall = peer.call(otherUserId, localStream, {
            metadata: {
                callerName: currentUserData?.username || 'Пользователь',
                isVideo: withVideo
            }
        });
        
        if (currentCall) {
            setupCallListeners(currentCall);
        } else {
            showNotification('Не удалось начать звонок', 'error');
            endCall();
        }
        
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
    const usernameEl = document.getElementById('incoming-call-username');
    const typeEl = document.getElementById('incoming-call-type');
    const modal = document.getElementById('incoming-call-modal');
    
    if (usernameEl) usernameEl.textContent = callerName;
    if (typeEl) typeEl.textContent = isVideo ? 'Видеозвонок' : 'Аудиозвонок';
    if (modal) modal.classList.remove('hidden');
    
    // Воспроизводим звук звонка
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
        const incomingModal = document.getElementById('incoming-call-modal');
        if (incomingModal) incomingModal.classList.add('hidden');
        stopRingtone();
        
        // Показываем окно звонка
        showCallModal(isVideo);
        
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
        
        if (isVideo) {
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
        try {
            incomingCall.close();
        } catch (e) {}
        incomingCall = null;
    }
    
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.classList.add('hidden');
    stopRingtone();
}

// ========================================
// ОБРАБОТКА ЗВОНКА
// ========================================

function setupCallListeners(call) {
    if (!call) return;
    
    call.on('stream', (remoteStream) => {
        console.log('Получен удалённый поток');
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
            remoteVideo.srcObject = remoteStream;
        }
        
        const statusEl = document.getElementById('call-status');
        if (statusEl) statusEl.textContent = 'Подключено';
        
        // Запускаем таймер
        startCallTimer();
    });
    
    call.on('close', () => {
        console.log('Звонок завершён');
        endCall();
    });
    
    call.on('error', (error) => {
        console.error('Ошибка звонка:', error);
        endCall();
    });
}

// ========================================
// УПРАВЛЕНИЕ ЗВОНКОМ
// ========================================

function toggleMute() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        isAudioEnabled = !isAudioEnabled;
        audioTracks.forEach(track => track.enabled = isAudioEnabled);
        
        const btn = document.getElementById('mute-btn');
        if (btn) {
            btn.textContent = isAudioEnabled ? '🎤' : '🔇';
            btn.classList.toggle('muted', !isAudioEnabled);
        }
    }
}

function toggleVideo() {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
        isVideoEnabled = !isVideoEnabled;
        videoTracks.forEach(track => track.enabled = isVideoEnabled);
        
        const btn = document.getElementById('video-btn');
        if (btn) {
            btn.textContent = isVideoEnabled ? '📹' : '📷';
            btn.classList.toggle('muted', !isVideoEnabled);
        }
    }
}

function endCall() {
    // Останавливаем таймер
    stopCallTimer();
    
    // Закрываем звонок
    if (currentCall) {
        try {
            currentCall.close();
        } catch (e) {}
        currentCall = null;
    }
    
    // Останавливаем медиа потоки
    if (localStream) {
        localStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {}
        });
        localStream = null;
    }
    
    // Очищаем видео элементы
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    
    // Скрываем модальное окно
    const modal = document.getElementById('call-modal');
    if (modal) modal.classList.add('hidden');
    
    // Сбрасываем состояние
    isVideoEnabled = true;
    isAudioEnabled = true;
    
    const muteBtn = document.getElementById('mute-btn');
    const videoBtn = document.getElementById('video-btn');
    
    if (muteBtn) {
        muteBtn.textContent = '🎤';
        muteBtn.classList.remove('muted');
    }
    if (videoBtn) {
        videoBtn.textContent = '📹';
        videoBtn.classList.remove('muted');
    }
}

function showCallModal(isVideo) {
    const modal = document.getElementById('call-modal');
    if (modal) modal.classList.remove('hidden');
    
    const videoBtn = document.getElementById('video-btn');
    if (videoBtn) videoBtn.style.display = isVideo ? 'flex' : 'none';
    
    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.style.display = isVideo ? 'block' : 'none';
}

// ========================================
// ЗВУК ЗВОНКА
// ========================================

let ringtoneAudio = null;
let ringtoneContext = null;

function playRingtone() {
    try {
        // Используем Web Audio API для простого звука
        ringtoneContext = new (window.AudioContext || window.webkitAudioContext)();
        
        function playBeep() {
            if (!ringtoneContext) return;
            
            const oscillator = ringtoneContext.createOscillator();
            const gainNode = ringtoneContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ringtoneContext.destination);
            
            oscillator.frequency.value = 440;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            
            setTimeout(() => {
                oscillator.stop();
            }, 200);
        }
        
        playBeep();
        ringtoneAudio = setInterval(playBeep, 1000);
        
        // Останавливаем через 30 секунд
        setTimeout(stopRingtone, 30000);
        
    } catch (e) {
        console.log('Не удалось воспроизвести звук:', e);
    }
}

function stopRingtone() {
    if (ringtoneAudio) {
        clearInterval(ringtoneAudio);
        ringtoneAudio = null;
    }
    if (ringtoneContext) {
        try {
            ringtoneContext.close();
        } catch (e) {}
        ringtoneContext = null;
    }
}
