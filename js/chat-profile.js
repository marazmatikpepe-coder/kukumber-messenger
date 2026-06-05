// KUKUMBER MESSENGER - CHAT-PROFILE.JS (ПОЛНАЯ ВЕРСИЯ)

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
var currentGroupMemberId = null;
var currentGroupMemberName = null;

// ========== ОТКРЫТИЕ ПРОФИЛЯ ГРУППЫ (ПОЛНАЯ ВЕРСИЯ) ==========
window.openGroupProfile = async function(chatId) {
    console.log('openGroupProfile вызван для:', chatId);
    
    if (!chatId) {
        showNotification('ID группы не указан', 'error');
        return;
    }
    
    try {
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnap.val();
        
        if (!chatData || chatData.type !== 'group') {
            showNotification('Группа не найдена', 'error');
            return;
        }
        
        const oldModal = document.getElementById('group-profile-modal');
        if (oldModal) oldModal.remove();
        
        let creatorName = 'Неизвестно';
        if (chatData.createdBy) {
            try {
                const creatorSnap = await database.ref('users/' + chatData.createdBy).once('value');
                const creatorData = creatorSnap.val();
                if (creatorData) creatorName = creatorData.username;
            } catch(e) {}
        }
        
        const membersCount = chatData.members ? Object.keys(chatData.members).length : 0;
        const isMember = chatData.members && chatData.members[currentUser?.uid];
        const isAdmin = chatData.admins && chatData.admins[currentUser?.uid];
        const isCreator = chatData.createdBy === currentUser?.uid;
        const canManageMembers = isCreator || (isAdmin && chatData.adminPermissions?.[currentUser?.uid]?.manageMembers);
        
        window.currentGroupId = chatId;
        window.currentGroupData = chatData;
        
        const bannerStyle = chatData.banner ? 
            `background-image: url(${chatData.banner}); background-size: cover; background-position: center;` : 
            'background: linear-gradient(135deg, #228B22, #556B2F);';
        
        const modal = document.createElement('div');
        modal.id = 'group-profile-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10003';
        modal.innerHTML = `
            <div class="group-profile-container" style="max-width: 500px; width: 95%; background: white; border-radius: 28px; overflow: hidden; max-height: 85vh; display: flex; flex-direction: column; position: relative; margin: auto;">
                <div id="group-profile-header" style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; background: white; flex-shrink: 0;">
                    <button id="group-profile-back" style="background: none; border: none; font-size: 24px; cursor: pointer; width: 40px; height: 40px;">←</button>
                    <h3 id="group-profile-title" style="margin: 0; flex: 1; text-align: center;">Информация</h3>
                    <button onclick="closeGroupProfileModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <div id="group-profile-main" style="flex: 1; overflow-y: auto;">
                    <div id="group-banner" style="height: 140px; position: relative; ${bannerStyle}">
                        ${(isAdmin || isCreator) ? '<button id="edit-banner-btn" style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;">✏️</button>' : ''}
                    </div>
                    
                    <div style="display: flex; justify-content: center; margin-top: -50px; position: relative;">
                        <div id="group-avatar" style="width: 90px; height: 90px; border-radius: 50%; background: var(--sage); border: 4px solid white; display: flex; align-items: center; justify-content: center; font-size: 45px; ${chatData.avatar ? 'background-image: url(' + chatData.avatar + '); background-size: cover;' : ''}">
                            ${chatData.avatar ? '' : ''}
                            ${(isAdmin || isCreator) ? '<button id="edit-avatar-btn" style="position: absolute; bottom: 0; right: 0; background: var(--forest); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer;">✏️</button>' : ''}
                        </div>
                    </div>
                    
                    <div style="text-align: center; padding: 15px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                            <h2 id="group-name-display" style="margin: 0;">${escapeHtml(chatData.name || 'Группа')}</h2>
                            ${(isAdmin || isCreator) ? '<span id="edit-name-icon" style="cursor: pointer; font-size: 16px;">✏️</span>' : ''}
                        </div>
                        <p id="group-kname" style="color: var(--forest); margin: 5px 0;">${chatData.kname ? '🔗 @' + escapeHtml(chatData.kname) : '🔗 Нет K-name'}</p>
                        
                        <button id="group-action-btn" style="margin: 10px auto; padding: 8px 24px; border-radius: 30px; border: none; font-weight: 600; cursor: pointer; background: ${isMember ? '#dc3545' : '#228B22'}; color: white;">
                            ${isMember ? '🚪 Выйти из группы' : '➕ Вступить в группу'}
                        </button>
                        
                        <div style="margin-top: 15px; text-align: left; background: #f5f5f5; border-radius: 16px; padding: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600;">📝 Описание</span>
                                ${(isAdmin || isCreator) ? '<button id="edit-desc-btn" style="background: none; border: none; cursor: pointer;">✏️</button>' : ''}
                            </div>
                            <p id="group-desc-display" style="margin: 8px 0 0 0; color: #666;">${escapeHtml(chatData.description || 'Нет описания')}</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
                        <button id="tab-members-btn" class="group-tab-btn active" style="flex: 1; padding: 12px; background: none; border: none; cursor: pointer; font-weight: 600; color: #228B22; border-bottom: 2px solid #228B22;">👥 Участники</button>
                        <button id="tab-info-btn" class="group-tab-btn" style="flex: 1; padding: 12px; background: none; border: none; cursor: pointer;">ℹ️ Инфо</button>
                    </div>
                    
                    <div id="members-tab" style="padding: 10px;">
                        <div id="members-list" style="max-height: 400px; overflow-y: auto;">
                            <div style="text-align: center; padding: 20px;">Загрузка участников...</div>
                        </div>
                    </div>
                    
                    <div id="info-tab" style="padding: 15px; display: none;">
                        <div style="background: #f5f5f5; border-radius: 16px; padding: 15px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>📅 Дата создания</span>
                                <span>${new Date(chatData.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div style="background: #f5f5f5; border-radius: 16px; padding: 15px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>👥 Всего участников</span>
                                <span>${membersCount}</span>
                            </div>
                        </div>
                        <div style="background: #f5f5f5; border-radius: 16px; padding: 15px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>👑 Создатель</span>
                                <span style="color: gold;">${escapeHtml(creatorName)}</span>
                            </div>
                        </div>
                        <button id="share-group-btn" style="width: 100%; padding: 12px; background: #228B22; color: white; border: none; border-radius: 16px; margin-top: 10px; cursor: pointer;">🔗 Поделиться группой</button>
                        <button id="share-group-invite-btn" style="width: 100%; padding: 12px; background: var(--forest); color: white; border: none; border-radius: 16px; margin-top: 10px; cursor: pointer;">🔗 Скопировать ссылку-приглашение</button>
                        ${(isAdmin || isCreator) ? '<button id="edit-group-settings-btn" style="width: 100%; padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 16px; margin-top: 10px; cursor: pointer;">⚙️ Изменить инфо группы</button>' : ''}
                        ${isCreator ? '<button id="delete-group-btn" style="width: 100%; padding: 12px; background: #dc3545; color: white; border: none; border-radius: 16px; margin-top: 10px; cursor: pointer;">🗑️ Удалить группу</button>' : ''}
                    </div>
                </div>
                
                <div id="member-permissions-modal" style="display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 20; overflow-y: auto;">
                    <div style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; position: sticky; top: 0; background: white;">
                        <button id="perms-back-btn" style="background: none; border: none; font-size: 24px; cursor: pointer;">←</button>
                        <h3 style="margin: 0; flex: 1; text-align: center;" id="perms-member-name">Разрешения</h3>
                        <button id="perms-close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                    </div>
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight: 600;">Должность</label>
                            <select id="member-role-select" style="width: 100%; padding: 12px; margin-top: 8px; border: 2px solid #ddd; border-radius: 12px;">
                                <option value="member">👤 Участник</option>
                                ${(isCreator || (isAdmin && canManageMembers)) ? '<option value="admin">⭐ Администратор</option>' : ''}
                                ${isCreator ? '<option value="owner">👑 Владелец</option>' : ''}
                            </select>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <div style="font-weight: 600; margin-bottom: 10px;">Разрешения</div>
                            
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>✏️ Писать в группу</span>
                                <label class="switch"><input type="checkbox" id="perm-send-messages" checked><span class="slider"></span></label>
                            </div>
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>🔗 Отправлять ссылки</span>
                                <label class="switch"><input type="checkbox" id="perm-send-links" checked><span class="slider"></span></label>
                            </div>
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>📷 Отправлять фото</span>
                                <label class="switch"><input type="checkbox" id="perm-send-photos" checked><span class="slider"></span></label>
                            </div>
                            
                            ${(isCreator || (isAdmin && canManageMembers)) ? `
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>✏️ Менять инфо группы</span>
                                <label class="switch"><input type="checkbox" id="perm-edit-info"><span class="slider"></span></label>
                            </div>
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>👑 Менять должность участников</span>
                                <label class="switch"><input type="checkbox" id="perm-manage-roles"><span class="slider"></span></label>
                            </div>
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>🚪 Выгонять участников</span>
                                <label class="switch"><input type="checkbox" id="perm-kick-members"><span class="slider"></span></label>
                            </div>
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>➕ Добавлять участников</span>
                                <label class="switch"><input type="checkbox" id="perm-add-members"><span class="slider"></span></label>
                            </div>
                            <div class="permission-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>🗑️ Удалять чужие сообщения</span>
                                <label class="switch"><input type="checkbox" id="perm-delete-messages"><span class="slider"></span></label>
                            </div>
                            ` : ''}
                        </div>
                        
                        <button id="save-permissions-btn" style="width: 100%; padding: 14px; background: #228B22; color: white; border: none; border-radius: 16px; cursor: pointer;">💾 Сохранить</button>
                        ${(isCreator || (isAdmin && canManageMembers)) ? '<button id="kick-member-btn" style="width: 100%; padding: 14px; background: #dc3545; color: white; border: none; border-radius: 16px; margin-top: 10px; cursor: pointer;">🚫 Выгнать из группы</button>' : ''}
                        ${(isCreator || (isAdmin && canManageMembers)) ? '<button id="ban-member-btn" style="width: 100%; padding: 14px; background: #ff9800; color: white; border: none; border-radius: 16px; margin-top: 10px; cursor: pointer;">⛔ В черный список</button>' : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        await loadGroupMembersList(chatId, chatData);
        bindGroupProfileEvents(chatId, chatData, isMember, isAdmin, isCreator, canManageMembers);
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('Ошибка загрузки профиля группы', 'error');
    }
};

// ========== ЗАГРУЗКА СПИСКА УЧАСТНИКОВ ==========
async function loadGroupMembersList(chatId, chatData) {
    const container = document.getElementById('members-list');
    if (!container) return;
    
    if (!chatData.members) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Нет участников</div>';
        return;
    }
    
    const memberIds = Object.keys(chatData.members);
    const isCreator = chatData.createdBy === currentUser?.uid;
    const isAdmin = chatData.admins && chatData.admins[currentUser?.uid];
    const canManage = isCreator || (isAdmin && chatData.adminPermissions?.[currentUser?.uid]?.manageMembers);
    
    let ownerHtml = '';
    let adminsHtml = '';
    let membersHtml = '';
    let bannedHtml = '';
    
    for (const memberId of memberIds) {
        try {
            const userSnap = await database.ref('users/' + memberId).once('value');
            const userData = userSnap.val();
            const isUserCreator = chatData.createdBy === memberId;
            const isUserAdmin = chatData.admins && chatData.admins[memberId] && !isUserCreator;
            const isBanned = chatData.banned && chatData.banned[memberId];
            
            const avatarStyle = userData?.avatar ? `background-image: url(${userData.avatar}); background-size: cover;` : '';
            const avatarContent = userData?.avatar ? '' : '';
            
            const memberHtml = `
                <div class="member-item" data-member-id="${memberId}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; ${canManage && !isUserCreator ? 'cursor: pointer;' : ''}">
                    <div style="width: 45px; height: 45px; border-radius: 50%; background: #9DC183; display: flex; align-items: center; justify-content: center; ${avatarStyle}">${avatarContent}</div>
                    <div style="flex:1;">
                        <div style="font-weight: 500;">${escapeHtml(userData?.username || 'Пользователь')}</div>
                        <div style="font-size: 11px;">
                            ${isUserCreator ? '<span style="color: gold;">👑 владелец</span>' : (isUserAdmin ? '<span style="color: #228B22;">⭐ администратор</span>' : '👤 участник')}
                            ${isBanned ? '<span style="color: #ff9800; margin-left: 8px;">⛔ в ЧС</span>' : ''}
                        </div>
                    </div>
                    ${canManage && !isUserCreator ? '<span style="color: #999;">›</span>' : ''}
                </div>
            `;
            
            if (isUserCreator) {
                ownerHtml = '<div style="margin-bottom: 10px;"><div style="font-weight: 600; margin-bottom: 8px; padding-left: 5px;">👑 Владелец</div>' + memberHtml + '</div>';
            } else if (isUserAdmin) {
                adminsHtml += memberHtml;
            } else if (isBanned) {
                bannedHtml += memberHtml;
            } else {
                membersHtml += memberHtml;
            }
        } catch(e) {}
    }
    
    let finalHtml = '';
    if (ownerHtml) finalHtml += ownerHtml;
    if (adminsHtml) finalHtml += '<div style="margin-bottom: 10px;"><div style="font-weight: 600; margin-bottom: 8px; padding-left: 5px;">⭐ Администраторы</div>' + adminsHtml + '</div>';
    if (membersHtml) finalHtml += '<div style="margin-bottom: 10px;"><div style="font-weight: 600; margin-bottom: 8px; padding-left: 5px;">👥 Участники</div>' + membersHtml + '</div>';
    if (bannedHtml) finalHtml += '<div style="margin-bottom: 10px;"><div style="font-weight: 600; margin-bottom: 8px; padding-left: 5px;">⛔ Черный список</div>' + bannedHtml + '</div>';
    
    container.innerHTML = finalHtml || '<div style="text-align: center; padding: 20px;">Нет участников</div>';
    
    if (canManage) {
        document.querySelectorAll('.member-item[data-member-id]').forEach(item => {
            item.onclick = () => openMemberPermissions(item.getAttribute('data-member-id'), chatId, chatData);
        });
    }
}

// ========== ОТКРЫТИЕ ОКНА РАЗРЕШЕНИЙ ==========
async function openMemberPermissions(memberId, chatId, chatData) {
    window.currentGroupMemberId = memberId;
    
    const permsModal = document.getElementById('member-permissions-modal');
    const mainContent = document.getElementById('group-profile-main');
    
    if (!permsModal || !mainContent) return;
    
    const userSnap = await database.ref('users/' + memberId).once('value');
    const userData = userSnap.val();
    
    const isCreator = chatData.createdBy === currentUser?.uid;
    const isTargetCreator = chatData.createdBy === memberId;
    const isTargetAdmin = chatData.admins && chatData.admins[memberId];
    
    const memberName = userData?.username || 'Пользователь';
    document.getElementById('perms-member-name').textContent = memberName;
    window.currentGroupMemberName = memberName;
    
    const roleSelect = document.getElementById('member-role-select');
    if (roleSelect) {
        if (isTargetCreator) roleSelect.value = 'owner';
        else if (isTargetAdmin) roleSelect.value = 'admin';
        else roleSelect.value = 'member';
        roleSelect.disabled = isTargetCreator;
    }
    
    const permissions = chatData.userPermissions?.[memberId] || {};
    document.getElementById('perm-send-messages').checked = permissions.sendMessages !== false;
    document.getElementById('perm-send-links').checked = permissions.sendLinks !== false;
    document.getElementById('perm-send-photos').checked = permissions.sendPhotos !== false;
    
    if (document.getElementById('perm-edit-info')) {
        document.getElementById('perm-edit-info').checked = permissions.editInfo === true;
        document.getElementById('perm-manage-roles').checked = permissions.manageRoles === true;
        document.getElementById('perm-kick-members').checked = permissions.kickMembers === true;
        document.getElementById('perm-add-members').checked = permissions.addMembers === true;
        document.getElementById('perm-delete-messages').checked = permissions.deleteMessages === true;
    }
    
    mainContent.style.display = 'none';
    permsModal.style.display = 'block';
}

// ========== ПРИВЯЗКА СОБЫТИЙ ==========
function bindGroupProfileEvents(chatId, chatData, isMember, isAdmin, isCreator, canManageMembers) {
    
    // Кнопка действия
    const actionBtn = document.getElementById('group-action-btn');
    if (actionBtn) {
        actionBtn.onclick = async () => {
            if (isMember) {
                if (!confirm('Покинуть группу?')) return;
                await database.ref('chats/' + chatId + '/members/' + currentUser.uid).remove();
                await database.ref('userChats/' + currentUser.uid + '/' + chatId).remove();
                showNotification('Вы покинули группу', 'success');
                closeGroupProfileModal();
                if (typeof closeChat === 'function') closeChat();
                if (typeof loadChats === 'function') loadChats();
            } else {
                await database.ref('chats/' + chatId + '/members/' + currentUser.uid).set(true);
                await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
                showNotification('Вы присоединились к группе', 'success');
                closeGroupProfileModal();
                if (typeof loadChats === 'function') loadChats();
                const newChatData = await database.ref('chats/' + chatId).once('value');
                if (typeof openChatWithData === 'function') {
                    openChatWithData(chatId, newChatData.val());
                }
            }
        };
    }
    
    // Переключение вкладок
    const membersTab = document.getElementById('members-tab');
    const infoTab = document.getElementById('info-tab');
    const tabMembersBtn = document.getElementById('tab-members-btn');
    const tabInfoBtn = document.getElementById('tab-info-btn');
    
    if (tabMembersBtn) {
        tabMembersBtn.onclick = () => {
            membersTab.style.display = 'block';
            infoTab.style.display = 'none';
            tabMembersBtn.style.color = '#228B22';
            tabMembersBtn.style.borderBottom = '2px solid #228B22';
            tabInfoBtn.style.color = '';
            tabInfoBtn.style.borderBottom = 'none';
        };
    }
    
    if (tabInfoBtn) {
        tabInfoBtn.onclick = () => {
            membersTab.style.display = 'none';
            infoTab.style.display = 'block';
            tabInfoBtn.style.color = '#228B22';
            tabInfoBtn.style.borderBottom = '2px solid #228B22';
            tabMembersBtn.style.color = '';
            tabMembersBtn.style.borderBottom = 'none';
        };
    }
    
    // Кнопки навигации в модалке разрешений
    const backBtn = document.getElementById('perms-back-btn');
    const permsModal = document.getElementById('member-permissions-modal');
    const mainContent = document.getElementById('group-profile-main');
    
    if (backBtn) {
        backBtn.onclick = () => {
            permsModal.style.display = 'none';
            mainContent.style.display = 'block';
        };
    }
    
    const permsCloseBtn = document.getElementById('perms-close-btn');
    if (permsCloseBtn) {
        permsCloseBtn.onclick = () => {
            permsModal.style.display = 'none';
            mainContent.style.display = 'block';
        };
    }
    
    // Сохранение разрешений
    const savePermsBtn = document.getElementById('save-permissions-btn');
    if (savePermsBtn) {
        savePermsBtn.onclick = async () => {
            const memberId = window.currentGroupMemberId;
            const roleSelect = document.getElementById('member-role-select');
            const newRole = roleSelect?.value;
            
            const permissions = {
                sendMessages: document.getElementById('perm-send-messages')?.checked || false,
                sendLinks: document.getElementById('perm-send-links')?.checked || false,
                sendPhotos: document.getElementById('perm-send-photos')?.checked || false,
                editInfo: document.getElementById('perm-edit-info')?.checked || false,
                manageRoles: document.getElementById('perm-manage-roles')?.checked || false,
                kickMembers: document.getElementById('perm-kick-members')?.checked || false,
                addMembers: document.getElementById('perm-add-members')?.checked || false,
                deleteMessages: document.getElementById('perm-delete-messages')?.checked || false
            };
            
            if (newRole === 'admin') {
                await database.ref('chats/' + chatId + '/admins/' + memberId).set(true);
                await database.ref('chats/' + chatId + '/userPermissions/' + memberId).set(permissions);
            } else if (newRole === 'member') {
                await database.ref('chats/' + chatId + '/admins/' + memberId).remove();
                await database.ref('chats/' + chatId + '/userPermissions/' + memberId).set(permissions);
            } else if (newRole === 'owner' && isCreator) {
                await database.ref('chats/' + chatId + '/createdBy').set(memberId);
                await database.ref('chats/' + chatId + '/admins/' + memberId).set(true);
                await database.ref('chats/' + chatId + '/admins/' + currentUser.uid).remove();
            }
            
            showNotification('Разрешения сохранены', 'success');
            permsModal.style.display = 'none';
            mainContent.style.display = 'block';
            await loadGroupMembersList(chatId, chatData);
        };
    }
    
    // Выгнать участника
    const kickBtn = document.getElementById('kick-member-btn');
    if (kickBtn) {
        kickBtn.onclick = async () => {
            const memberId = window.currentGroupMemberId;
            if (!confirm(`Выгнать ${window.currentGroupMemberName} из группы?`)) return;
            
            await database.ref('chats/' + chatId + '/members/' + memberId).remove();
            await database.ref('chats/' + chatId + '/banned/' + memberId).set(true);
            await database.ref('userChats/' + memberId + '/' + chatId).remove();
            
            showNotification('Участник выгнан', 'success');
            permsModal.style.display = 'none';
            mainContent.style.display = 'block';
            await loadGroupMembersList(chatId, chatData);
        };
    }
    
    // Черный список
    const banBtn = document.getElementById('ban-member-btn');
    if (banBtn) {
        banBtn.onclick = async () => {
            const memberId = window.currentGroupMemberId;
            const isBanned = chatData.banned && chatData.banned[memberId];
            
            if (isBanned) {
                await database.ref('chats/' + chatId + '/banned/' + memberId).remove();
                showNotification('Участник удален из черного списка', 'success');
            } else {
                await database.ref('chats/' + chatId + '/banned/' + memberId).set(true);
                showNotification('Участник добавлен в черный список', 'warning');
            }
            
            permsModal.style.display = 'none';
            mainContent.style.display = 'block';
            await loadGroupMembersList(chatId, chatData);
        };
    }
    
    // Поделиться
    const shareBtn = document.getElementById('share-group-btn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            const groupLink = `${window.location.origin}${window.location.pathname}?group=${chatId}`;
            if (navigator.share) {
                navigator.share({ title: chatData.name, text: 'Присоединяйся к группе!', url: groupLink });
            } else {
                navigator.clipboard.writeText(groupLink);
                showNotification('Ссылка скопирована!', 'success');
            }
        };
    }
    
    // Редактирование названия
    const editNameIcon = document.getElementById('edit-name-icon');
    const nameDisplay = document.getElementById('group-name-display');
    if (editNameIcon && nameDisplay && (isAdmin || isCreator)) {
        editNameIcon.onclick = async () => {
            const newName = prompt('Новое название группы:', chatData.name || '');
            if (newName && newName.trim()) {
                await database.ref('chats/' + chatId + '/name').set(newName.trim());
                showNotification('Название обновлено', 'success');
                nameDisplay.textContent = newName.trim();
            }
        };
    }
    const shareInviteBtn = document.getElementById('share-group-invite-btn');
if (shareInviteBtn) {
    shareInviteBtn.onclick = function() {
        var inviteLink = window.location.origin + window.location.pathname + '?group=' + chatId;
        navigator.clipboard.writeText(inviteLink).then(function() {
            showNotification('🔗 Ссылка-приглашение скопирована!', 'success');
        }).catch(function() {
            showNotification('❌ Не удалось скопировать ссылку', 'error');
        });
    };
}
    // Редактирование описания
    const editDescBtn = document.getElementById('edit-desc-btn');
    const descDisplay = document.getElementById('group-desc-display');
    if (editDescBtn && descDisplay && (isAdmin || isCreator)) {
        editDescBtn.onclick = async () => {
            const newDesc = prompt('Новое описание группы:', chatData.description || '');
            if (newDesc !== null) {
                await database.ref('chats/' + chatId + '/description').set(newDesc.trim());
                showNotification('Описание обновлено', 'success');
                descDisplay.textContent = newDesc.trim() || 'Нет описания';
            }
        };
    }
    
    // Кнопка возврата
    const backButton = document.getElementById('group-profile-back');
    if (backButton) {
        backButton.onclick = () => closeGroupProfileModal();
    }
    
    // Редактирование настроек
    const editSettingsBtn = document.getElementById('edit-group-settings-btn');
    if (editSettingsBtn && (isAdmin || isCreator)) {
        editSettingsBtn.onclick = () => editGroupSettings(chatId, chatData);
    }
    
    // Редактирование баннера
    const editBannerBtn = document.getElementById('edit-banner-btn');
    if (editBannerBtn && (isAdmin || isCreator)) {
        editBannerBtn.onclick = () => editGroupBanner(chatId);
    }
    
    // Редактирование аватара
    const editAvatarBtn = document.getElementById('edit-avatar-btn');
    if (editAvatarBtn && (isAdmin || isCreator)) {
        editAvatarBtn.onclick = () => editGroupAvatar(chatId);
    }
    
    // Удаление группы
    const deleteGroupBtn = document.getElementById('delete-group-btn');
    if (deleteGroupBtn && isCreator) {
        deleteGroupBtn.onclick = async () => {
            if (!confirm('УДАЛИТЬ группу навсегда? Это необратимо!')) return;
            await database.ref('messages/' + chatId).remove();
            await database.ref('chats/' + chatId).remove();
            const members = chatData.members || {};
            for (const memberId in members) {
                await database.ref('userChats/' + memberId + '/' + chatId).remove();
            }
            showNotification('Группа удалена', 'success');
            closeGroupProfileModal();
            if (typeof closeChat === 'function') closeChat();
            if (typeof loadChats === 'function') loadChats();
        };
    }
}

// ========== РЕДАКТИРОВАНИЕ ==========
async function editGroupBanner(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId + '/banner').set(url);
            showNotification('Баннер обновлён', 'success');
            const bannerDiv = document.getElementById('group-banner');
            if (bannerDiv) {
                bannerDiv.style.backgroundImage = `url(${url})`;
                bannerDiv.style.backgroundSize = 'cover';
            }
        } catch (err) {
            showNotification('Ошибка', 'error');
        }
    };
    input.click();
}

async function editGroupAvatar(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId + '/avatar').set(url);
            showNotification('Аватар обновлён', 'success');
            const avatarDiv = document.getElementById('group-avatar');
            if (avatarDiv) {
                avatarDiv.style.backgroundImage = `url(${url})`;
                avatarDiv.style.backgroundSize = 'cover';
                avatarDiv.textContent = '';
            }
        } catch (err) {
            showNotification('Ошибка', 'error');
        }
    };
    input.click();
}

async function editGroupSettings(chatId, chatData) {
    const newKname = prompt('Введите K-name (уникальная ссылка, только латиница):', chatData.kname || '');
    if (newKname !== null) {
        const knamePattern = /^[a-z0-9_]+$/;
        if (newKname && !knamePattern.test(newKname)) {
            showNotification('K-name: только латиница, цифры и _', 'error');
            return;
        }
        
        if (newKname !== chatData.kname) {
            if (chatData.kname) {
                await database.ref('channelKnames/' + chatData.kname).remove();
            }
            if (newKname) {
                await database.ref('channelKnames/' + newKname).set(chatId);
            }
            await database.ref('chats/' + chatId + '/kname').set(newKname || null);
            showNotification('K-name обновлён', 'success');
            
            const knameDisplay = document.getElementById('group-kname');
            if (knameDisplay) {
                knameDisplay.textContent = newKname ? '🔗 @' + newKname : '🔗 Нет K-name';
            }
        }
    }
}

// ========== ЗАКРЫТИЕ ==========
window.closeGroupProfileModal = function() {
    const modal = document.getElementById('group-profile-modal');
    if (modal) modal.remove();
};

window.closeChannelProfileModal = function() {
    const modal = document.getElementById('channel-profile-modal');
    if (modal) modal.remove();
};

// ========== ПРОФИЛЬ КАНАЛА (УПРОЩЁННЫЙ) ==========
window.openChannelProfile = async function(chatId) {
    try {
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const chatData = chatSnap.val();
        if (!chatData || chatData.type !== 'channel') {
            showNotification('Канал не найден', 'error');
            return;
        }
        
        const subscribersCount = chatData.subscribers ? Object.keys(chatData.subscribers).length : 0;
        const isSubscribed = chatData.subscribers && chatData.subscribers[currentUser?.uid];
        
        alert(`📢 КАНАЛ: ${chatData.name || 'Без названия'}\n👥 Подписчиков: ${subscribersCount}\n📝 ${chatData.description || 'Нет описания'}\n${isSubscribed ? '✅ Вы подписаны' : '❌ Вы не подписаны'}`);
        
    } catch (err) {
        showNotification('Ошибка', 'error');
    }
};

console.log('✅ chat-profile.js загружен полностью');
// ========== ПРОФИЛЬ КАНАЛА ==========
window.openChannelProfile = async function(chatId) {
    console.log('openChannelProfile вызван для:', chatId);
    
    if (!chatId) {
        showNotification('ID канала не указан', 'error');
        return;
    }
    
    try {
        const chatSnap = await database.ref('chats/' + chatId).once('value');
        const channelData = chatSnap.val();
        
        if (!channelData || channelData.type !== 'channel') {
            showNotification('Канал не найден', 'error');
            return;
        }
        
        const oldModal = document.getElementById('channel-profile-modal');
        if (oldModal) oldModal.remove();
        
        const isSubscribed = channelData.subscribers && channelData.subscribers[currentUser?.uid];
        const isAdmin = channelData.admins && channelData.admins[currentUser?.uid];
        const isOwner = channelData.createdBy === currentUser?.uid;
        const isSuperAdmin = window.isSuperAdmin === true;
        const canEdit = isOwner || isSuperAdmin;
        
        const subscribersCount = channelData.subscribers ? Object.keys(channelData.subscribers).length : 0;
        
        const bannerStyle = channelData.banner ? 
            `background-image: url(${channelData.banner}); background-size: cover; background-position: center;` : 
            'background: linear-gradient(135deg, #228B22, #556B2F);';
        
        const modal = document.createElement('div');
        modal.id = 'channel-profile-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10002';
        modal.innerHTML = `
            <div class="channel-profile-container">
                <div class="channel-banner" id="channel-banner" style="${bannerStyle}">
                    ${canEdit ? '<button class="channel-banner-edit-btn" onclick="editChannelBanner(\''+chatId+'\')">✏️</button>' : ''}
                    <button class="profile-close-btn" onclick="closeChannelProfileModal()">×</button>
                </div>
                
                <div class="channel-avatar-wrapper">
                    <div class="channel-avatar" id="channel-avatar" style="${channelData.avatar ? 'background-image: url('+channelData.avatar+');' : ''}">
                        ${canEdit ? '<button class="channel-avatar-edit-btn" onclick="editChannelAvatar(\''+chatId+'\')">✏️</button>' : ''}
                    </div>
                </div>
                
                <div class="channel-info">
                   <div class="channel-name-row">
    <h2 class="channel-name" id="channel-name">
        ${escapeHtml(channelData.name || 'Канал')}
        ${channelData.verified === true ? '<img src="https://i.ibb.co/YTRCNHkq/4e9cba55-b083-46d3-8a30-bff7b1be94c7-1.png" style="width:18px; height:18px; margin-left:5px; vertical-align:middle;">' : ''}
    </h2>
    ${canEdit ? '<button class="channel-name-edit-btn" onclick="editChannelName(\''+chatId+'\')">✏️</button>' : ''}
    ${isSuperAdmin ? `<button class="channel-verify-btn" onclick="toggleChannelVerification('${chatId}')">${channelData.verified ? '✅' : '🔘'}</button>` : ''}
</div>
                    <div class="channel-kname">
                        ${channelData.kname ? '@' + channelData.kname : 'Нет ссылки'}
                        ${canEdit ? '<button class="channel-kname-edit-btn" onclick="editChannelKname(\''+chatId+'\')">✏️</button>' : ''}
                    </div>
                    
                    <div class="channel-actions-row">
                        <button class="channel-subscribe-btn" onclick="toggleChannelSubscription('${chatId}')">
                            ${isSubscribed ? 'Отписаться' : 'Подписаться'}
                        </button>
                        <button class="channel-chat-btn" onclick="openChannelChat('${chatId}')">💬 Чат</button>
                        <button class="channel-notify-btn" onclick="toggleChannelNotifications('${chatId}')">🔔</button>
                    </div>
                    
                    <div class="channel-description" id="channel-description" ${canEdit ? 'ondblclick="editChannelDescription(\''+chatId+'\')"' : ''}>
                        ${channelData.description || 'Нет описания'}
                    </div>
                </div>
                
                <div class="channel-tabs">
                    <button class="channel-tab-btn active" onclick="switchChannelTab('posts', '${chatId}')">📷 Посты</button>
                    <button class="channel-tab-btn" onclick="switchChannelTab('reposts', '${chatId}')">🔄 Репосты</button>
                    <button class="channel-tab-btn" onclick="switchChannelTab('info', '${chatId}')">ℹ️ Инфо</button>
                    ${isAdmin ? '<button class="channel-tab-btn" onclick="switchChannelTab(\'members\', \''+chatId+'\')">👥 Участники</button>' : ''}
                </div>
                
                <div id="channel-tab-content" class="channel-tab-content">
                    <div class="profile-loading">Загрузка...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        // Загружаем посты
        await loadChannelPosts(chatId);
        
        // Если админ - загружаем участников
        if (isAdmin) {
            await loadChannelMembers(chatId, channelData);
        } else {
            loadChannelInfo(chatId, channelData);
        }
        
    } catch (err) {
        console.error('Ошибка:', err);
        showNotification('Ошибка загрузки профиля канала', 'error');
    }
};

