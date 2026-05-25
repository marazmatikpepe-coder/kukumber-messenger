// KUKUMBER MESSENGER - CALLS.JS (РАБОЧАЯ ВЕРСИЯ)

var localStream = null;
var currentPeerConnection = null;
var callTimerInterval = null;
var callSecondsCount = 0;
var currentCallId = null;
var isCallActive = false;

// Надёжная конфигурация ICE (STUN + TURN)
var iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.ekiga.net' },
        { urls: 'stun:stun.ideasip.com' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// Инициализация
function initializeCalls() {
    console.log('📞 Система звонков инициализирована');
}

// Проверка, можно ли звонить
function canMakeCall() {
    if (!currentChatId || !currentChatData) {
        showNotification('Сначала выберите чат', 'error');
        return false;
    }
    if (currentChatData.type !== 'private') {
        showNotification('Звонки доступны только в личных чатах', 'info');
        return false;
    }
    if (!currentChatData.otherUserId) {
        showNotification('Ошибка: собеседник не найден', 'error');
        return false;
    }
    return true;
}

// Начать голосовой звонок
window.startVoiceCall = function() {
    if (!canMakeCall()) return;
    startCall(false);
};

// Начать видеозвонок
window.startVideoCall = function() {
    if (!canMakeCall()) return;
    startCall(true);
};

// Основная функция звонка
async function startCall(withVideo) {
    var otherUserId = currentChatData.otherUserId;
    currentCallId = 'call_' + currentChatId + '_' + Date.now();
    
    showNotification('📞 Набираем номер...', 'info');
    
    // Получаем данные собеседника
    var otherUserSnap = await database.ref('users/' + otherUserId).once('value');
    var otherUser = otherUserSnap.val();
    var otherUserName = otherUser?.username || 'Пользователь';
    
    try {
        // Запрашиваем доступ к медиа
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: withVideo, 
            audio: true 
        });
        
        // Показываем модальное окно звонка
        showCallModal(withVideo);
        document.getElementById('call-username').textContent = otherUserName;
        document.getElementById('call-status').textContent = 'Соединение...';
        
        if (withVideo && localStream.getVideoTracks().length > 0) {
            document.getElementById('local-video').srcObject = localStream;
        }
        
        // Создаём PeerConnection
        currentPeerConnection = new RTCPeerConnection(iceServers);
        
        // Добавляем треки
        localStream.getTracks().forEach(track => {
            currentPeerConnection.addTrack(track, localStream);
        });
        
        // Обработка ICE-кандидатов
        currentPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                database.ref('calls/' + currentCallId + '/candidates').push({
                    to: otherUserId,
                    candidate: event.candidate,
                    from: currentUser.uid
                });
            }
        };
        
        // Обработка входящего потока (видео/аудио от собеседника)
        currentPeerConnection.ontrack = (event) => {
            if (event.streams[0]) {
                if (withVideo) {
                    document.getElementById('remote-video').srcObject = event.streams[0];
                }
                document.getElementById('call-status').textContent = 'В разговоре';
                startCallTimer();
                isCallActive = true;
            }
        };
        
        // Создаём offer
        var offer = await currentPeerConnection.createOffer();
        await currentPeerConnection.setLocalDescription(offer);
        
        // Отправляем offer собеседнику
        await database.ref('calls/' + currentCallId + '/offer').set({
            from: currentUser.uid,
            to: otherUserId,
            sdp: currentPeerConnection.localDescription,
            type: withVideo ? 'video' : 'audio'
        });
        
        // Устанавливаем слушателей для ответа и кандидатов
        setupCallListeners(otherUserId);
        
        // Устанавливаем таймаут на случай, если собеседник не ответит
        setTimeout(() => {
            if (!isCallActive) {
                var statusEl = document.getElementById('call-status');
                if (statusEl && statusEl.textContent !== 'В разговоре') {
                    statusEl.textContent = 'Нет ответа';
                    showNotification('Собеседник не отвечает', 'error');
                    setTimeout(() => endCall(), 2000);
                }
            }
        }, 30000);
        
    } catch (err) {
        console.error('Ошибка звонка:', err);
        showNotification('Не удалось получить доступ к микрофону/камере', 'error');
        endCall();
    }
}

