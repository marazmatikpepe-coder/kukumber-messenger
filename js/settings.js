// KUKUMBER MESSENGER - SETTINGS (с поддержкой 25 языков)

// Словарь всех языков
var translations = {
    ru: {
        app_name: 'Kukumber Messenger',
        settings: 'Настройки',
        edit_profile: 'Редактировать профиль',
        username: 'Имя пользователя',
        about_me: 'О себе',
        save: 'Сохранить',
        notifications: 'Уведомления',
        privacy: 'Конфиденциальность',
        theme: 'Оформление',
        language: 'Язык',
        storage: 'Данные и память',
        about: 'О приложении',
        help: 'Помощь',
        logout: 'Выйти из аккаунта',
        version: 'v1.0',
        tagline: 'Свежее общение каждый день 🥒',
        select_language: 'Выберите язык',
        settings_saved: 'Настройки сохранены',
        profile_updated: 'Профиль обновлён',
        enter_username: 'Введите имя пользователя',
        in_development: 'в разработке'
    },
    en: {
        app_name: 'Kukumber Messenger',
        settings: 'Settings',
        edit_profile: 'Edit Profile',
        username: 'Username',
        about_me: 'About me',
        save: 'Save',
        notifications: 'Notifications',
        privacy: 'Privacy',
        theme: 'Theme',
        language: 'Language',
        storage: 'Storage',
        about: 'About',
        help: 'Help',
        logout: 'Logout',
        version: 'v1.0',
        tagline: 'Fresh communication every day 🥒',
        select_language: 'Select language',
        settings_saved: 'Settings saved',
        profile_updated: 'Profile updated',
        enter_username: 'Enter username',
        in_development: 'in development'
    },
    es: {
        app_name: 'Kukumber Messenger',
        settings: 'Ajustes',
        edit_profile: 'Editar perfil',
        username: 'Nombre de usuario',
        about_me: 'Sobre mí',
        save: 'Guardar',
        notifications: 'Notificaciones',
        privacy: 'Privacidad',
        theme: 'Tema',
        language: 'Idioma',
        storage: 'Almacenamiento',
        about: 'Acerca de',
        help: 'Ayuda',
        logout: 'Cerrar sesión',
        version: 'v1.0',
        tagline: 'Comunicación fresca cada día 🥒',
        select_language: 'Seleccionar idioma',
        settings_saved: 'Configuración guardada',
        profile_updated: 'Perfil actualizado',
        enter_username: 'Ingrese nombre de usuario',
        in_development: 'en desarrollo'
    },
    de: {
        app_name: 'Kukumber Messenger',
        settings: 'Einstellungen',
        edit_profile: 'Profil bearbeiten',
        username: 'Benutzername',
        about_me: 'Über mich',
        save: 'Speichern',
        notifications: 'Benachrichtigungen',
        privacy: 'Datenschutz',
        theme: 'Design',
        language: 'Sprache',
        storage: 'Speicher',
        about: 'Über',
        help: 'Hilfe',
        logout: 'Abmelden',
        version: 'v1.0',
        tagline: 'Frische Kommunikation jeden Tag 🥒',
        select_language: 'Sprache auswählen',
        settings_saved: 'Einstellungen gespeichert',
        profile_updated: 'Profil aktualisiert',
        enter_username: 'Benutzername eingeben',
        in_development: 'in Entwicklung'
    },
    it: {
        app_name: 'Kukumber Messenger',
        settings: 'Impostazioni',
        edit_profile: 'Modifica profilo',
        username: 'Nome utente',
        about_me: 'Su di me',
        save: 'Salva',
        notifications: 'Notifiche',
        privacy: 'Privacy',
        theme: 'Tema',
        language: 'Lingua',
        storage: 'Archiviazione',
        about: 'Informazioni',
        help: 'Aiuto',
        logout: 'Esci',
        version: 'v1.0',
        tagline: 'Comunicazione fresca ogni giorno 🥒',
        select_language: 'Seleziona lingua',
        settings_saved: 'Impostazioni salvate',
        profile_updated: 'Profilo aggiornato',
        enter_username: 'Inserisci nome utente',
        in_development: 'in sviluppo'
    },
    fr: {
        app_name: 'Kukumber Messenger',
        settings: 'Paramètres',
        edit_profile: 'Modifier le profil',
        username: "Nom d'utilisateur",
        about_me: 'À propos de moi',
        save: 'Enregistrer',
        notifications: 'Notifications',
        privacy: 'Confidentialité',
        theme: 'Thème',
        language: 'Langue',
        storage: 'Stockage',
        about: 'À propos',
        help: 'Aide',
        logout: 'Déconnexion',
        version: 'v1.0',
        tagline: 'Communication fraîche chaque jour 🥒',
        select_language: 'Choisir la langue',
        settings_saved: 'Paramètres enregistrés',
        profile_updated: 'Profil mis à jour',
        enter_username: "Entrez le nom d'utilisateur",
        in_development: 'en développement'
    },
    be: {
        app_name: 'Kukumber Messenger',
        settings: 'Налады',
        edit_profile: 'Рэдагаваць профіль',
        username: 'Імя карыстальніка',
        about_me: 'Пра сябе',
        save: 'Захаваць',
        notifications: 'Апавяшчэнні',
        privacy: 'Прыватнасць',
        theme: 'Тэма',
        language: 'Мова',
        storage: 'Памяць',
        about: 'Пра праграму',
        help: 'Дапамога',
        logout: 'Выйсці',
        version: 'v1.0',
        tagline: 'Свежая камунікацыя кожны дзень 🥒',
        select_language: 'Абярыце мову',
        settings_saved: 'Налады захаваны',
        profile_updated: 'Профіль абноўлены',
        enter_username: 'Увядзіце імя карыстальніка',
        in_development: 'у распрацоўцы'
    },
    uk: {
        app_name: 'Kukumber Messenger',
        settings: 'Налаштування',
        edit_profile: 'Редагувати профіль',
        username: "Ім'я користувача",
        about_me: 'Про себе',
        save: 'Зберегти',
        notifications: 'Сповіщення',
        privacy: 'Конфіденційність',
        theme: 'Тема',
        language: 'Мова',
        storage: 'Пам\'ять',
        about: 'Про додаток',
        help: 'Допомога',
        logout: 'Вийти',
        version: 'v1.0',
        tagline: 'Свіже спілкування щодня 🥒',
        select_language: 'Виберіть мову',
        settings_saved: 'Налаштування збережено',
        profile_updated: 'Профіль оновлено',
        enter_username: 'Введіть ім\'я користувача',
        in_development: 'в розробці'
    },
    pl: {
        app_name: 'Kukumber Messenger',
        settings: 'Ustawienia',
        edit_profile: 'Edytuj profil',
        username: 'Nazwa użytkownika',
        about_me: 'O mnie',
        save: 'Zapisz',
        notifications: 'Powiadomienia',
        privacy: 'Prywatność',
        theme: 'Motyw',
        language: 'Język',
        storage: 'Pamięć',
        about: 'O aplikacji',
        help: 'Pomoc',
        logout: 'Wyloguj',
        version: 'v1.0',
        tagline: 'Świeża komunikacja każdego dnia 🥒',
        select_language: 'Wybierz język',
        settings_saved: 'Ustawienia zapisane',
        profile_updated: 'Profil zaktualizowany',
        enter_username: 'Wprowadź nazwę użytkownika',
        in_development: 'w rozwoju'
    },
    ko: {
        app_name: 'Kukumber Messenger',
        settings: '설정',
        edit_profile: '프로필 편집',
        username: '사용자 이름',
        about_me: '자기소개',
        save: '저장',
        notifications: '알림',
        privacy: '개인정보',
        theme: '테마',
        language: '언어',
        storage: '저장공간',
        about: '정보',
        help: '도움말',
        logout: '로그아웃',
        version: 'v1.0',
        tagline: '매일 신선한 소통 🥒',
        select_language: '언어 선택',
        settings_saved: '설정이 저장되었습니다',
        profile_updated: '프로필이 업데이트되었습니다',
        enter_username: '사용자 이름을 입력하세요',
        in_development: '개발 중'
    },
    nl: {
        app_name: 'Kukumber Messenger',
        settings: 'Instellingen',
        edit_profile: 'Profiel bewerken',
        username: 'Gebruikersnaam',
        about_me: 'Over mij',
        save: 'Opslaan',
        notifications: 'Meldingen',
        privacy: 'Privacy',
        theme: 'Thema',
        language: 'Taal',
        storage: 'Opslag',
        about: 'Over',
        help: 'Help',
        logout: 'Uitloggen',
        version: 'v1.0',
        tagline: 'Elke dag verse communicatie 🥒',
        select_language: 'Selecteer taal',
        settings_saved: 'Instellingen opgeslagen',
        profile_updated: 'Profiel bijgewerkt',
        enter_username: 'Voer gebruikersnaam in',
        in_development: 'in ontwikkeling'
    },
    pt_br: {
        app_name: 'Kukumber Messenger',
        settings: 'Configurações',
        edit_profile: 'Editar perfil',
        username: 'Nome de usuário',
        about_me: 'Sobre mim',
        save: 'Salvar',
        notifications: 'Notificações',
        privacy: 'Privacidade',
        theme: 'Tema',
        language: 'Idioma',
        storage: 'Armazenamento',
        about: 'Sobre',
        help: 'Ajuda',
        logout: 'Sair',
        version: 'v1.0',
        tagline: 'Comunicação fresca todos os dias 🥒',
        select_language: 'Selecione o idioma',
        settings_saved: 'Configurações salvas',
        profile_updated: 'Perfil atualizado',
        enter_username: 'Digite o nome de usuário',
        in_development: 'em desenvolvimento'
    },
    ca: {
        app_name: 'Kukumber Messenger',
        settings: 'Configuració',
        edit_profile: 'Editar perfil',
        username: "Nom d'usuari",
        about_me: 'Sobre mi',
        save: 'Desar',
        notifications: 'Notificacions',
        privacy: 'Privacitat',
        theme: 'Tema',
        language: 'Idioma',
        storage: 'Emmagatzematge',
        about: 'Quant a',
        help: 'Ajuda',
        logout: 'Tancar sessió',
        version: 'v1.0',
        tagline: 'Comunicació fresca cada dia 🥒',
        select_language: 'Selecciona l\'idioma',
        settings_saved: 'Configuració desada',
        profile_updated: 'Perfil actualitzat',
        enter_username: "Introdueix el nom d'usuari",
        in_development: 'en desenvolupament'
    },
    ms: {
        app_name: 'Kukumber Messenger',
        settings: 'Tetapan',
        edit_profile: 'Edit profil',
        username: 'Nama pengguna',
        about_me: 'Tentang saya',
        save: 'Simpan',
        notifications: 'Notifikasi',
        privacy: 'Privasi',
        theme: 'Tema',
        language: 'Bahasa',
        storage: 'Penyimpanan',
        about: 'Perihal',
        help: 'Bantuan',
        logout: 'Log keluar',
        version: 'v1.0',
        tagline: 'Komunikasi segar setiap hari 🥒',
        select_language: 'Pilih bahasa',
        settings_saved: 'Tetapan disimpan',
        profile_updated: 'Profil dikemas kini',
        enter_username: 'Masukkan nama pengguna',
        in_development: 'dalam pembangunan'
    },
    tr: {
        app_name: 'Kukumber Messenger',
        settings: 'Ayarlar',
        edit_profile: 'Profili düzenle',
        username: 'Kullanıcı adı',
        about_me: 'Hakkımda',
        save: 'Kaydet',
        notifications: 'Bildirimler',
        privacy: 'Gizlilik',
        theme: 'Tema',
        language: 'Dil',
        storage: 'Depolama',
        about: 'Hakkında',
        help: 'Yardım',
        logout: 'Çıkış yap',
        version: 'v1.0',
        tagline: 'Her gün taze iletişim 🥒',
        select_language: 'Dil seçin',
        settings_saved: 'Ayarlar kaydedildi',
        profile_updated: 'Profil güncellendi',
        enter_username: 'Kullanıcı adını girin',
        in_development: 'geliştirilme aşamasında'
    },
    fa: {
        app_name: 'Kukumber Messenger',
        settings: 'تنظیمات',
        edit_profile: 'ویرایش پروفایل',
        username: 'نام کاربری',
        about_me: 'درباره من',
        save: 'ذخیره',
        notifications: 'اعلان‌ها',
        privacy: 'حریم خصوصی',
        theme: 'پوسته',
        language: 'زبان',
        storage: 'فضای ذخیره‌سازی',
        about: 'درباره',
        help: 'راهنما',
        logout: 'خروج',
        version: 'v1.0',
        tagline: 'ارتباط تازه هر روز 🥒',
        select_language: 'انتخاب زبان',
        settings_saved: 'تنظیمات ذخیره شد',
        profile_updated: 'پروفایل به‌روزرسانی شد',
        enter_username: 'نام کاربری را وارد کنید',
        in_development: 'در حال توسعه'
    },
    uz: {
        app_name: 'Kukumber Messenger',
        settings: 'Sozlamalar',
        edit_profile: 'Profilni tahrirlash',
        username: 'Foydalanuvchi nomi',
        about_me: 'O\'zim haqimda',
        save: 'Saqlash',
        notifications: 'Bildirishnomalar',
        privacy: 'Maxfiylik',
        theme: 'Mavzu',
        language: 'Til',
        storage: 'Xotira',
        about: 'Ilova haqida',
        help: 'Yordam',
        logout: 'Chiqish',
        version: 'v1.0',
        tagline: 'Har kuni yangi muloqot 🥒',
        select_language: 'Tilni tanlang',
        settings_saved: 'Sozlamalar saqlandi',
        profile_updated: 'Profil yangilandi',
        enter_username: 'Foydalanuvchi nomini kiriting',
        in_development: 'ishlab chiqilmoqda'
    },
    ar: {
        app_name: 'Kukumber Messenger',
        settings: 'الإعدادات',
        edit_profile: 'تعديل الملف الشخصي',
        username: 'اسم المستخدم',
        about_me: 'عني',
        save: 'حفظ',
        notifications: 'الإشعارات',
        privacy: 'الخصوصية',
        theme: 'المظهر',
        language: 'اللغة',
        storage: 'التخزين',
        about: 'حول',
        help: 'مساعدة',
        logout: 'تسجيل الخروج',
        version: 'v1.0',
        tagline: 'تواصل منعش كل يوم 🥒',
        select_language: 'اختر اللغة',
        settings_saved: 'تم حفظ الإعدادات',
        profile_updated: 'تم تحديث الملف الشخصي',
        enter_username: 'أدخل اسم المستخدم',
        in_development: 'قيد التطوير'
    },
    id: {
        app_name: 'Kukumber Messenger',
        settings: 'Pengaturan',
        edit_profile: 'Edit profil',
        username: 'Nama pengguna',
        about_me: 'Tentang saya',
        save: 'Simpan',
        notifications: 'Notifikasi',
        privacy: 'Privasi',
        theme: 'Tema',
        language: 'Bahasa',
        storage: 'Penyimpanan',
        about: 'Tentang',
        help: 'Bantuan',
        logout: 'Keluar',
        version: 'v1.0',
        tagline: 'Komunikasi segar setiap hari 🥒',
        select_language: 'Pilih bahasa',
        settings_saved: 'Pengaturan disimpan',
        profile_updated: 'Profil diperbarui',
        enter_username: 'Masukkan nama pengguna',
        in_development: 'dalam pengembangan'
    },
    hu: {
        app_name: 'Kukumber Messenger',
        settings: 'Beállítások',
        edit_profile: 'Profil szerkesztése',
        username: 'Felhasználónév',
        about_me: 'Rólam',
        save: 'Mentés',
        notifications: 'Értesítések',
        privacy: 'Adatvédelem',
        theme: 'Téma',
        language: 'Nyelv',
        storage: 'Tárhely',
        about: 'Névjegy',
        help: 'Súgó',
        logout: 'Kijelentkezés',
        version: 'v1.0',
        tagline: 'Friss kommunikáció minden nap 🥒',
        select_language: 'Válasszon nyelvet',
        settings_saved: 'Beállítások mentve',
        profile_updated: 'Profil frissítve',
        enter_username: 'Adja meg a felhasználónevet',
        in_development: 'fejlesztés alatt'
    },
    iw: {
        app_name: 'Kukumber Messenger',
        settings: 'הגדרות',
        edit_profile: 'עריכת פרופיל',
        username: 'שם משתמש',
        about_me: 'עליי',
        save: 'שמירה',
        notifications: 'התראות',
        privacy: 'פרטיות',
        theme: 'ערכת נושא',
        language: 'שפה',
        storage: 'אחסון',
        about: 'אודות',
        help: 'עזרה',
        logout: 'התנתקות',
        version: 'v1.0',
        tagline: 'תקשורת רעננה כל יום 🥒',
        select_language: 'בחר שפה',
        settings_saved: 'ההגדרות נשמרו',
        profile_updated: 'הפרופיל עודכן',
        enter_username: 'הזן שם משתמש',
        in_development: 'בפיתוח'
    },
    hi: {
        app_name: 'Kukumber Messenger',
        settings: 'सेटिंग्स',
        edit_profile: 'प्रोफ़ाइल संपादित करें',
        username: 'उपयोगकर्ता नाम',
        about_me: 'मेरे बारे में',
        save: 'सहेजें',
        notifications: 'सूचनाएं',
        privacy: 'गोपनीयता',
        theme: 'थीम',
        language: 'भाषा',
        storage: 'भंडारण',
        about: 'के बारे में',
        help: 'सहायता',
        logout: 'लॉग आउट',
        version: 'v1.0',
        tagline: 'हर दिन ताज़ा संचार 🥒',
        select_language: 'भाषा चुनें',
        settings_saved: 'सेटिंग्स सहेजी गईं',
        profile_updated: 'प्रोफ़ाइल अपडेट की गई',
        enter_username: 'उपयोगकर्ता नाम दर्ज करें',
        in_development: 'विकास में'
    },
    kk: {
        app_name: 'Kukumber Messenger',
        settings: 'Параметрлер',
        edit_profile: 'Профильді өңдеу',
        username: 'Пайдаланушы аты',
        about_me: 'Өзім туралы',
        save: 'Сақтау',
        notifications: 'Хабарландырулар',
        privacy: 'Құпиялылық',
        theme: 'Тақырып',
        language: 'Тіл',
        storage: 'Сақтау орны',
        about: 'Қосымша туралы',
        help: 'Көмек',
        logout: 'Шығу',
        version: 'v1.0',
        tagline: 'Күн сайын жаңа қарым-қатынас 🥒',
        select_language: 'Тілді таңдаңыз',
        settings_saved: 'Параметрлер сақталды',
        profile_updated: 'Профиль жаңартылды',
        enter_username: 'Пайдаланушы атын енгізіңіз',
        in_development: 'әзірленуде'
    },
    zh: {
        app_name: 'Kukumber Messenger',
        settings: '设置',
        edit_profile: '编辑个人资料',
        username: '用户名',
        about_me: '关于我',
        save: '保存',
        notifications: '通知',
        privacy: '隐私',
        theme: '主题',
        language: '语言',
        storage: '存储',
        about: '关于',
        help: '帮助',
        logout: '退出登录',
        version: 'v1.0',
        tagline: '每天新鲜沟通 🥒',
        select_language: '选择语言',
        settings_saved: '设置已保存',
        profile_updated: '个人资料已更新',
        enter_username: '请输入用户名',
        in_development: '开发中'
    }
};