// Закрытие профиля канала
window.closeChannelProfileModal = function() {
    const modal = document.getElementById('channel-profile-modal');
    if (modal) modal.remove();
};

// Загрузка постов канала
async function loadChannelPosts(chatId) {
    const container = document.getElementById('channel-tab-content');
    if (!container) return;
    
    container.innerHTML = '<div class="profile-loading">Загрузка постов...</div>';
    
    const slicesSnap = await database.ref('slices').orderByChild('channelId').equalTo(chatId).once('value');
    const slices = slicesSnap.val();
    
    if (!slices) {
        container.innerHTML = '<div class="profile-empty">Нет постов</div>';
        return;
    }
    
    container.innerHTML = '';
    const slicesArray = Object.entries(slices);
    slicesArray.sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
    
    for (const [id, slice] of slicesArray) {
        const card = createSliceCard(id, slice);
        container.appendChild(card);
    }
}

// Загрузка информации о канале
async function loadChannelInfo(chatId, channelData) {
    const container = document.getElementById('channel-tab-content');
    if (!container) return;
    
    const isOwner = channelData.createdBy === currentUser?.uid;
    const isAdmin = channelData.admins && channelData.admins[currentUser?.uid];
    
    let ownerName = 'Неизвестно';
    if (channelData.createdBy) {
        const userSnap = await database.ref('users/' + channelData.createdBy + '/username').once('value');
        ownerName = userSnap.val() || 'Неизвестно';
    }
    
    container.innerHTML = `
        <div style="background: var(--background); border-radius: 16px; padding: 15px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between;">
                <span>👑 Владелец</span>
                <span>${escapeHtml(ownerName)}</span>
            </div>
        </div>
        <div style="background: var(--background); border-radius: 16px; padding: 15px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between;">
                <span>📅 Дата создания</span>
                <span>${new Date(channelData.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
        <div style="background: var(--background); border-radius: 16px; padding: 15px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between;">
                <span>👥 Подписчиков</span>
                <span>${channelData.subscribersCount || 0}</span>
            </div>
        </div>
        <button onclick="shareChannel('${chatId}')" style="width: 100%; padding: 12px; background: var(--forest); color: white; border: none; border-radius: 16px; cursor: pointer;">🔗 Поделиться каналом</button>
        ${(isOwner || isAdmin) ? '<button onclick="editChannelSettings(\''+chatId+'\')" style="width: 100%; padding: 12px; background: var(--background); border: 1px solid var(--border); border-radius: 16px; margin-top: 10px; cursor: pointer;">⚙️ Настройки канала</button>' : ''}
        ${isOwner ? '<button onclick="deleteChannel(\''+chatId+'\')" style="width: 100%; padding: 12px; background: var(--error); color: white; border: none; border-radius: 16px; margin-top: 10px; cursor: pointer;">🗑️ Удалить канал</button>' : ''}
    `;
}

