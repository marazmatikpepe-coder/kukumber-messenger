// ========================================
// KUKUMBER MESSENGER - CALLS
// ========================================

let peer = null;
let localStream = null;
let currentCall = null;
let incomingCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let callTimerInterval = null;
let callSecondsCount = 0;

// ========================================
// ТАЙМЕР ЗВОНКА (ДОБАВЛЕНО!)
// ========================================

function startCallTimer() {
    callSecondsCount = 0;
    updateCallTimerDisplay();
    
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
    }
    
    callTimerInterval = setInterval(function() {
        callSecondsCount++;
        updateCallTimerDisplay();
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callSecondsCount = 0;
    
    var timerEl = document.getElementById('call-timer');
    if (timerEl) {
        timerEl.textContent = '00:00';
    }
}

function updateCallTimerDisplay() {
    var mins = Math.floor(callSecondsCount / 60).toString().padStart(2, '0');
    var secs = (callSecondsCount % 60).toString().padStart(2, '0');
    
    var timerEl = document.getElementById('call-timer');
    if (timerEl) {
        timerEl.textContent = mins + ':' + secs;
    }
}

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
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', function(id) {
            console.log('PeerJS подключен:', id);
        });

        peer.on('call', function(call) {
            console.log('Входящий звонок');
            handleIncomingCall(call);
        });

        peer.on('error', function(error) {
            console.log('PeerJS ошибка:', error.type);
            if (error.type === 'peer-unavailable') {
                showNotification('Пользователь недоступен', 'error');
            }
            endCall();
        });
        
        peer.on('disconnected', function() {
            console.log('PeerJS отключен');
        });
    } catch (e) {
        console.error('Ошибка PeerJS:', e);
    }
}

// ========================================
// ИСХОДЯЩИЕ ЗВОНКИ
// ========================================

function startVoiceCall() {
    startCall(false);
}

function startVideoCall() {
    startCall(true);
}

function startCall(withVideo) {
    if (!currentChatId || !currentChatUser) {
        showNotification('Сначала выберите чат', 'error');
        return;
    }
    
    if (currentChatUser.type === 'group' || currentChatUser.type === 'channel') {
        showNotification('Звонки доступны только в личных чатах', 'info');
        return;
    }
    
    initializePeer();
    
    if (!peer) {
        showNotification('Ошибка подключения', 'error');
        return;
    }
    
    navigator.mediaDevices.getUserMedia({
        video: withVideo,
        audio: true
    })
    .then(function(stream) {
        localStream = stream;
        isVideoEnabled = withVideo;
        isAudioEnabled = true;
        
        showCallModal(withVideo);
        
        var localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
        
        if (withVideo) {
            document.getElementById('call-avatar').classList.add('hidden');
        } else {
            document.getElementById('call-avatar').classList.remove('hidden');
        }
        
        var otherUserId = currentChatUser.otherUserId;
        
        if (!otherUserId) {
            showNotification('Ошибка: собеседник не найден', 'error');
            endCall();
            return;
        }
        
        document.getElementById('call-username').textContent = currentChatUser.otherUser?.username || 'Пользователь';
        document.getElementById('call-status').textContent = 'Вызов...';
        
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
    })
    .catch(function(error) {
        console.error('Ошибка медиа:', error);
        if (error.name === 'NotAllowedError') {
            showNotification('Разрешите доступ к камере/микрофону', 'error');
        } else {
            showNotification('Не удалось получить доступ к камере', 'error');
        }
        endCall();
    });
}

// ========================================
// ВХОДЯЩИЕ ЗВОНКИ
// ========================================

function handleIncomingCall(call) {
    incomingCall = call;
    
    var callerName = call.metadata?.callerName || 'Неизвестный';
    var isVideo = call.metadata?.isVideo || false;
    
    document.getElementById('incoming-call-username').textContent = callerName;
    document.getElementById('incoming-call-type').textContent = isVideo ? 'Видеозвонок' : 'Аудиозвонок';
    document.getElementById('incoming-call-modal').classList.remove('hidden');
    
    playRingtone();
}