// Текущий язык (по умолчанию русский)
var currentLanguage = localStorage.getItem('kukumber_language') || 'ru';

// Функция применения перевода на страницу
function applyTranslations() {
    var t = translations[currentLanguage];
    if (!t) return;
    
    // Заголовок настроек
    var settingsHeader = document.querySelector('#settings-tab .settings-header h2');
    if (settingsHeader) settingsHeader.textContent = t.settings;
    
    // Имя пользователя в профиле (не переводим, оставляем как есть)
    
    // Пункты меню настроек
    var menuItems = document.querySelectorAll('#settings-tab .settings-section .settings-item');
    var menuLabels = [t.notifications, t.privacy, t.theme, t.language, t.storage, t.about, t.help, t.logout];
    for (var i = 0; i < menuItems.length && i < menuLabels.length; i++) {
        var span = menuItems[i].querySelector('span:nth-child(2)');
        if (span && i !== 0) span.textContent = menuLabels[i];
    }
    
    // Подвал
    var footer = document.querySelector('#settings-tab .settings-footer');
    if (footer) {
        var firstP = footer.querySelector('p:first-child');
        var lastP = footer.querySelector('p:last-child');
        if (firstP) firstP.textContent = t.app_name;
        if (lastP) lastP.textContent = t.tagline;
    }
}

