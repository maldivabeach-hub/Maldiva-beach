// /js/admin.js

import { getAdminReservations, updateReservationData, deleteReservation } from './reservationService.js';
import { showNotification, openConfirmModal, closeConfirmModal } from './ui.js';

// ========================================================
// 1. المتغيرات العامة (Global State)
// ========================================================
let adminAuthorized = false;
let currentStatusFilter = 'all';
let filterNautique = false;
let pendingDeleteId = null;
let currentEditId = null; // مُتغير لحفظ كود الحجز الذي يتم تعديله حالياً
let currentRenderedList = []; // مصفوفة لحفظ القائمة المعروضة حالياً لاستخدامها في الطباعة والتصدير

// أسعار المعدات لحساب المجموع التلقائي عند التعديل (يمكنك تغيير هذه القيم بأسعارك الحقيقية)
const ITEM_PRICES = {
    'Parasol': 1500,
    'Transat': 1000,
    'Table': 1500,
    'Cabine VIP': 5000
};

// ========================================================
// 2. نظام تسجيل الدخول (Authentication)
// ========================================================
export const verifyAdminLogin = async () => {
    const pass = document.getElementById('admin-password').value;
    const error = document.getElementById('admin-login-error');
    
    if (pass === 'mhdrb26') {
        adminAuthorized = true;
        error.classList.add('hidden'); 
        document.getElementById('admin-login-view').classList.add('hidden'); 
        document.getElementById('admin-dashboard-view').classList.remove('hidden');
        
        showNotification("Bienvenue, Administrateur !", "success");
        await renderAdminReservations(true); 
    } else { 
        error.classList.remove('hidden'); 
    }
};

export const logoutAdmin = () => {
    adminAuthorized = false;
    document.getElementById('admin-password').value = ''; 
    document.getElementById('admin-login-view').classList.remove('hidden'); 
    document.getElementById('admin-dashboard-view').classList.add('hidden'); 
    showNotification("Déconnecté.", "info"); 
};

// ========================================================
// 3. نظام الفلترة والبحث (Filters & Search)
// ========================================================
export const setAdminDateFilterToday = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const today = new Date(Date.now() - tzoffset).toISOString().split('T')[0];
    document.getElementById('admin-filter-date').value = today;
    renderAdminReservations();
};

export const clearAdminDateFilter = () => {
    document.getElementById('admin-filter-date').value = '';
    document.getElementById('admin-search-mld').value = '';
    currentStatusFilter = 'all'; 
    filterNautique = false;
    
    const btnNautique = document.getElementById('btn-filter-nautique');
    if (btnNautique) {
        btnNautique.classList.remove('bg-blue-600', 'text-white');
        btnNautique.classList.add('bg-blue-50', 'text-blue-600');
    }
    renderAdminReservations();
};

export const toggleNautiqueFilter = () => {
    filterNautique = !filterNautique;
    const btn = document.getElementById('btn-filter-nautique');
    
    if (filterNautique) {
        btn.classList.add('bg-blue-600', 'text-white');
        btn.classList.remove('bg-blue-50', 'text-blue-600');
    } else {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-blue-50', 'text-blue-600');
    }
    renderAdminReservations();
};

export const setStatusFilter = (status) => {
    currentStatusFilter = status;
    renderAdminReservations();
};

