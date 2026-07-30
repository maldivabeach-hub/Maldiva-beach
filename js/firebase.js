// /js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
    apiKey: "AIzaSyDMHbPerIT_IPNobLCwBObWheTQerK-W_4",
    authDomain: "maldiva-beach-4fe61.firebaseapp.com",
    projectId: "maldiva-beach-4fe61",
    storageBucket: "maldiva-beach-4fe61.firebasestorage.app",
    messagingSenderId: "528746467653",
    appId: "1:528746467653:web:9d456c59a8221130936e2c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'maldiva-beach-club-prod';

// دالة لتسجيل الدخول المجهول للزبائن (index.html فقط — لا تُستخدم للأدمن)
export const initPublicAuth = async () => {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Auth failed", error);
    }
};

// 🔐 تسجيل دخول حقيقي للأدمن (إيميل + كلمة سر عبر Firebase Authentication)
// يجب إنشاء هذا الحساب مسبقاً من Firebase Console → Authentication → Users
export const signInAdmin = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
};

export const signOutAdmin = () => {
    return signOut(auth);
};

// مراقبة حالة المستخدم
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.currentUser = user;
        document.dispatchEvent(new CustomEvent('database-ready'));
    }
});