// Показать модалку выбора языка
function showLanguageSettings() {
    var langCodes = {
        ru: 'Русский',
        en: 'English',
        es: 'Español',
        de: 'Deutsch',
        it: 'Italiano',
        fr: 'Français',
        be: 'Беларуская',
        uk: 'Українська',
        pl: 'Polski',
        ko: '한국어',
        nl: 'Nederlands',
        pt_br: 'Português (Brasil)',
        ca: 'Català',
        ms: 'Bahasa Melayu',
        tr: 'Türkçe',
        fa: 'فارسی',
        uz: 'Oʻzbekcha',
        ar: 'العربية',
        id: 'Bahasa Indonesia',
        hu: 'Magyar',
        iw: 'עברית',
        hi: 'हिन्दी',
        kk: 'Қазақша',
        zh: '中文'
    };
    
    var langList = '';
    for (var code in langCodes) {
        var isSelected = (code === currentLanguage);
        langList += '<div class="user-item" onclick="setLanguage(\'' + code + '\')" style="justify-content:space-between; cursor:pointer;">' +
            '<span>' + (isSelected ? '✓ ' : '') + langCodes[code] + '</span>' +
            '<span style="color:var(--forest);">' + (isSelected ? '✓' : '→') + '</span>' +
        '</div>';
    }
    
    // Закрываем старую модалку если есть
    var oldModal = document.getElementById('temp-language-modal');
    if (oldModal) oldModal.remove();
    
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'temp-language-modal';
    modal.innerHTML = '<div class="modal-content">' +
        '<div class="modal-header"><h3>' + (translations[currentLanguage]?.select_language || 'Выберите язык') + '</h3><button onclick="closeLanguageModal()" class="btn-close">×</button></div>' +
        '<div class="users-list" style="max-height:70vh;">' + langList + '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
}

