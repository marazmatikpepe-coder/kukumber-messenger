// KUKUMBER MESSENGER - SETTINGS

function showEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    
    document.getElementById('edit-username').value = currentUserData.username || '';
    document.getElementById('edit-bio').value = currentUserData.bio || '';
    
    var preview = document.getElementById('edit-avatar-preview');
    if (currentUserData.avatar) {
        preview.style.backgroundImage = 'url(' + currentUserData.avatar + ')';
        preview.style.backgroundSize = 'cover';
        preview.textContent = '';
    } else {
        preview.style.backgroundImage = '';
        preview.textContent = '🥒';
    }
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

function previewEditAvatar(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var preview = document.getElementById('edit-avatar-preview');
        preview.style.backgroundImage = 'url(' + e.target.result + ')';
        preview.style.backgroundSize = 'cover';
        preview.textContent = '';
    };
    reader.readAsDataURL(file);
    
    // Store file for upload
    window.pendingAvatarFile = file;
}

function saveProfile() {
    var newUsername = document.getElementById('edit-username').value.trim();
    var newBio = document.getElementById('edit-bio').value.trim();
    
    if (!newUsername) {
        showNotification('Введите имя', 'error');
        return;
    }
    
    var updates = {
        username: newUsername,
        bio: newBio
    };
    
    var saveData = function(avatarUrl) {
        if (avatarUrl) {
            updates.avatar = avatarUrl;
        }
        
        database.ref('users/' + currentUser.uid).update(updates)
        .then(function() {
            closeEditProfileModal();
            showNotification('Профиль обновлён!', 'success');
        })
        .catch(function(error) {
            console.error('Ошибка:', error);
            showNotification('Ошибка сохранения', 'error');
        });
    };
    
    if (window.pendingAvatarFile) {
        uploadImageToImgBB(window.pendingAvatarFile)
        .then(function(imageData) {
            window.pendingAvatarFile = null;
            saveData(imageData ? imageData.url : null);
        })
        .catch(function() {
            saveData(null);
        });
    } else {
        saveData(null);
    }
}

// Settings pages (placeholder functions)
function showNotificationSettings() {
    showNotification('Уведомления: функция в разработке', 'info');
}

function showPrivacySettings() {
    showNotification('Конфиденциальность: функция в разработке', 'info');
}

function showThemeSettings() {
    showNotification('Оформление: функция в разработке', 'info');
}

function showLanguageSettings() {
    showNotification('Язык: функция в разработке', 'info');
}

function showStorageSettings() {
    showNotification('Данные и память: функция в разработке', 'info');
}

function showAbout() {
    alert('Kukumber Messenger v1.0\n\nСвежее общение каждый день 🥒\n\nСоздано с ❤️');
}

function showHelp() {
    showNotification('Помощь: функция в разработке', 'info');
}
