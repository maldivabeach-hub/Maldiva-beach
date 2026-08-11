// /js/scan.js
// ═══════════════════════════════════════════════════════════════
// Interface de contrôle d'accès (personnel d'accueil)
//
// ⚠️ Aucune logique de prix ni de réservation ici.
//    Validation + écriture → js/reservationService.js
//    Les droits réels sont imposés par firestore.rules : un compte
//    "staff" ne peut modifier QUE le champ checkIns, rien d'autre.
// ═══════════════════════════════════════════════════════════════

import { db, appId, auth, signInAdmin, signOutAdmin } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { validateTicket, recordCheckIn, todayKey } from './reservationService.js';
import { showNotification } from './ui.js';

let staffLabel = '';
let scanCount = 0;
let scanner = null;
let cameraOn = false;
let busy = false;   // empêche deux validations simultanées (double lecture du QR)

const $ = (id) => document.getElementById(id);

// ── état de chargement d'un bouton ──
const withLoading = async (btn, fn) => {
    if (!btn || btn.disabled) return;
    btn.disabled = true; btn.classList.add('is-loading');
    try { await fn(); } finally { btn.disabled = false; btn.classList.remove('is-loading'); }
};

// ══════════════════════════════════════════════
// 1. Connexion — accepte staff OU admin
// ══════════════════════════════════════════════
// Cherche l'utilisateur dans staff puis dans admins.
// On distingue deux échecs très différents, sinon impossible à diagnostiquer :
//   • permission-denied → les règles Firestore ne sont pas publiées
//   • document absent   → l'UID n'a pas été ajouté dans la collection staff
const isAuthorised = async (uid) => {
    const base = ['artifacts', appId, 'public', 'data'];
    let denied = false;

    for (const col of ['staff', 'admins']) {
        try {
            const snap = await getDoc(doc(db, ...base, col, uid));
            if (snap.exists()) return { role: col };
        } catch (e) {
            console.error(`Lecture ${col} refusée:`, e && e.code, e);
            if (e && e.code === 'permission-denied') denied = true;
        }
    }
    return { role: null, denied };
};

window.staffLogin = (btn) => withLoading(btn, async () => {
    const email = $('staff-email').value.trim();
    const pass = $('staff-password').value;
    const err = $('login-error');
    err.classList.add('hidden');

    if (!email || !pass) {
        err.textContent = "Entrez votre email et votre mot de passe.";
        return err.classList.remove('hidden');
    }

    try {
        const cred = await signInAdmin(email, pass);
        const uid = cred.user.uid;
        const { role, denied } = await isAuthorised(uid);

        if (!role) {
            await signOutAdmin();
            if (denied) {
                // Firestore a refusé la lecture : les règles ne sont pas à jour
                err.innerHTML = `Règles Firestore non publiées.<br>
                    <span class="font-normal opacity-80">Publiez firestore.rules dans la console Firebase.</span>`;
            } else {
                // L'authentification a réussi, mais l'UID n'est pas enregistré.
                // On affiche l'UID : c'est exactement ce qu'il faut copier dans Firestore.
                err.innerHTML = `Compte non enregistré comme personnel.<br>
                    <span class="font-normal opacity-80">Ajoutez cet UID dans la collection <strong>staff</strong> :</span>
                    <span class="block mt-1.5 select-all bg-white/10 px-2 py-1.5 rounded text-white font-mono text-[11px] break-all">${uid}</span>`;
            }
            return err.classList.remove('hidden');
        }

        staffLabel = email;
        $('staff-label').textContent = `${email} · ${role === 'admins' ? 'admin' : 'staff'}`;
        $('login-view').classList.add('hidden');
        $('scan-view').classList.remove('hidden');
        $('scan-view').classList.add('flex');
        showNotification("Connecté. Prêt à scanner.", "success");
    } catch (e) {
        console.error("Échec connexion staff:", e && e.code, e);
        const msgs = {
            'auth/invalid-credential': "Email ou mot de passe incorrect.",
            'auth/wrong-password':     "Mot de passe incorrect.",
            'auth/user-not-found':     "Aucun compte avec cet email. Créez-le dans Firebase → Authentication.",
            'auth/invalid-email':      "Format d'email invalide.",
            'auth/too-many-requests':  "Trop de tentatives. Patientez quelques minutes.",
            'auth/network-request-failed': "Pas de connexion internet."
        };
        err.textContent = msgs[e && e.code] || `Erreur de connexion (${(e && e.code) || 'inconnue'}).`;
        err.classList.remove('hidden');
    }
});