function closeLanguageModal() {
    var modal = document.getElementById('temp-language-modal');
    if (modal) modal.remove();
}

function setLanguage(langCode) {
    if (translations[langCode]) {
        currentLanguage = langCode;
        localStorage.setItem('kukumber_language', langCode);
        showNotification(translations[langCode]?.settings_saved || 'Language changed', 'success');
        closeLanguageModal();
        applyTranslations();
        updateModalTexts();
    }
}

function updateModalTexts() {
    var t = translations[currentLanguage];
    if (!t) return;
    
    var editProfileTitle = document.querySelector('#edit-profile-modal .modal-header h3');
    if (editProfileTitle) editProfileTitle.textContent = t.edit_profile;
    
    var editUsername = document.getElementById('edit-username');
    if (editUsername) editUsername.placeholder = t.username;
    
    var editBio = document.getElementById('edit-bio');
    if (editBio) editBio.placeholder = t.about_me;
    
    var saveBtn = document.querySelector('#edit-profile-modal .btn-primary');
    if (saveBtn) saveBtn.textContent = t.save;
}

// Редактирование профиля
function showEditProfileModal() {
    var t = translations[currentLanguage];
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    document.getElementById('edit-username').value = currentUserData?.username || '';
    document.getElementById('edit-bio').value = currentUserData?.bio || '';
    
    var preview = document.getElementById('edit-avatar-preview');
    if (currentUserData?.avatar) {
        preview.style.backgroundImage = 'url(' + currentUserData.avatar + ')';
        preview.style.backgroundSize = 'cover';
        preview.textContent = '';
    } else {
        preview.style.backgroundImage = '';
        preview.textContent = '🥒';
    }
    
    // Обновляем текст на текущем языке
    var header = document.querySelector('#edit-profile-modal .modal-header h3');
    if (header) header.textContent = t.edit_profile;
    var usernameInput = document.getElementById('edit-username');
    if (usernameInput) usernameInput.placeholder = t.username;
    var bioInput = document.getElementById('edit-bio');
    if (bioInput) bioInput.placeholder = t.about_me;
    var saveBtn = document.querySelector('#edit-profile-modal .btn-primary');
    if (saveBtn) saveBtn.textContent = t.save;
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

function previewEditAvatar(event) {
    var file = event.target.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('edit-avatar-preview');
            preview.style.backgroundImage = 'url(' + e.target.result + ')';
            preview.style.backgroundSize = 'cover';
            preview.textContent = '';
        };
        reader.readAsDataURL(file);
        window.pendingAvatarFile = file;
    }
}

