let peer = null;
let localStream = null;
let currentCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;

// Инициализация PeerJS
function initializePeer() {
    if (!peer) {
        peer = new Peer(currentUser.uid, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('Peer ID:', id);
        });

        peer.on('call', (call) => {
            handleIncomingCall(call);
        });

        peer.on('error', (error) => {
            console.error('Peer error:', error);
            showNotification('Ошибка соединения', 'error');
        });
    }
}

// Начать аудиозвонок
async function startVoiceCall() {
    if (!currentChatId) return;
    
    initializePeer();
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        });
        
        showCallModal(false);
        startCall(localStream);
        
    } catch (error) {
        console.error('Ошибка доступа к микрофону:', error);
        showNotification('Не удалось получить доступ к микрофону', 'error');
    }
}

// Начать видеозвонок
async function startVideoCall() {
    if (!currentChatId) return;
    
    initializePeer();
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        showCallModal(true);
        document.getElementById('local-video').srcObject = localStream;
        startCall(localStream);
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        showNotification('Не удалось получить доступ к камере/микрофону', 'error');
    }
}

// Начать звонок
function startCall(stream) {
    // Получить ID другого пользователя
    database.ref('chats/' + currentChatId + '/participants').once('value')
        .then(snapshot => {
            const participants = snapshot.val();
            const otherUserId = participants.find(id => id !== currentUser.uid);
            
            // Позвонить
            currentCall = peer.call(otherUserId, stream);
            
            currentCall.on('stream', (remoteStream) => {
                document.getElementById('remote-video').srcObject = remoteStream;
                document.getElementById('call-status').textContent = 'Подключено';
            });
            
            currentCall.on('close', () => {
                endCall();
            });
            
            currentCall.on('error', (error) => {
                console.error('Call error:', error);
                endCall();
            });
        });
}

// Обработка входящего звонка
function handleIncomingCall(call) {
    if (confirm('Входящий звонок. Принять?')) {
        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        })
        .then(stream => {
            localStream = stream;
            showCallModal(true);
            document.getElementById('local-video').srcObject = stream;
            
            call.answer(stream);
            currentCall = call;
            
            call.on('stream', (remoteStream) => {
                document.getElementById('remote-video').srcObject = remoteStream;
                document.getElementById('call-status').textContent = 'Подключено';
            });
            
            call.on('close', () => {
                endCall();
            });
        })
        .catch(error => {
            console.error('Ошибка:', error);
            call.close();
        });
    } else {
        call.close();
    }
}

// Показать модальное окно звонка
function showCallModal(isVideo) {
    document.getElementById('call-modal').classList.remove('hidden');
    document.getElementById('local-video').style.display = isVideo ? 'block' : 'none';
    document.getElementById('video-btn').style.display = isVideo ? 'block' : 'none';
}

// Завершить звонок
function endCall() {
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    document.getElementById('call-modal').classList.add('hidden');
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    
    isVideoEnabled = true;
    isAudioEnabled = true;
}

// Переключить микрофон
function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isAudioEnabled = !isAudioEnabled;
            audioTrack.enabled = isAudioEnabled;
            document.getElementById('mute-btn').textContent = isAudioEnabled ? '🎤' : '🔇';
        }
    }
}

// Переключить видео
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isVideoEnabled = !isVideoEnabled;
            videoTrack.enabled = isVideoEnabled;
            document.getElementById('video-btn').textContent = isVideoEnabled ? '📹' : '🚫';
        }
    }
}