// Загрузка участников (для админов)
async function loadChannelMembers(chatId, channelData) {
    const container = document.getElementById('channel-tab-content');
    if (!container) return;
    
    const members = channelData.subscribers || {};
    const admins = channelData.admins || {};
    const ownerId = channelData.createdBy;
    const isOwner = ownerId === currentUser?.uid;
    
    let membersHtml = '<div style="margin-bottom: 15px;"><div style="font-weight: 600; margin-bottom: 10px;">👑 Владелец</div>';
    
    for (const uid in members) {
        const userSnap = await database.ref('users/' + uid).once('value');
        const userData = userSnap.val();
        const isUserOwner = uid === ownerId;
        const isUserAdmin = admins[uid] === true;
        
        if (isUserOwner) {
            membersHtml += `
                <div class="channel-member-item" data-member-id="${uid}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border);">
                    <div class="member-avatar" style="${userData?.avatar ? 'background-image: url('+userData.avatar+');' : 'background: var(--sage);'}"></div>
                    <div class="member-info">
                        <div class="member-name">${escapeHtml(userData?.username || 'Пользователь')}</div>
                        <div class="member-role">👑 Владелец</div>
                    </div>
                </div>
            `;
        }
    }
    
    membersHtml += '</div><div style="margin-bottom: 15px;"><div style="font-weight: 600; margin-bottom: 10px;">⭐ Администраторы</div>';
    
    for (const uid in admins) {
        if (uid === ownerId) continue;
        const userSnap = await database.ref('users/' + uid).once('value');
        const userData = userSnap.val();
        
        membersHtml += `
            <div class="channel-member-item" data-member-id="${uid}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border);">
                <div class="member-avatar" style="${userData?.avatar ? 'background-image: url('+userData.avatar+');' : 'background: var(--sage);'}"></div>
                <div class="member-info">
                    <div class="member-name">${escapeHtml(userData?.username || 'Пользователь')}</div>
                    <div class="member-role">⭐ Администратор</div>
                </div>
                <button class="member-edit-btn" onclick="openMemberEditMenu('${uid}', '${chatId}')">⚙️</button>
            </div>
        `;
    }
    
    membersHtml += '</div><div style="margin-bottom: 15px;"><div style="font-weight: 600; margin-bottom: 10px;">👥 Участники</div>';
    
    for (const uid in members) {
        if (uid === ownerId || admins[uid]) continue;
        const userSnap = await database.ref('users/' + uid).once('value');
        const userData = userSnap.val();
        
        membersHtml += `
            <div class="channel-member-item" data-member-id="${uid}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border);">
                <div class="member-avatar" style="${userData?.avatar ? 'background-image: url('+userData.avatar+');' : 'background: var(--sage);'}"></div>
                <div class="member-info">
                    <div class="member-name">${escapeHtml(userData?.username || 'Пользователь')}</div>
                    <div class="member-role">👤 Участник</div>
                </div>
                ${(isOwner || channelData.admins?.[currentUser?.uid]?.manageMembers) ? '<button class="member-edit-btn" onclick="openMemberEditMenu(\''+uid+'\', \''+chatId+'\')">⚙️</button>' : ''}
            </div>
        `;
    }
    
    membersHtml += '</div>';
    container.innerHTML = membersHtml;
}