// ========================================================
// 4. دالة عرض الحجوزات (Render Reservations)
// ========================================================
export const renderAdminReservations = async (forceRefresh = false) => {
    if (!adminAuthorized) return;

    const filterDate = document.getElementById('admin-filter-date').value;
    const searchInput = document.getElementById('admin-search-mld').value.toLowerCase().trim();
    
    let allReservationsList = await getAdminReservations(forceRefresh);
    let totalRevenue = 0;
    
    // فلترة القائمة حسب البحث والتاريخ
    let matchingList = allReservationsList.filter(res => {
        if (filterDate && res.visitDate !== filterDate) return false;
        
        if (searchInput) {
            const matchCode = res.trackingCode.toLowerCase().includes(searchInput);
            const matchName = res.clientName.toLowerCase().includes(searchInput);
            const matchPhone = res.clientPhone.includes(searchInput);
            if (!matchCode && !matchName && !matchPhone) return false;
        }

        if (filterNautique) {
            const hasNautique = Object.keys(res.items || {}).some(item => 
                item.includes('Jet-Ski') || item.includes('Pédalo') || 
                item.includes('Kayak') || item.includes('Bouée') || item.includes('Bateau')
            );
            if (!hasNautique) return false;
        }
        return true;
    });

    // الترتيب الذكي: الأحدث يظهر أولاً
    matchingList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
    });

    // حساب المداخيل
    matchingList.forEach(res => {
        if (res.status === 'approved' || res.status === 'pending') {
            totalRevenue += (parseInt(res.totalPrice.replace(/[^\d]/g, '')) || 0);
        }
    });
    
    document.getElementById('stat-revenue').innerText = totalRevenue.toLocaleString() + ' DA';

    // تصنيف الحجوزات
    let activeList = matchingList.filter(res => !res.isArchived);
    let archivedList = matchingList.filter(res => res.isArchived);

    document.getElementById('stat-total').innerText = activeList.length;
    document.getElementById('stat-pending').innerText = activeList.filter(i => i.status === 'pending').length;
    document.getElementById('stat-approved').innerText = activeList.filter(i => i.status === 'approved').length;
    document.getElementById('stat-declined').innerText = activeList.filter(i => i.status === 'declined').length;
    document.getElementById('stat-archived').innerText = archivedList.length;

    // تحديد القائمة التي سيتم عرضها بناء على الفلتر
    let viewList = activeList;
    if (currentStatusFilter === 'archived') {
        viewList = archivedList;
    } else if (currentStatusFilter !== 'all') {
        viewList = activeList.filter(res => res.status === currentStatusFilter);
    }

    // حفظ القائمة لكي نستخدمها لاحقاً في التصدير (Excel) والطباعة
    currentRenderedList = viewList;

    // تحديث شكل أزرار الإحصائيات (الألوان)
    const setBtnStyle = (id, isActive, activeColors, inactiveColors) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.className = `cursor-pointer p-3 rounded-2xl border shadow-sm text-center transition-all ${isActive ? activeColors + ' transform scale-105' : inactiveColors}`;
    };

    setBtnStyle('filter-btn-all', currentStatusFilter === 'all', 'bg-gray-200 border-gray-300', 'bg-gray-50 border-gray-200 hover:bg-gray-100');
    setBtnStyle('filter-btn-pending', currentStatusFilter === 'pending', 'bg-yellow-200 border-yellow-300', 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100');
    setBtnStyle('filter-btn-approved', currentStatusFilter === 'approved', 'bg-green-200 border-green-300', 'bg-green-50 border-green-100 hover:bg-green-100');
    setBtnStyle('filter-btn-declined', currentStatusFilter === 'declined', 'bg-red-200 border-red-300', 'bg-red-50 border-red-100 hover:bg-red-100');
    setBtnStyle('filter-btn-archived', currentStatusFilter === 'archived', 'bg-purple-200 border-purple-300', 'bg-purple-50 border-purple-100 hover:bg-purple-100');
    
    // بناء بطاقات الحجز
    const container = document.getElementById('admin-reservations-list');
    if (viewList.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs">Aucune réservation trouvée.</div>`; 
        return;
    }

    let html = '';
    const todayStr = new Date().toISOString().split('T')[0];

    viewList.forEach(res => {
        let itemsHTML = '';
        for (let [name, qty] of Object.entries(res.items || {})) {
            itemsHTML += `<span class="bg-teal-50 text-teal-800 text-[10px] px-2 py-0.5 rounded border border-teal-100 font-semibold mb-1 mr-1 inline-block">${qty} x ${name}</span> `;
        }
        
        const statusStyles = { 
            'pending': 'bg-yellow-100 text-yellow-800', 
            'approved': 'bg-green-100 text-green-800', 
            'declined': 'bg-red-100 text-red-800' 
        };

        let archiveBtn = res.isArchived 
            ? `<button onclick="window.setArchiveStatus('${res.trackingCode}', false)" class="bg-purple-100 hover:bg-purple-200 text-purple-600 p-1.5 rounded text-[10px]" title="Désarchiver"><i class="fa-solid fa-box-open"></i></button>`
            : `<button onclick="window.setArchiveStatus('${res.trackingCode}', true)" class="bg-purple-100 hover:bg-purple-200 text-purple-600 p-1.5 rounded text-[10px]" title="Archiver"><i class="fa-solid fa-box-archive"></i></button>`;

        let borderClass = res.isArchived ? 'border-purple-200' : 'border-gray-100';
        let archivedBadge = res.isArchived ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-600"><i class="fa-solid fa-box-archive"></i> Archivé</span>` : '';

        // تمييز الحجوزات الجديدة
        let isNew = false;
        if(res.createdAt && res.status === 'pending') {
            let resDateStr = new Date(res.createdAt).toISOString().split('T')[0];
            if(resDateStr === todayStr) isNew = true;
        }
        let newBadgeHTML = isNew ? `<span class="absolute -top-3 -right-2 bg-red-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full animate-pulse shadow-md z-10">NOUVEAU / جديد</span>` : '';

        // شارة وقت الوصول
        let arrivalHtml = res.arrivalTime ? `<span class="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-bold"><i class="fa-solid fa-clock-rotate-left"></i> Arr: ${res.arrivalTime}</span>` : '';

        html += `
            <div class="bg-gray-50 border ${borderClass} rounded-2xl p-4 relative hover:border-maldiva-teal transition-all mt-2">
                ${newBadgeHTML}
                <div class="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap">
                    <div>
                        <h5 class="font-bold text-sm text-gray-800">${res.clientName} <span class="text-xs text-gray-400 font-mono">#${res.trackingCode}</span></h5>
                        <a href="tel:${res.clientPhone}" class="text-xs text-maldiva-teal hover:underline font-semibold flex items-center gap-1 mt-0.5"><i class="fa-solid fa-phone"></i> ${res.clientPhone}</a>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${statusStyles[res.status || 'pending']}">${res.status || 'pending'}</span>
                        ${archivedBadge}
                    </div>
                </div>
                
                <div class="text-xs text-gray-600 space-y-1 my-3 border-t border-b border-gray-100 py-2">
                    <div class="flex items-center gap-2">
                        <strong class="text-maldiva-dark"><i class="fa-regular fa-calendar"></i> ${res.visitDate}</strong>
                        ${arrivalHtml}
                        <span class="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold ml-auto"><i class="fa-solid fa-clock"></i> ${res.duration || 1} Jour(s)</span>
                    </div>
                    <div class="pt-1">${itemsHTML}</div>
                </div>
                
                <div class="flex justify-between items-center gap-2 flex-wrap">
                    <span class="text-sm font-extrabold text-maldiva-dark">${res.totalPrice}</span>
                    <div class="flex items-center gap-1">
                        <button onclick="window.printReservation('${res.trackingCode}')" class="bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold px-2 py-1.5 rounded flex items-center gap-1" title="Imprimer le ticket"><i class="fa-solid fa-print"></i></button>

                        <button onclick="window.setReservationStatus('${res.trackingCode}', 'approved')" class="bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold px-2 py-1.5 rounded">Accepter</button>
                        <!-- زر التعديل الجديد -->
                        <button onclick="window.openEditModal('${res.trackingCode}')" class="bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] font-bold px-2 py-1.5 rounded flex items-center gap-1" title="Modifier"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="window.setReservationStatus('${res.trackingCode}', 'declined')" class="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1.5 rounded">Refuser</button>
                        <button onclick="window.dispatchWhatsAppMessage('${res.trackingCode}')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded flex items-center gap-1"><i class="fa-brands fa-whatsapp text-sm"></i></button>
                        ${archiveBtn}
                        <button onclick="window.prepareDelete('${res.trackingCode}')" class="bg-gray-200 hover:bg-gray-300 text-gray-600 p-1.5 rounded text-[10px]" title="Suppression"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
};

// ========================================================
// 5. نافذة تعديل الحجوزات (Edit Modal) - جديدة
// ========================================================
export const openEditModal = (trackingCode) => {
    const res = currentRenderedList.find(r => r.trackingCode === trackingCode);
    if (!res) return;
    
    currentEditId = trackingCode;

    document.getElementById('edit-modal-code').innerText = `Code: #${res.trackingCode}`;

    // تنسيق وعرض وقت إنشاء الحجز
    let timestampText = "--/--/---- --:--";
    if (res.createdAt) {
        const d = new Date(res.createdAt);
        timestampText = d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    }
    document.getElementById('edit-modal-timestamp').innerText = timestampText;

    // ملء الحقول الأساسية
    document.getElementById('edit-name').value = res.clientName || '';
    document.getElementById('edit-phone').value = res.clientPhone || '';
    document.getElementById('edit-date').value = res.visitDate || '';
    document.getElementById('edit-time').value = res.arrivalTime || ''; 
    document.getElementById('edit-duration').value = res.duration || '1';

    // ملء قائمة المعدات التي حجزها مسبقاً
    const container = document.getElementById('edit-items-container');
    container.innerHTML = ''; 
    if (res.items) {
        for (let [name, qty] of Object.entries(res.items)) {
            // محاولة إيجاد الاسم الأقرب للمعدات لضبط الـ Select
            let val = 'Parasol';
            let lowerName = name.toLowerCase();
            if(lowerName.includes('transat')) val = 'Transat';
            else if(lowerName.includes('table')) val = 'Table';
            else if(lowerName.includes('vip')) val = 'Cabine VIP';
            else val = 'Parasol';

            addEditItemRow(val, qty);
        }
    }
    if (container.children.length === 0) {
        addEditItemRow('Parasol', 1); // عنصر افتراضي إذا كانت فارغة
    }

    calcEditTotal(); // تحديث السعر الافتراضي

    // إظهار النافذة
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

export const closeEditModal = () => {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        currentEditId = null;
    }, 300);
};

// دالة مساعدة لإنشاء صف معدات جديد (تُستدعى عند الفتح وعند النقر على زر "إضافة")
export const addEditItemRow = (typeVal = 'Parasol', qty = 1) => {
    const container = document.getElementById('edit-items-container');
    const newRow = document.createElement('div');
    newRow.className = 'flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm edit-item-row';
    
    newRow.innerHTML = `
        <select class="flex-grow bg-transparent text-xs outline-none border-none focus:ring-0 edit-item-select" onchange="window.calcEditTotal()">
            <option value="Parasol" ${typeVal === 'Parasol' ? 'selected' : ''}>Parasol (مظلة)</option>
            <option value="Transat" ${typeVal === 'Transat' ? 'selected' : ''}>Transat (كرسي)</option>
            <option value="Table" ${typeVal === 'Table' ? 'selected' : ''}>Table (طاولة)</option>
            <option value="Cabine VIP" ${typeVal === 'Cabine VIP' ? 'selected' : ''}>Cabine VIP</option>
        </select>
        <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <button type="button" onclick="this.nextElementSibling.stepDown(); window.calcEditTotal()" class="px-2 py-1 text-gray-500 hover:bg-gray-200">-</button>
            <input type="number" min="1" value="${qty}" class="w-10 text-center text-xs bg-transparent border-none focus:ring-0 edit-item-qty" onchange="window.calcEditTotal()">
            <button type="button" onclick="this.previousElementSibling.stepUp(); window.calcEditTotal()" class="px-2 py-1 text-gray-500 hover:bg-gray-200">+</button>
        </div>
        <button type="button" class="text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors" onclick="this.parentElement.remove(); window.calcEditTotal()">
            <i class="fa-solid fa-trash text-xs"></i>
        </button>
    `;
    container.appendChild(newRow);
    calcEditTotal();
};

// حساب مجموع السعر ديناميكياً داخل نافذة التعديل
export const calcEditTotal = () => {
    const rows = document.querySelectorAll('.edit-item-row');
    let baseTotal = 0;

    rows.forEach(row => {
        const select = row.querySelector('.edit-item-select');
        const qtyInput = row.querySelector('.edit-item-qty');
        if (select && qtyInput) {
            const price = ITEM_PRICES[select.value] || 0;
            baseTotal += price * parseInt(qtyInput.value || 1);
        }
    });

    const duration = parseInt(document.getElementById('edit-duration').value || 1);
    let total = baseTotal * duration;

    // تطبيق التخفيضات إن وجدت
    if (duration === 5) total = total * 0.9;
    if (duration === 7) total = total * 0.85;

    document.getElementById('edit-total-price').innerText = Math.round(total) + ' DA';
};

// حفظ البيانات المحدثة في قاعدة البيانات
export const saveEditedReservation = async () => {
    if (!currentEditId) return;

    const name = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const date = document.getElementById('edit-date').value;
    const time = document.getElementById('edit-time').value;
    const duration = document.getElementById('edit-duration').value;
    const totalStr = document.getElementById('edit-total-price').innerText;

    // تجميع المعدات
    const items = {};
    document.querySelectorAll('.edit-item-row').forEach(row => {
        const itemType = row.querySelector('.edit-item-select').value;
        const qty = parseInt(row.querySelector('.edit-item-qty').value || 1);
        if (qty > 0) {
            if (items[itemType]) items[itemType] += qty;
            else items[itemType] = qty;
        }
    });

    if (!name || !phone || !date) {
        return showNotification("Veuillez remplir les champs obligatoires", "error");
    }

    try {
        await updateReservationData(currentEditId, {
            clientName: name,
            clientPhone: phone,
            visitDate: date,
            arrivalTime: time,
            duration: parseInt(duration),
            items: items,
            totalPrice: totalStr
        });

        showNotification("Réservation modifiée avec succès !", "success");
        closeEditModal();
        renderAdminReservations(); // تحديث الواجهة
    } catch (error) {
        showNotification("Erreur lors de la modification", "error");
    }
};


// ========================================================
// 6. العمليات (قبول، رفض، أرشفة، حذف)
// ========================================================
export const setReservationStatus = async (trackingCode, newStatus) => {
    try {
        await updateReservationData(trackingCode, { status: newStatus });
        showNotification("Statut mis à jour !", "success");
        renderAdminReservations();
    } catch (e) {
        showNotification("Erreur lors de la mise à jour.", "error");
    }
};

export const setArchiveStatus = async (trackingCode, isArchived) => {
    try {
        await updateReservationData(trackingCode, { isArchived: isArchived });
        showNotification(isArchived ? "Réservation archivée !" : "Réservation restaurée !", "success");
        renderAdminReservations();
    } catch(e) {
        showNotification("Erreur.", "error");
    }
};

export const prepareDelete = (trackingCode) => {
    pendingDeleteId = trackingCode;
    openConfirmModal();
};

export const executePendingDelete = async () => {
    if (!pendingDeleteId) return;
    try {
        await deleteReservation(pendingDeleteId);
        showNotification("Réservation supprimée !", "success");
        closeConfirmModal();
        renderAdminReservations();
    } catch(e) {
        showNotification("Erreur de suppression.", "error");
    }
    pendingDeleteId = null;
};

// ========================================================
// 7. نظام رسائل الواتساب (WhatsApp)
// ========================================================
export const dispatchWhatsAppMessage = async (trackingCode) => {
    const res = currentRenderedList.find(item => item.trackingCode === trackingCode);
    
    if (!res) return showNotification("Réservation introuvable !", "error");
    
    let cleanPhone = res.clientPhone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.startsWith('00213')) cleanPhone = cleanPhone.substring(5); 
    else if (cleanPhone.startsWith('213')) cleanPhone = cleanPhone.substring(3);
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1); 
    cleanPhone = '213' + cleanPhone;

    const itemsStr = Object.entries(res.items || {}).map(([name, qty]) => `• ${qty} x ${name}`).join('\n');
    let messageText = "";

    const arabicGreeting = `مرحباً ${res.clientName}!`;
    const arabicAccepted = `تم تأكيد حجزك في نادي مالديفا الشاطئي ✔️`;
    const arabicDeclined = `نعتذر لعدم تمكننا من قبول حجزك ليوم ${res.visitDate} نظراً لعدم توفر الأماكن.`;

    if (res.status === 'approved') {
        messageText = 
            `Bonjour *${res.clientName}*! 🏖️\n\n` +
            `Votre demande chez *Maldiva Beach Club* a été *CONFIRMÉE* ✔️\n\n` +
            `📝 *Détails de réservation :*\n` +
            `• Code : #${res.trackingCode}\n` +
            `• Date : ${res.visitDate} (Pour ${res.duration || 1} Jours)\n` +
            (res.arrivalTime ? `• Heure d'arrivée : ${res.arrivalTime}\n` : '') +
            `• Équipements :\n${itemsStr}\n` +
            `• Total à payer : *${res.totalPrice}*\n\n` +
            `📍 *Notre Position GPS (Localisation) :*\n` +
            `https://maps.app.goo.gl/uXv7d38zM2wRbG2S8\n\n` +
            `⚠️ *Important :* Veuillez vous présenter au club à l'heure convenue pour conserver vos places.\n\n` +
            `--- \n` +
            `${arabicGreeting} ${arabicAccepted}\n` +
            `موقعنا على خرائط جوجل في الرابط أعلاه 📍`;
            
    } else if (res.status === 'declined') {
        messageText = 
            `Bonjour *${res.clientName}*,\n\n` +
            `Nous sommes désolés, mais nous ne pouvons pas confirmer votre demande chez *Maldiva Beach Club* pour le ${res.visitDate} (places complètes). ❌\n\n` +
            `--- \n` +
            `${arabicGreeting} ${arabicDeclined}`;
            
    } else { 
        return showNotification("Acceptez ou refusez la réservation d'abord.", "error"); 
    }

    const anchor = document.createElement('a');
    anchor.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    anchor.target = '_blank'; 
    anchor.click();
};