function saveProfile() {
    var t = translations[currentLanguage];
    var newUsername = document.getElementById('edit-username').value.trim();
    if (!newUsername) {
        showNotification(t.enter_username, 'error');
        return;
    }
    var newBio = document.getElementById('edit-bio').value.trim();
    var updates = { username: newUsername, bio: newBio };
    
    function saveData(avatarUrl) {
        if (avatarUrl) updates.avatar = avatarUrl;
        database.ref('users/' + currentUser.uid).update(updates)
            .then(function() {
                closeEditProfileModal();
                showNotification(t.profile_updated, 'success');
                if (typeof updateUserDisplay === 'function') updateUserDisplay();
            })
            .catch(function(err) { showNotification('Error', 'error'); });
    }
    
    if (window.pendingAvatarFile) {
        uploadImageToImgBB(window.pendingAvatarFile)
            .then(function(data) {
                window.pendingAvatarFile = null;
                saveData(data.url);
            })
            .catch(function() { saveData(null); });
    } else {
        saveData(null);
    }
}

// Прочие функции настроек
function showNotificationSettings() {
    var t = translations[currentLanguage];
    showNotification(t.notifications + ': ' + t.in_development, 'info');
}
function showPrivacySettings() {
    var t = translations[currentLanguage];
    showNotification(t.privacy + ': ' + t.in_development, 'info');
}
function showThemeSettings() {
    var t = translations[currentLanguage];
    showNotification(t.theme + ': ' + t.in_development, 'info');
}
function showStorageSettings() {
    var t = translations[currentLanguage];
    showNotification(t.storage + ': ' + t.in_development, 'info');
}
function showAbout() {
    var t = translations[currentLanguage];
    alert(t.app_name + ' ' + (t.version || 'v1.0') + '\n\n' + (t.tagline || 'Свежее общение каждый день 🥒'));
}
function showHelp() {
    var t = translations[currentLanguage];
    showNotification(t.help + ': ' + t.in_development, 'info');
}

// Загружаем перевод при старте
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        applyTranslations();
    });
} else {
    applyTranslations();
        }