// Меню редактирования участника
window.openMemberEditMenu = function(memberId, chatId, event) {
    event?.stopPropagation();
    
    const oldMenu = document.getElementById('member-edit-menu');
    if (oldMenu) oldMenu.remove();
    
    const isOwner = window.currentChannelOwnerId === currentUser?.uid;
    const isAdmin = window.currentChannelAdmins?.[currentUser?.uid];
    
    let menuHtml = '';
    
    if (!isOwner && !isAdmin) return;
    
    if (isOwner) {
        menuHtml += '<div class="member-menu-item" onclick="changeMemberRole(\''+memberId+'\', \''+chatId+'\', \'admin\')">⭐ Сделать администратором</div>';
        menuHtml += '<div class="member-menu-item" onclick="changeMemberRole(\''+memberId+'\', \''+chatId+'\', \'member\')">👤 Сделать участником</div>';
        menuHtml += '<div class="member-menu-item" onclick="transferChannelOwnership(\''+memberId+'\', \''+chatId+'\')">👑 Передать права владельца</div>';
        menuHtml += '<div class="member-menu-item danger" onclick="kickChannelMember(\''+memberId+'\', \''+chatId+'\')">🚫 Исключить из канала</div>';
    }
    
    if (isAdmin && !isOwner) {
        menuHtml += '<div class="member-menu-item danger" onclick="kickChannelMember(\''+memberId+'\', \''+chatId+'\')">🚫 Исключить из канала</div>';
    }
    
    const menu = document.createElement('div');
    menu.id = 'member-edit-menu';
    menu.innerHTML = menuHtml;
    document.body.appendChild(menu);
    
    const x = event?.clientX || window.innerWidth/2;
    const y = event?.clientY || window.innerHeight/2;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 10);
};

