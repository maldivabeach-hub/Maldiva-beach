// /js/app.js
// ═══════════════════════════════════════════════════════════════
// Interface uniquement (Hero, onglets, panneau de récapitulatif,
// états de chargement, apparition au défilement).
//
// ⚠️ AUCUN calcul de prix ni logique de réservation ici :
//    tarifs      → js/prices.js
//    réservation → js/reservation.js
//    Firestore   → js/reservationService.js
//
// Ce fichier était auparavant un <script> en ligne à la fin de
// index.html. Il est chargé comme script CLASSIQUE (sans defer,
// sans module) exactement au même endroit, pour conserver le même
// ordre d'exécution — notamment pour que l'écouteur
// DOMContentLoaded ci-dessous se déclenche bien.
//    (Dans un type="module", il ne se déclencherait JAMAIS,
//     car les modules s'exécutent après DOMContentLoaded.)
// ═══════════════════════════════════════════════════════════════

/* ═══════════════════════════════════════════════════════
   سكريبت الواجهة فقط — لا يحتوي أي منطق تسعير أو حجز.
   كل الحسابات تبقى في js/prices.js و js/reservation.js
   ═══════════════════════════════════════════════════════ */

/* ---------- نافذة القواعد ---------- */
window.openRulesModal = function () {
    document.getElementById('rules-modal').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('rules-modal-content').classList.remove('translate-y-8', 'scale-95');
};
window.closeRulesModal = function () {
    document.getElementById('rules-modal').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('rules-modal-content').classList.add('translate-y-8', 'scale-95');
};

/* ---------- أزرار الـ Hero ---------- */
const scrollToTabs = () => {
    const bar = document.getElementById('tabs-bar');
    if (bar) window.scrollTo({ top: bar.offsetTop, behavior: 'smooth' });
};

// « Réserver maintenant » doit mener au FORMULAIRE, pas au haut du catalogue.
// Sur mobile le formulaire est sous le catalogue : sans ça, le client atterrissait
// devant la liste des équipements et devait faire défiler longtemps pour le trouver.
window.goToBooking = function () {
    window.switchTab('booking-form');

    const card = document.getElementById('form-card');
    const bar = document.getElementById('tabs-bar');
    if (!card) return scrollToTabs();

    // on laisse la place à la barre d'onglets collante pour ne pas cacher le titre
    const offset = (bar ? bar.offsetHeight : 0) + 12;
    const top = card.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });

    // curseur dans le premier champ, une fois le défilement terminé
    setTimeout(() => {
        const name = document.getElementById('client-name');
        if (name) name.focus({ preventScroll: true });
    }, 600);
};

window.goToTracking = function () { window.switchTab('tracking-section'); scrollToTabs(); };

/* ---------- قراءة حالة النموذج (بدون أي حساب) ---------- */
const readSelection = () => {
    const out = [];
    document.querySelectorAll('[data-qty-row]').forEach(row => {
        const span = document.getElementById(row.dataset.qtyRow);
        const qty = span ? (parseInt(span.innerText) || 0) : 0;
        if (qty > 0) out.push({ label: row.dataset.label || row.dataset.qtyRow, qty });
    });
    return out;
};

/* ---------- شريط الملخص الثابت ---------- */
const refreshSumbar = () => {
    const bar = document.getElementById('sumbar');
    const totalEl = document.getElementById('total-price');
    if (!bar || !totalEl) return;

    const picks = readSelection();
    // لا نعرض عدّاد الأطفال كعنصر مستقل في العدد
    const units = picks.filter(p => p.label.indexOf('enfants') === -1)
                       .reduce((s, p) => s + p.qty, 0);

    document.getElementById('sumbar-total').innerText = totalEl.innerText;
    document.getElementById('sumbar-count').innerText = units > 0 ? `· ${units} article${units > 1 ? 's' : ''}` : '';

    const onBooking = !document.getElementById('tab-booking-form').classList.contains('hidden');
    bar.classList.toggle('in', units > 0 && onBooking);
};