// ========================================================
// 8. ميزة الطباعة (Print Ticket)
// ========================================================
export const printReservation = (trackingCode) => {
    const res = currentRenderedList.find(r => r.trackingCode === trackingCode);
    if (!res) return showNotification("Réservation introuvable", "error");

    let itemsHTML = '';
    for (let [name, qty] of Object.entries(res.items || {})) {
        itemsHTML += `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;"><span>${name}</span> <span>x${qty}</span></div>`;
    }

    // إنشاء تذكرة تشبه فواتير نقاط البيع (POS Receipt)
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Ticket #${res.trackingCode}</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; text-align: center; }
                .ticket { max-width: 300px; margin: 0 auto; border: 1px solid #000; padding: 15px; border-radius: 10px;}
                .logo { font-size: 26px; font-weight: bold; margin-bottom: 5px; }
                .subtitle { font-size: 12px; margin-bottom: 20px; }
                .details { text-align: left; font-size: 14px; margin-bottom: 20px; }
                .details p { margin: 5px 0; }
                .total { font-size: 18px; font-weight: bold; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
                .footer { font-size: 12px; margin-top: 20px; font-weight: bold; }
                @media print {
                    body { padding: 0; }
                    .ticket { border: none; }
                }
            </style>
        </head>
        <body>
            <div class="ticket">
                <div class="logo">MALDIVA</div>
                <div class="subtitle">Beach Club - Tipaza</div>
                <hr style="border-top: 1px dashed #000;">
                <div class="details">
                    <p><strong>Code:</strong> #${res.trackingCode}</p>
                    <p><strong>Client:</strong> ${res.clientName}</p>
                    <p><strong>Date:</strong> ${res.visitDate}</p>
                    ${res.arrivalTime ? `<p><strong>Heure:</strong> ${res.arrivalTime}</p>` : ''}
                    <p><strong>Durée:</strong> ${res.duration || 1} Jour(s)</p>
                </div>
                <div style="text-align: left; margin-bottom: 10px; font-weight: bold;">Équipements :</div>
                <div style="text-align: left; font-size: 13px;">
                    ${itemsHTML}
                </div>
                <div class="total">
                    Total: ${res.totalPrice}
                </div>
                <div class="footer">
                    Merci de votre visite !<br><br>
                    نتمنى لكم قضاء وقت ممتع
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// ========================================================
// 9. ميزة تصدير البيانات إلى Excel/CSV
// ========================================================
export const exportToCSV = () => {
    if (currentRenderedList.length === 0) {
        return showNotification("Aucune donnée à exporter", "error");
    }

    let csvContent = "\uFEFF"; 
    csvContent += "Code,Date Création,Client,Téléphone,Date de visite,Heure,Durée,Équipements,Total (DA),Statut\n";

    currentRenderedList.forEach(res => {
        let itemsStr = Object.entries(res.items || {}).map(([k, v]) => `${v}x ${k}`).join(" + ");
        
        let creationDate = res.createdAt ? new Date(res.createdAt).toLocaleString('fr-FR') : 'N/A';

        let row = [
            res.trackingCode,
            `"${creationDate}"`,
            `"${res.clientName}"`, 
            `"${res.clientPhone}"`,
            res.visitDate,
            res.arrivalTime || '',
            res.duration || 1,
            `"${itemsStr}"`,
            res.totalPrice.replace(/[^\d]/g, ''), 
            res.status
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Maldiva_Reservations_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification("Fichier Excel/CSV téléchargé avec succès !", "success");
};

// ========================================================
// 10. تصدير الدوال للاستخدام المباشر في HTML
// ========================================================
window.verifyAdminLogin = verifyAdminLogin;
window.logoutAdmin = logoutAdmin;
window.setAdminDateFilterToday = setAdminDateFilterToday;
window.clearAdminDateFilter = clearAdminDateFilter;
window.toggleNautiqueFilter = toggleNautiqueFilter;
window.setStatusFilter = setStatusFilter;
window.renderAdminReservations = renderAdminReservations;

// دوال التعديل الجديدة
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.addEditItemRow = addEditItemRow;
window.calcEditTotal = calcEditTotal;
window.saveEditedReservation = saveEditedReservation;

window.setReservationStatus = setReservationStatus;
window.setArchiveStatus = setArchiveStatus;
window.prepareDelete = prepareDelete;
window.executePendingDelete = executePendingDelete;
window.dispatchWhatsAppMessage = dispatchWhatsAppMessage;
window.printReservation = printReservation;
window.exportToCSV = exportToCSV;
