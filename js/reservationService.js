// /js/reservationService.js
import { db, appId } from './firebase.js'; 
import { doc, setDoc, getDoc, collection, query, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const COLLECTION_PATH = `artifacts/${appId}/public/data/reservations`;
const SETTINGS_PATH = `artifacts/${appId}/public/data/settings`; // مسار الإعدادات

let cachedReservations = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

export const submitNewReservation = async (reservationData) => {
    const docRef = doc(db, COLLECTION_PATH, reservationData.trackingCode);
    await setDoc(docRef, reservationData);
    return reservationData.trackingCode;
};

export const getReservationByCode = async (trackingCode) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
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
    const q = query(collection(db, COLLECTION_PATH));
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    cachedReservations = results;
    lastFetchTime = now;
    return results;
};

export const updateReservationData = async (trackingCode, newData) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
    await updateDoc(docRef, newData);
    if (cachedReservations) {
        const index = cachedReservations.findIndex(r => r.trackingCode === trackingCode);
        if (index > -1) {
            cachedReservations[index] = { ...cachedReservations[index], ...newData };
        }
    }
};

export const deleteReservation = async (trackingCode) => {
    const docRef = doc(db, COLLECTION_PATH, trackingCode);
    await deleteDoc(docRef);
    if (cachedReservations) {
        cachedReservations = cachedReservations.filter(r => r.trackingCode !== trackingCode);
    }
};

// ==========================================
// 🔴 دوال الأيام المغلقة (مع حماية من الأخطاء)
// ==========================================
export const getClosedDays = async () => {
    try {
        const docRef = doc(db, SETTINGS_PATH, 'closedDays');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data();
        }
        return {}; 
    } catch (e) {
        console.error("خطأ في جلب الأيام المغلقة:", e);
        return {};
    }
};

export const updateClosedDays = async (newClosedDays) => {
    const docRef = doc(db, SETTINGS_PATH, 'closedDays');
    await setDoc(docRef, newClosedDays);
};