window.staffLogout = async () => {
    await stopCamera();
    await signOutAdmin();
    staffLabel = '';
    $('staff-password').value = '';
    $('scan-view').classList.add('hidden');
    $('scan-view').classList.remove('flex');
    $('login-view').classList.remove('hidden');
};

// ══════════════════════════════════════════════
// 2. Caméra
// ══════════════════════════════════════════════
const stopCamera = async () => {
    if (scanner && cameraOn) {
        try { await scanner.stop(); } catch (e) { /* déjà arrêtée */ }
    }
    cameraOn = false;
    const b = $('cam-btn');
    if (b) b.querySelector('.btn-text').textContent = 'Démarrer la caméra';
};

window.toggleCamera = (btn) => withLoading(btn, async () => {
    if (typeof window.Html5Qrcode === 'undefined') {
        return showNotification("Lecteur QR indisponible. Utilisez la saisie manuelle.", "error");
    }

    if (cameraOn) return stopCamera();

    try {
        if (!scanner) scanner = new window.Html5Qrcode("reader");
        await scanner.start(
            { facingMode: "environment" },              // caméra arrière
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (text) => handleCode(text),
            () => { /* image sans QR : silencieux, sinon le journal explose */ }
        );
        cameraOn = true;
        btn.querySelector('.btn-text').textContent = 'Arrêter la caméra';
    } catch (e) {
        console.error(e);
        showNotification("Caméra inaccessible. Autorisez-la ou saisissez le code.", "error");
    }
});

window.checkManual = (btn) => withLoading(btn, async () => {
    const code = $('manual-code').value.trim();
    if (!code) return showNotification("Entrez un code.", "error");
    await handleCode(code);
    $('manual-code').value = '';
});

// ══════════════════════════════════════════════
// 3. Les 7 contrôles + verdict
// ══════════════════════════════════════════════
const REASONS = {
    not_found:    { fr: "Aucune réservation ne correspond à ce code.",        ar: "لا يوجد حجز بهذا الرمز." },
    not_approved: { fr: "Réservation non confirmée (en attente de validation).", ar: "الحجز غير مؤكَّد بعد (قيد المراجعة)." },
    declined:     { fr: "Cette réservation a été refusée.",                   ar: "هذا الحجز مرفوض." },
    wrong_date:   { fr: "Ce billet n'est pas valable aujourd'hui.",           ar: "هذه التذكرة غير صالحة اليوم." },
    already_used: { fr: "Ce billet a déjà été scanné aujourd'hui.",           ar: "تم مسح هذه التذكرة اليوم من قبل." }
};

const handleCode = async (raw) => {
    if (busy) return;               // la caméra lit plusieurs fois par seconde
    busy = true;
    await stopCamera();             // on fige pendant que l'agent lit le verdict

    try {
        const res = await validateTicket(raw);

        if (res.ok) {
            // ✅ enregistrement : heure + agent, uniquement dans checkIns
            await recordCheckIn(res.code, staffLabel);
            scanCount++;
            $('scan-counter').textContent = scanCount;
            showVerdict('granted', res);
        } else {
            showVerdict(res.reason === 'already_used' ? 'used' : 'refused', res);
        }
    } catch (e) {
        console.error(e);
        showVerdict('refused', { reason: 'error', code: raw });
        showNotification("Erreur de connexion. Réessayez.", "error");
    } finally {
        busy = false;
    }
};

const money = (s) => s || '—';