// Приём входящего звонка
window.acceptCall = async function() {
    var callData = window.incomingCallData;
    if (!callData) return;
    
    var withVideo = callData.type === 'video';
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: withVideo, 
            audio: true 
        });
        
        showCallModal(withVideo);
        document.getElementById('call-username').textContent = callData.fromName;
        document.getElementById('call-status').textContent = 'Соединение...';
        
        if (withVideo && localStream.getVideoTracks().length > 0) {
            document.getElementById('local-video').srcObject = localStream;
        }
        
        currentPeerConnection = new RTCPeerConnection(iceServers);
        
        localStream.getTracks().forEach(track => {
            currentPeerConnection.addTrack(track, localStream);
        });
        
        currentPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                database.ref('calls/' + callData.callId + '/candidates').push({
                    to: callData.fromId,
                    candidate: event.candidate,
                    from: currentUser.uid
                });
            }
        };
        
        currentPeerConnection.ontrack = (event) => {
            if (event.streams[0]) {
                if (withVideo) {
                    document.getElementById('remote-video').srcObject = event.streams[0];
                }
                document.getElementById('call-status').textContent = 'В разговоре';
                startCallTimer();
                isCallActive = true;
            }
        };
        
        // Устанавливаем remote description из offer
        await currentPeerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer.sdp));
        
        // Создаём answer
        var answer = await currentPeerConnection.createAnswer();
        await currentPeerConnection.setLocalDescription(answer);
        
        // Отправляем answer
        await database.ref('calls/' + callData.callId + '/answer').set({
            from: currentUser.uid,
            to: callData.fromId,
            sdp: currentPeerConnection.localDescription
        });
        
        setupCallListeners(callData.fromId);
        
        // Закрываем модалку входящего звонка
        document.getElementById('incoming-call-modal').classList.add('hidden');
        stopRingtone();
        
    } catch (err) {
        console.error('Ошибка принятия звонка:', err);
        showNotification('Не удалось принять звонок', 'error');
        endCall();
    }
};

// Отклонение звонка
window.rejectCall = function() {
    if (window.incomingCallData) {
        database.ref('calls/' + window.incomingCallData.callId + '/reject').set({
            from: currentUser.uid,
            to: window.incomingCallData.fromId
        });
    }
    document.getElementById('incoming-call-modal').classList.add('hidden');
    stopRingtone();
    showNotification('Звонок отклонён', 'info');
};

