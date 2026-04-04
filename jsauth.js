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

// Регистрация
async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;

    // Валидация
    if (!username || !email || !password) {
        showNotification('Заполните все обязательные поля!', 'error');
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

    try {
        // Создание пользователя
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Сохранение данных пользователя
        await database.ref('users/' + user.uid).set({
            username: username,
            email: email,
            phone: phone || '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            status: {
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            }
        });

        // Добавление в список всех пользователей для поиска
        await database.ref('usernames/' + username.toLowerCase()).set(user.uid);

        showNotification('Регистрация успешна!', 'success');
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        if (error.code === 'auth/email-already-in-use') {
            showNotification('Email уже используется!', 'error');
        } else {
            showNotification('Ошибка регистрации: ' + error.message, 'error');
        }
    }
}

// Вход
async function login() {
    const loginInput = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!loginInput || !password) {
        showNotification('Заполните все поля!', 'error');
        return;
    }

    try {
        let email = loginInput;

        // Если введен не email, ищем по username
        if (!loginInput.includes('@')) {
            const usernameSnapshot = await database.ref('usernames/' + loginInput.toLowerCase()).once('value');
            const userId = usernameSnapshot.val();
            
            if (userId) {
                const userSnapshot = await database.ref('users/' + userId).once('value');
                const userData = userSnapshot.val();
                email = userData.email;
            } else {
                showNotification('Пользователь не найден!', 'error');
                return;
            }
        }

        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Вход выполнен!', 'success');
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        if (error.code === 'auth/wrong-password') {
            showNotification('Неверный пароль!', 'error');
        } else if (error.code === 'auth/user-not-found') {
            showNotification('Пользователь не найден!', 'error');
        } else {
            showNotification('Ошибка входа: ' + error.message, 'error');
        }
    }
}

// Выход
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        updateOnlineStatus(false);
        auth.signOut().then(() => {
            currentUser = null;
            currentChatId = null;
            showAuthScreen();
        });
    }
}