// Функции редактирования канала
window.editChannelBanner = async function(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/gif';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId + '/banner').set(url);
            showNotification('Баннер обновлён', 'success');
            document.getElementById('channel-banner').style.backgroundImage = `url(${url})`;
        } catch(err) {
            showNotification('Ошибка', 'error');
        }
    };
    input.click();
};

window.editChannelAvatar = async function(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showNotification('Загрузка...', 'info');
        try {
            const url = await uploadToImgBB(file);
            await database.ref('chats/' + chatId + '/avatar').set(url);
            showNotification('Аватар обновлён', 'success');
            document.getElementById('channel-avatar').style.backgroundImage = `url(${url})`;
        } catch(err) {
            showNotification('Ошибка', 'error');
        }
    };
    input.click();
};

window.editChannelName = async function(chatId) {
    const currentName = document.getElementById('channel-name')?.textContent || '';
    const newName = prompt('Название канала:', currentName);
    if (newName && newName.trim()) {
        await database.ref('chats/' + chatId + '/name').set(newName.trim());
        showNotification('Название обновлено', 'success');
        document.getElementById('channel-name').textContent = newName.trim();
    }
};

window.editChannelDescription = async function(chatId) {
    const currentDesc = document.getElementById('channel-description')?.textContent || '';
    const newDesc = prompt('Описание канала:', currentDesc === 'Нет описания' ? '' : currentDesc);
    if (newDesc !== null) {
        await database.ref('chats/' + chatId + '/description').set(newDesc.trim());
        showNotification('Описание обновлено', 'success');
        document.getElementById('channel-description').textContent = newDesc.trim() || 'Нет описания';
    }
};