function acceptCall() {
    if (!incomingCall) return;
    
    var isVideo = incomingCall.metadata?.isVideo || false;
    
    navigator.mediaDevices.getUserMedia({
        video: isVideo,
        audio: true
    })
    .then(function(stream) {
        localStream = stream;
        isVideoEnabled = isVideo;
        isAudioEnabled = true;
        
        document.getElementById('incoming-call-modal').classList.add('hidden');
        stopRingtone();
        
        showCallModal(isVideo);
        
        var localVideo = document.getElementById('local-video');
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
        
        incomingCall.answer(localStream);
        currentCall = incomingCall;
        incomingCall = null;
        
        setupCallListeners(currentCall);
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось принять звонок', 'error');
        rejectCall();
    });
}

function rejectCall() {
    if (incomingCall) {
        try { incomingCall.close(); } catch(e) {}
        incomingCall = null;
    }
    
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
}

// ========================================
// ОБРАБОТКА ЗВОНКА
// ========================================

function setupCallListeners(call) {
    if (!call) return;
    
    call.on('stream', function(remoteStream) {
        console.log('Получен удалённый поток');
        var remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
            remoteVideo.srcObject = remoteStream;
        }
        
        document.getElementById('call-status').textContent = 'Подключено';
        startCallTimer();
    });
    
    call.on('close', function() {
        console.log('Звонок завершён');
        endCall();
    });
    
    call.on('error', function(error) {
        console.error('Ошибка звонка:', error);
        endCall();
    });
}

// ========================================
// УПРАВЛЕНИЕ ЗВОНКОМ
// ========================================

function toggleMute() {
    if (!localStream) return;
    
    var audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        isAudioEnabled = !isAudioEnabled;
        audioTracks.forEach(function(track) {
            track.enabled = isAudioEnabled;
        });
        
        var btn = document.getElementById('mute-btn');
        if (btn) {
            btn.textContent = isAudioEnabled ? '🎤' : '🔇';
            if (isAudioEnabled) {
                btn.classList.remove('muted');
            } else {
                btn.classList.add('muted');
            }
        }
    }
}

function toggleVideo() {
    if (!localStream) return;
    
    var videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
        isVideoEnabled = !isVideoEnabled;
        videoTracks.forEach(function(track) {
            track.enabled = isVideoEnabled;
        });
        
        var btn = document.getElementById('video-btn');
        if (btn) {
            btn.textContent = isVideoEnabled ? '📹' : '📷';
            if (isVideoEnabled) {
                btn.classList.remove('muted');
            } else {
                btn.classList.add('muted');
            }
        }
    }
}

function endCall() {
    stopCallTimer();
    
    if (currentCall) {
        try { currentCall.close(); } catch(e) {}
        currentCall = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(function(track) {
            try { track.stop(); } catch(e) {}
        });
        localStream = null;
    }
    
    var localVideo = document.getElementById('local-video');
    var remoteVideo = document.getElementById('remote-video');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    
    var modal = document.getElementById('call-modal');
    if (modal) modal.classList.add('hidden');
    
    isVideoEnabled = true;
    isAudioEnabled = true;
    
    var muteBtn = document.getElementById('mute-btn');
    var videoBtn = document.getElementById('video-btn');
    
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
    var modal = document.getElementById('call-modal');
    if (modal) modal.classList.remove('hidden');
    
    var videoBtn = document.getElementById('video-btn');
    if (videoBtn) videoBtn.style.display = isVideo ? '' : 'none';
    
    var localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.style.display = isVideo ? '' : 'none';
}

// ========================================
// ЗВУК ЗВОНКА
// ========================================

var ringtoneInterval = null;
var ringtoneCtx = null;

function playRingtone() {
    try {
        ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        function beep() {
            if (!ringtoneCtx) return;
            var osc = ringtoneCtx.createOscillator();
            var gain = ringtoneCtx.createGain();
            osc.connect(gain);
            gain.connect(ringtoneCtx.destination);
            osc.frequency.value = 440;
            gain.gain.value = 0.2;
            osc.start();
            setTimeout(function() { osc.stop(); }, 200);
        }
        
        beep();
        ringtoneInterval = setInterval(beep, 1000);
        setTimeout(stopRingtone, 30000);
    } catch(e) {}
}

function stopRingtone() {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
    if (ringtoneCtx) {
        try { ringtoneCtx.close(); } catch(e) {}
        ringtoneCtx = null;
    }
}
