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

    // تحديد القائمة التي سيتم عرضها
    let viewList = activeList;
    if (currentStatusFilter === 'archived') {
        viewList = archivedList;
    } else if (currentStatusFilter !== 'all') {
        viewList = activeList.filter(res => res.status === currentStatusFilter);
    }

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

        html += `
            <div class="bg-gray-50 border ${borderClass} rounded-2xl p-4 relative hover:border-maldiva-teal transition-all">
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
                        <span class="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold ml-auto"><i class="fa-solid fa-clock"></i> ${res.duration || 1} Jour(s)</span>
                    </div>
                    <div class="pt-1">${itemsHTML}</div>
                </div>
                
                <div class="flex justify-between items-center gap-2 flex-wrap">
                    <span class="text-sm font-extrabold text-maldiva-dark">${res.totalPrice}</span>
                    <div class="flex items-center gap-1">
                        <button onclick="window.setReservationStatus('${res.trackingCode}', 'approved')" class="bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold px-2 py-1.5 rounded">Accepter</button>
                        <button onclick="window.setReservationStatus('${res.trackingCode}', 'declined')" class="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1.5 rounded">Refuser</button>
                        <button onclick="window.dispatchWhatsAppMessage('${res.trackingCode}')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i></button>
                        ${archiveBtn}
                        <button onclick="window.prepareDelete('${res.trackingCode}')" class="bg-gray-200 hover:bg-gray-300 text-gray-600 p-1.5 rounded text-[10px]" title="Suppression"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
};

// ========================================================
// 5. العمليات (قبول، رفض، أرشفة، حذف)
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
// 6. نظام رسائل الواتساب (WhatsApp) المنسق
// ========================================================
export const dispatchWhatsAppMessage = async (trackingCode) => {
    const list = await getAdminReservations();
    const res = list.find(item => item.trackingCode === trackingCode);
    
    if (!res) return showNotification("Réservation introuvable !", "error");
    
    // تنظيف رقم الهاتف وإضافة رمز الدولة
    let cleanPhone = res.clientPhone.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.substring(1);
    if (cleanPhone.startsWith('00213')) cleanPhone = cleanPhone.substring(5); 
    else if (cleanPhone.startsWith('213')) cleanPhone = cleanPhone.substring(3);
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1); 
    cleanPhone = '213' + cleanPhone;

    const itemsStr = Object.entries(res.items || {}).map(([name, qty]) => `• ${qty} x ${name}`).join('\n');
    let messageText = "";

    // ترتيب النص لمنع اختلاط اللغتين في الكود
    const arabicGreeting = `مرحباً ${res.clientName}!`;
    const arabicAccepted = `تم تأكيد حجزك في نادي مالديفا الشاطئي ✔️`;
    const arabicDeclined = `نعتذر لعدم تمكننا من قبول حجزك ليوم ${res.visitDate} نظراً لعدم توفر الأماكن.`;

    if (res.status === 'approved') {
        messageText = 
            `Bonjour ${res.clientName}! 🏖️\n\n` +
            `Votre demande chez *Maldiva Beach Club* a été *CONFIRMÉE* ✔️\n\n` +
            `📝 *Détails :*\n` +
            `• Code : #${res.trackingCode}\n` +
            `• Date : ${res.visitDate} (Pour ${res.duration || 1} Jours)\n` +
            `• Équipements :\n${itemsStr}\n` +
            `• Total : *${res.totalPrice}*\n\n` +
            `⚠️ Important : Veuillez vous présenter au club avant 10h30.\n\n` +
            `--- \n` +
            `${arabicGreeting} ${arabicAccepted}`;
            
    } else if (res.status === 'declined') {
        messageText = 
            `Bonjour ${res.clientName},\n\n` +
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
// 7. تصدير الدوال للاستخدام المباشر في HTML
// ========================================================
window.verifyAdminLogin = verifyAdminLogin;
window.logoutAdmin = logoutAdmin;
window.setAdminDateFilterToday = setAdminDateFilterToday;
window.clearAdminDateFilter = clearAdminDateFilter;
window.toggleNautiqueFilter = toggleNautiqueFilter;
window.setStatusFilter = setStatusFilter;
window.renderAdminReservations = renderAdminReservations;
window.setReservationStatus = setReservationStatus;
window.setArchiveStatus = setArchiveStatus;
window.prepareDelete = prepareDelete;
window.executePendingDelete = executePendingDelete;
window.dispatchWhatsAppMessage = dispatchWhatsAppMessage;