window.editChannelKname = async function(chatId) {
    const channelSnap = await database.ref('chats/' + chatId).once('value');
    const channel = channelSnap.val();
    const currentKname = channel.kname || '';
    const newKname = prompt('Ссылка канала (только латиница, например: mychannel):', currentKname);
    
    if (newKname !== null) {
        const pattern = /^[a-z0-9_]+$/;
        if (newKname && !pattern.test(newKname)) {
            showNotification('Только латиница, цифры и _', 'error');
            return;
        }
        if (newKname !== currentKname) {
            if (currentKname) await database.ref('channelKnames/' + currentKname).remove();
            if (newKname) await database.ref('channelKnames/' + newKname).set(chatId);
            await database.ref('chats/' + chatId + '/kname').set(newKname || null);
            showNotification('Ссылка обновлена', 'success');
            document.querySelector('.channel-kname').innerHTML = (newKname ? '@' + newKname : 'Нет ссылки') + '<button class="channel-kname-edit-btn" onclick="editChannelKname(\''+chatId+'\')">✏️</button>';
        }
    }
};

window.toggleChannelVerification = async function(chatId) {
    if (!window.isSuperAdmin) {
        showNotification('Только администратор K Messenger может выдавать галочки', 'error');
        return;
    }
    const channelSnap = await database.ref('chats/' + chatId).once('value');
    const isVerified = channelSnap.val()?.verified === true;
    await database.ref('chats/' + chatId + '/verified').set(!isVerified);
    showNotification(isVerified ? 'Галочка снята' : 'Галочка выдана', 'success');
};