const detailsHTML = (res) => {
    const d = res.data;
    if (!d) return `<p class="t-body text-gray-500 text-center py-6">Code lu : <strong>${res.code || '—'}</strong></p>`;

    const items = Object.entries(d.items || {})
        .map(([n, q]) => `<div class="flex justify-between t-body"><span class="text-gray-600">${n}</span><span class="font-bold tabular-nums">× ${q}</span></div>`)
        .join('') || '<p class="t-small text-gray-400">—</p>';

    const paid = d.payment && d.payment.paid;
    const days = parseInt(d.duration) || 1;

    return `
        <div class="flex items-baseline justify-between border-b border-maldiva-line pb-3">
            <div class="min-w-0">
                <div class="t-card font-bold truncate">${d.clientName || '—'}</div>
                <a href="tel:${d.clientPhone}" class="t-body text-maldiva-teal">${d.clientPhone || '—'}</a>
            </div>
            <div class="t-label text-gray-400 flex-shrink-0">#${res.code}</div>
        </div>

        <!-- Le paiement est OPTIONNEL : il donne droit aux rangées de devant.
             Il ne bloque jamais l'entrée — il informe l'agent du placement. -->
        <div class="rounded-xl p-3.5 border ${paid ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}">
            <div class="flex items-center gap-2">
                <i class="fa-solid ${paid ? 'fa-star text-amber-500' : 'fa-circle-info text-gray-400'}"></i>
                <span class="t-body font-bold ${paid ? 'text-amber-900' : 'text-gray-600'}">
                    ${paid ? 'PAYÉ — rangées de devant' : 'Non payé — placement libre'}
                </span>
            </div>
            <p class="t-small mt-1 font-arabic ${paid ? 'text-amber-800' : 'text-gray-500'}" dir="rtl">
                ${paid ? 'مدفوع — له الحق في الصفوف الأمامية' : 'غير مدفوع — المكان حسب المتاح'}
            </p>
        </div>

        <div class="space-y-1.5">${items}</div>

        <dl class="space-y-1.5 t-body border-t border-maldiva-line pt-3">
            <div class="flex justify-between"><dt class="text-gray-500">Date de début</dt><dd class="font-bold">${d.visitDate || '—'}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-500">Durée</dt><dd class="font-bold">${days} jour${days > 1 ? 's' : ''}</dd></div>
            <div class="flex justify-between"><dt class="text-gray-500">Total</dt><dd class="font-bold text-maldiva-dark">${money(d.totalPrice)}</dd></div>
            ${d.childrenChaiseCount > 0 ? `<div class="flex justify-between"><dt class="text-gray-500">Enfants (-40%)</dt><dd class="font-bold text-purple-700">${d.childrenChaiseCount}</dd></div>` : ''}
        </dl>

        ${res.already ? `
        <div class="bg-red-50 border border-red-200 rounded-xl p-3.5">
            <p class="t-body font-bold text-red-800">Déjà scanné aujourd'hui</p>
            <p class="t-small text-red-700 mt-1">
                à ${new Date(res.already.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                par ${res.already.by || 'inconnu'}
            </p>
        </div>` : ''}

        ${res.reason === 'wrong_date' ? `
        <div class="bg-red-50 border border-red-200 rounded-xl p-3.5 t-small text-red-800">
            Valable du <strong>${d.visitDate}</strong> pendant <strong>${days} jour${days > 1 ? 's' : ''}</strong>.
            Nous sommes le <strong>${todayKey()}</strong>.
        </div>` : ''}
    `;
};

const showVerdict = (kind, res) => {
    const styles = {
        granted: { bg: 'bg-emerald-600', icon: 'fa-circle-check', title: 'ACCÈS AUTORISÉ' },
        used:    { bg: 'bg-red-600',     icon: 'fa-rotate-left',  title: 'BILLET DÉJÀ UTILISÉ' },
        refused: { bg: 'bg-red-600',     icon: 'fa-circle-xmark', title: 'ACCÈS REFUSÉ' }
    }[kind];

    const head = $('verdict-head');
    head.className = `px-6 pt-12 pb-8 text-center ${styles.bg} text-white`;
    $('verdict-icon').innerHTML = `<i class="fa-solid ${styles.icon}"></i>`;
    $('verdict-title').textContent = styles.title;

    const r = REASONS[res.reason];
    $('verdict-reason').textContent = kind === 'granted'
        ? `Entrée enregistrée · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        : (r ? r.fr : "Billet invalide.");
    $('verdict-reason-ar').textContent = kind === 'granted'
        ? 'تم تسجيل الدخول بنجاح.'
        : (r ? r.ar : "التذكرة غير صالحة.");

    $('verdict-body').innerHTML = detailsHTML(res);

    const v = $('verdict');
    v.classList.remove('hidden');
    v.classList.add('flex');

    // vibration courte : l'agent sent le résultat sans quitter la file des yeux
    if (navigator.vibrate) navigator.vibrate(kind === 'granted' ? 60 : [60, 70, 60]);
};

window.closeVerdict = () => {
    const v = $('verdict');
    v.classList.add('hidden');
    v.classList.remove('flex');
};

// La session doit rester ouverte pendant tout le service : pas de déconnexion auto.
window.addEventListener('beforeunload', () => { if (cameraOn && scanner) scanner.stop().catch(() => {}); });
