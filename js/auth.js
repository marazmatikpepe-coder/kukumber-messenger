// ========================================
// KUKUMBER MESSENGER - AUTHENTICATION
// ========================================

// Показать форму регистрации
function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

// Показать форму входа
function showLogin() {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

// ========================================
// РЕГИСТРАЦИЯ
// ========================================

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;

    // Валидация
    if (!username) {
        showNotification('Введите имя пользователя!', 'error');
        return;
    }
    
    if (username.length < 3) {
        showNotification('Имя пользователя должно быть минимум 3 символа!', 'error');
        return;
    }
    
    if (!email) {
        showNotification('Введите email!', 'error');
        return;
    }
    
    if (!password) {
        showNotification('Введите пароль!', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Пароль должен содержать минимум 6 символов!', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Пароли не совпадают!', 'error');
        return;
    }

    // Блокируем кнопку
    const btn = document.querySelector('#register-form .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Создание...';

    try {
        // Проверяем уникальность username
        const usernameSnapshot = await database.ref('usernames/' + username.toLowerCase()).once('value');
        if (usernameSnapshot.exists()) {
            showNotification('Это имя пользователя уже занято!', 'error');
            btn.disabled = false;
            btn.textContent = 'Создать аккаунт';
            return;
        }

        // Создание пользователя в Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Сохранение данных пользователя в базе
        await database.ref('users/' + user.uid).set({
            username: username,
            email: email,
            phone: phone || '',
            avatar: '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: {
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            }
        });

        // Сохранение username для проверки уникальности
        await database.ref('usernames/' + username.toLowerCase()).set(user.uid);

        showNotification('Регистрация успешна! Добро пожаловать!', 'success');
        
        // Очистка полей
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-phone').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('reg-password-confirm').value = '';
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        
        let errorMessage = 'Ошибка регистрации';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Этот email уже используется!';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Некорректный email!';
                break;
            case 'auth/weak-password':
                errorMessage = 'Слишком слабый пароль!';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
    
    btn.disabled = false;
    btn.textContent = 'Создать аккаунт';
}

// ========================================
// ВХОД
// ========================================

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email) {
        showNotification('Введите email!', 'error');
        return;
    }
    
    if (!password) {
        showNotification('Введите пароль!', 'error');
        return;
    }

    // Блокируем кнопку
    const btn = document.querySelector('#login-form .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Вход...';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Добро пожаловать в Kukumber!', 'success');
        
        // Очистка полей
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        
        let errorMessage = 'Ошибка входа';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Пользователь не найден!';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Неверный пароль!';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Некорректный email!';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Слишком много попыток. Попробуйте позже.';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
    
    btn.disabled = false;
    btn.textContent = 'Войти';
}

// ========================================
// ВЫХОД
// ========================================

function logout() {
    if (!confirm('Вы уверены, что хотите выйти?')) return;
    
    // Обновляем статус перед выходом
    updateOnlineStatus(false);
    
    // Отключаем слушатели
    if (messagesListener) {
        messagesListener.off();
        messagesListener = null;
    }
    
    // Закрываем звонок если есть
    if (currentCall) {
        endCall();
    }
    
    // Выходим
    auth.signOut()
        .then(() => {
            currentUser = null;
            currentUserData = null;
            currentChatId = null;
            currentChatUser = null;
            showNotification('Вы вышли из аккаунта', 'info');
        })
        .catch(error => {
            console.error('Ошибка выхода:', error);
            showNotification('Ошибка при выходе', 'error');
        });
}