window.toggleChannelSubscription = async function(chatId) {
    const channelSnap = await database.ref('chats/' + chatId).once('value');
    const channel = channelSnap.val();
    const isSubscribed = channel.subscribers && channel.subscribers[currentUser?.uid];
    
    if (isSubscribed) {
        await database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).remove();
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).remove();
        showNotification('Вы отписались от канала', 'info');
    } else {
        await database.ref('chats/' + chatId + '/subscribers/' + currentUser.uid).set(true);
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        showNotification('Вы подписались на канал', 'success');
    }
    
    const newCount = await database.ref('chats/' + chatId + '/subscribersCount').transaction(c => (c || 0) + (isSubscribed ? -1 : 1));
};

window.openChannelChat = function(chatId) {
    closeChannelProfileModal();
    if (typeof switchToTab === 'function') switchToTab('chats');
    setTimeout(() => {
        if (typeof openChatById === 'function') openChatById(chatId);
    }, 300);
};

window.toggleChannelNotifications = async function(chatId) {
    const notifRef = database.ref('channelNotifications/' + currentUser.uid + '/' + chatId);
    const snap = await notifRef.once('value');
    const isEnabled = snap.val() === true;
    
    if (isEnabled) {
        await notifRef.remove();
        showNotification('Уведомления выключены', 'info');
    } else {
        await notifRef.set(true);
        showNotification('Уведомления включены', 'success');
    }
};