// نتابع تغيّر المجموع بدل تعديل منطق الحساب
const totalNode = document.getElementById('total-price');
if (totalNode) new MutationObserver(refreshSumbar).observe(totalNode, { childList: true, characterData: true, subtree: true });
document.querySelectorAll('#btn-tab-booking, #btn-tab-tracking').forEach(b => b.addEventListener('click', () => setTimeout(refreshSumbar, 0)));

/* ---------- لوحة المراجعة ---------- */
window.openReview = function () {
    const picks = readSelection();
    if (picks.length === 0) {
        window.showNotification && window.showNotification("Choisissez au moins un équipement ou une activité.", "error");
        return;
    }

    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const date = document.getElementById('visit-date').value;
    const durSel = document.getElementById('duration');
    const dur = durSel.options[durSel.selectedIndex].text;

    const row = (k, v) => `<div class="flex justify-between gap-3 border-b border-maldiva-line pb-2">
            <dt class="text-gray-500 flex-shrink-0">${k}</dt>
            <dd class="font-bold text-maldiva-ink text-right">${v || '<span class="text-red-500 font-semibold">à remplir</span>'}</dd></div>`;

    document.getElementById('review-who').innerHTML =
        row('Nom', name) + row('Téléphone', phone) + row('Date', date) + row('Durée', dur);

    document.getElementById('review-items').innerHTML = picks.map(p =>
        `<div class="flex justify-between gap-3 bg-maldiva-sand rounded-lg px-3 py-2">
            <span class="text-gray-700">${p.label}</span>
            <span class="font-bold text-maldiva-dark tabular-nums">× ${p.qty}</span></div>`).join('');

    // On réutilise le HTML déjà produit par calculateTotal (js/reservation.js) :
    // aucune règle métier n'est dupliquée ici, app.js ne fait que de l'affichage.
    const notes = document.getElementById('special-pricing-notes');
    const placement = document.getElementById('placement-note');
    const notesHTML = notes && !notes.classList.contains('hidden') ? notes.innerHTML : '';
    const placementHTML = placement && !placement.classList.contains('hidden') ? placement.innerHTML : '';
    document.getElementById('review-notes').innerHTML = placementHTML + notesHTML;
    document.getElementById('review-total').innerText = document.getElementById('total-price').innerText;

    const sheet = document.getElementById('review-sheet');
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('in'));
    document.body.style.overflow = 'hidden';
};

window.closeReview = function () {
    const sheet = document.getElementById('review-sheet');
    sheet.classList.remove('in');
    document.body.style.overflow = '';
    setTimeout(() => { sheet.hidden = true; }, 300);
};

/* ---------- حالات التحميل ---------- */
const withLoading = async (btn, fn) => {
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('is-loading');
    try { await fn(); }
    finally { btn.disabled = false; btn.classList.remove('is-loading'); }
};

window.uiSubmit = function (btn) {
    withLoading(btn, async () => {
        await window.submitReservation();
        // إذا نجح الإرسال تُفتح نافذة النجاح — نغلق لوحة المراجعة
        const ok = !document.getElementById('success-modal').classList.contains('hidden');
        if (ok) window.closeReview();
    });
};

window.uiTrack = function (btn) {
    withLoading(btn, async () => {
        const box = document.getElementById('track-result-box');
        // نخفي كل الحالات أولاً حتى لا تبقى نتيجة قديمة معروضة بعد بحث فاشل
        document.getElementById('track-empty').classList.add('hidden');
        document.getElementById('track-notfound').classList.add('hidden');
        box.classList.add('hidden');

        await window.trackReservation();

        // reservation.js يُظهر الصندوق عند النجاح فقط
        if (box.classList.contains('hidden')) {
            document.getElementById('track-notfound').classList.remove('hidden');
        }
    });
};

/* ---------- الظهور التدريجي ---------- */
const revealables = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    revealables.forEach(el => io.observe(el));
} else {
    revealables.forEach(el => el.classList.add('in'));
}

/* ---------- القواعد عند أول زيارة ---------- */
document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('maldiva_rules_seen')) {
        setTimeout(() => {
            window.openRulesModal();
            localStorage.setItem('maldiva_rules_seen', 'true');
        }, 1800);
    }
    refreshSumbar();
});

// Échap يغلق اللوحات
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('review-sheet').hidden) window.closeReview();
    else window.closeRulesModal();
});