// Настройка слушателей для ответа и кандидатов
function setupCallListeners(otherUserId) {
    if (!currentCallId) return;
    
    // Слушаем answer
    database.ref('calls/' + currentCallId + '/answer').on('value', (snapshot) => {
        var data = snapshot.val();
        if (data && data.from === otherUserId && currentPeerConnection) {
            currentPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
    });
    
    // Слушаем отказ
    database.ref('calls/' + currentCallId + '/reject').on('value', (snapshot) => {
        var data = snapshot.val();
        if (data && data.from === otherUserId) {
            showNotification('Звонок отклонён', 'info');
            endCall();
        }
    });
    
    // Слушаем ICE-кандидаты
    database.ref('calls/' + currentCallId + '/candidates').on('child_added', (snapshot) => {
        var data = snapshot.val();
        if (data && data.to === currentUser.uid && currentPeerConnection) {
            currentPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
}

// Слушатель входящих звонков (вызывать при открытии чата)
window.listenForIncomingCalls = function() {
    if (!currentUser || !currentUser.uid) return;
    
    database.ref('calls/').orderByChild('to').equalTo(currentUser.uid).on('child_added', (snapshot) => {
        var callData = snapshot.val();
        if (callData && callData.offer && !callData.answer && !callData.reject) {
            // Проверяем, что это не от самого себя
            if (callData.from === currentUser.uid) return;
            
            // Сохраняем данные звонка
            window.incomingCallData = {
                callId: snapshot.key,
                fromId: callData.from,
                toId: callData.to,
                offer: callData.offer,
                type: callData.offer.type || 'audio'
            };
            
            // Получаем имя звонящего
            database.ref('users/' + callData.from + '/username').once('value').then((snap) => {
                window.incomingCallData.fromName = snap.val() || 'Пользователь';
                document.getElementById('incoming-caller-name').textContent = window.incomingCallData.fromName;
                
                // Показываем модалку входящего звонка
                document.getElementById('incoming-call-modal').classList.remove('hidden');
                playRingtone();
            });
        }
    });
};

// Завершение звонка
window.endCall = function() {
    stopCallTimer();
    isCallActive = false;
    
    if (currentPeerConnection) {
        currentPeerConnection.close();
        currentPeerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (currentCallId) {
        database.ref('calls/' + currentCallId).remove();
        currentCallId = null;
    }
    
    // Скрываем модальные окна
    document.getElementById('call-modal').classList.add('hidden');
    document.getElementById('incoming-call-modal').classList.add('hidden');
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    
    showNotification('Звонок завершён', 'info');
};

// Таймер звонка
function startCallTimer() {
    callSecondsCount = 0;
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        callSecondsCount++;
        var mins = Math.floor(callSecondsCount / 60).toString().padStart(2, '0');
        var secs = (callSecondsCount % 60).toString().padStart(2, '0');
        var timeStr = mins + ':' + secs;
        document.getElementById('call-timer').textContent = timeStr;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    document.getElementById('call-timer').textContent = '00:00';
}

// Показать модальное окно звонка
function showCallModal(isVideo) {
    var modal = document.getElementById('call-modal');
    var fullscreen = document.getElementById('call-fullscreen');
    var videosDiv = document.getElementById('call-videos');
    var avatarContainer = document.getElementById('call-avatar-container');
    var videoBtn = document.getElementById('video-btn');
    
    if (modal) modal.classList.remove('hidden');
    if (fullscreen) fullscreen.classList.remove('hidden');
    
    if (isVideo) {
        if (videosDiv) videosDiv.classList.remove('hidden');
        if (avatarContainer) avatarContainer.classList.add('hidden');
        if (videoBtn) videoBtn.style.display = 'flex';
    } else {
        if (videosDiv) videosDiv.classList.add('hidden');
        if (avatarContainer) avatarContainer.classList.remove('hidden');
        if (videoBtn) videoBtn.style.display = 'none';
    }
}

// Включить/выключить микрофон
window.toggleCallMute = function() {
    if (!localStream) return;
    var audioTracks = localStream.getAudioTracks();
    if (audioTracks.length) {
        var isMuted = !audioTracks[0].enabled;
        audioTracks.forEach(track => track.enabled = !isMuted);
        var micBtn = document.getElementById('call-mic-btn');
        if (micBtn) {
            if (isMuted) {
                micBtn.classList.add('muted');
            } else {
                micBtn.classList.remove('muted');
            }
        }
    }
};

// Включить/выключить видео
window.toggleVideo = function() {
    if (!localStream) return;
    var videoTracks = localStream.getVideoTracks();
    if (videoTracks.length) {
        var isOff = !videoTracks[0].enabled;
        videoTracks.forEach(track => track.enabled = !isOff);
        var videoBtn = document.getElementById('video-btn');
        if (videoBtn) {
            videoBtn.textContent = isOff ? '📹' : '📷';
        }
    }
};

// Звук звонка
var ringtoneInterval = null;
function playRingtone() {
    if (ringtoneInterval) return;
    ringtoneInterval = setInterval(() => {
        try {
            var audioContext = new (window.AudioContext || window.webkitAudioContext)();
            var oscillator = audioContext.createOscillator();
            var gain = audioContext.createGain();
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.frequency.value = 440;
            gain.gain.value = 0.15;
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 300);
        } catch(e) {
            console.log('Ошибка воспроизведения звука:', e);
        }
    }, 1500);
}

function stopRingtone() {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
}

// Инициализация
initializeCalls();

// Запускаем прослушивание входящих звонков после авторизации
if (currentUser && currentUser.uid) {
    listenForIncomingCalls();
}

console.log('✅ calls.js загружен');
