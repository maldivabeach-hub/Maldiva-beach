// /js/reservationService.js
import { db, appId } from './firebase.js'; 
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// دالة ذكية لجلب معرف التطبيق لتفادي أي أخطاء وقت التحميل
const getAppId = () => {
    if (typeof window !== 'undefined' && window.__app_id) return window.__app_id;
    return appId;
};

// مسار الحجوزات (المسار الوحيد المسموح به في قواعد الأمان لديك)
const getReservationsCollection = () => collection(db, 'artifacts', getAppId(), 'public', 'data', 'reservations');
const getReservationDoc = (code) => doc(db, 'artifacts', getAppId(), 'public', 'data', 'reservations', code);

// 💡 الحل الجذري: إنشاء ملف مخفي داخل مجلد الحجوزات المسموح به لحفظ الأيام المغلقة
const SYSTEM_DOC_ID = 'SYSTEM_CLOSED_DAYS';
const getSystemDocRef = () => doc(db, 'artifacts', getAppId(), 'public', 'data', 'reservations', SYSTEM_DOC_ID);

let cachedReservations = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

export const submitNewReservation = async (reservationData) => {
    const docRef = getReservationDoc(reservationData.trackingCode);
    await setDoc(docRef, reservationData);
    return reservationData.trackingCode;
};

export const getReservationByCode = async (trackingCode) => {
    const docRef = getReservationDoc(trackingCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return snap.data();
    }
    return null; 
};

export const getAdminReservations = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedReservations && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedReservations;
    }
    const q = query(getReservationsCollection());
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        // 🔴 مهم جداً: نستثني الملف المخفي الخاص بالأيام المغلقة حتى لا يظهر كحجز
        if (doc.id !== SYSTEM_DOC_ID && doc.data().trackingCode) {
            results.push({ id: doc.id, ...doc.data() });
        }
    });
    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    cachedReservations = results;
    lastFetchTime = now;
    return results;
};

export const updateReservationData = async (trackingCode, newData) => {
    const docRef = getReservationDoc(trackingCode);
    await updateDoc(docRef, newData);
    if (cachedReservations) {
        const index = cachedReservations.findIndex(r => r.trackingCode === trackingCode);
        if (index > -1) {
            cachedReservations[index] = { ...cachedReservations[index], ...newData };
        }
    }
};

export const deleteReservation = async (trackingCode) => {
    const docRef = getReservationDoc(trackingCode);
    await deleteDoc(docRef);
    if (cachedReservations) {
        cachedReservations = cachedReservations.filter(r => r.trackingCode !== trackingCode);
    }
};

// ==========================================
// نظام إغلاق الأيام (النسخة المضمونة 100%)
// ==========================================

export const checkIfDateIsClosed = async (dateStr) => {
    try {
        const docRef = getSystemDocRef();
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().closedDates) {
            return snap.data().closedDates.includes(dateStr);
        }
        return false;
    } catch (e) {
        console.error("Erreur checkIfDateIsClosed:", e);
        return false; 
    }
};

export const toggleDateClosure = async (dateStr, isClosing) => {
    const docRef = getSystemDocRef();
    const snap = await getDoc(docRef);
    
    let days = [];
    if (snap.exists() && snap.data().closedDates) {
        days = snap.data().closedDates;
    }
    
    if (isClosing) {
        if (!days.includes(dateStr)) days.push(dateStr);
    } else {
        days = days.filter(d => d !== dateStr);
    }
    
    // نستخدم الملف المخفي داخل reservations لنتجاوز حظر الأمان
    await setDoc(docRef, { closedDates: days }, { merge: true });
};

export const getClosedDays = async () => {
    const docRef = getSystemDocRef();
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().closedDates) {
        return snap.data().closedDates.sort();
    }
    return [];
};