window.shareChannel = function(chatId) {
    const url = `${window.location.origin}${window.location.pathname}?channel=${chatId}`;
    if (navigator.share) {
        navigator.share({ title: 'Присоединяйся к каналу!', url: url });
    } else {
        navigator.clipboard.writeText(url);
        showNotification('Ссылка скопирована!', 'success');
    }
};

window.kickChannelMember = async function(memberId, chatId) {
    if (!confirm('Исключить участника из канала?')) return;
    await database.ref('chats/' + chatId + '/subscribers/' + memberId).remove();
    await database.ref('userChats/' + memberId + '/' + chatId).remove();
    showNotification('Участник исключён', 'success');
    openChannelProfile(chatId);
};

window.changeMemberRole = async function(memberId, chatId, role) {
    if (role === 'admin') {
        await database.ref('chats/' + chatId + '/admins/' + memberId).set(true);
        showNotification('Участник стал администратором', 'success');
    } else if (role === 'member') {
        await database.ref('chats/' + chatId + '/admins/' + memberId).remove();
        showNotification('Администратор стал участником', 'success');
    }
    openChannelProfile(chatId);
};

window.transferChannelOwnership = async function(memberId, chatId) {
    if (!confirm('Передать права владельца? Вы станете обычным администратором.')) return;
    await database.ref('chats/' + chatId + '/createdBy').set(memberId);
    await database.ref('chats/' + chatId + '/admins/' + memberId).set(true);
    showNotification('Права владельца переданы', 'success');
    openChannelProfile(chatId);
};

window.deleteChannel = async function(chatId) {
    if (!confirm('УДАЛИТЬ канал навсегда? Это необратимо!')) return;
    await database.ref('chats/' + chatId).remove();
    await database.ref('messages/' + chatId).remove();
    showNotification('Канал удалён', 'success');
    closeChannelProfileModal();
};

window.switchChannelTab = function(tab, chatId) {
    document.querySelectorAll('.channel-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'posts') loadChannelPosts(chatId);
    else if (tab === 'reposts') loadChannelReposts(chatId);
    else if (tab === 'info') database.ref('chats/' + chatId).once('value').then(snap => loadChannelInfo(chatId, snap.val()));
    else if (tab === 'members') database.ref('chats/' + chatId).once('value').then(snap => loadChannelMembers(chatId, snap.val()));
};
