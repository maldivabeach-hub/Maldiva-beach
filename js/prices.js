// /js/prices.js
// 💰 ملف الأسعار المركزي — عدّل الأسعار من هنا فقط، بدون الحاجة لتعديل باقي الملفات

// أسعار المعدات (بالفرد)
export const equipPrices = {
    'qty-chaise': 2000,
    'qty-transat': 3000,
    'qty-baldaquin': 10000
};

// أسعار الأنشطة (جيت سكي، بيدالو، كاياك، بويّة مسحوبة، قارب)
export const actPrices = {
    'qty-jetski-15': 6000,
    'qty-jetski-30': 12000,
    'qty-jetski-60': 20000,
    'qty-pedalo-30': 1000,
    'qty-pedalo-60': 2000,
    'qty-kayak-30': 1000,
    'qty-kayak-60': 2000,
    'qty-bouee-2': 3000,
    'qty-bouee-3': 4000,
    'qty-bateau-standard': 4000
};

// دمج كل الأسعار في كائن واحد (تستخدمه reservation.js وأي ملف آخر عند الحاجة)
export const allPrices = { ...equipPrices, ...actPrices };

// أسماء العرض (id ⇄ الاسم الظاهر للزبون/الأدمن) — يستخدمها reservation.js و admin.js
export const names = {
    'qty-chaise': 'Chaise Longue',
    'qty-transat': 'Transat en Bois',
    'qty-baldaquin': 'Baldaquin Royal',
    'qty-jetski-15': 'Jet-Ski (15 Min)',
    'qty-jetski-30': 'Jet-Ski (30 Min)',
    'qty-jetski-60': 'Jet-Ski (1 Heure)',
    'qty-pedalo-30': 'Pédalo (30 Min)',
    'qty-pedalo-60': 'Pédalo (1 Heure)',
    'qty-kayak-30': 'Kayak (30 Min)',
    'qty-kayak-60': 'Kayak (1 Heure)',
    'qty-bouee-2': 'Bouée Tractée (2 pers)',
    'qty-bouee-3': 'Bouée Tractée (3 pers)',
    'qty-bateau-standard': 'Bateau (+4 pers)'
};

// نفس الأسعار، لكن مفهرسة بالاسم الظاهر بدل الـ id (تحتاجها admin.js لأن الحجوزات المخزَّنة في Firestore تُسجَّل بالاسم)
export const pricesByName = {};
for (const id in allPrices) {
    pricesByName[names[id]] = allPrices[id];
}

// زيادة ثابتة لمظلة + طاولة — تُطبّق تلقائياً (انظر calculateEquipmentPricing) عندما يكون مجموع
// (Chaise Longue + Transat en Bois) = 1 أو 2، بأي تركيبة. هذا يُغطي أيضاً القيم القديمة
// 5000 DA (2 كراسي) و7000 DA (2 ترانزا) لأنها فعلياً = السعر الفردي × 2 + 1000
export const comboPricing = {
    parasolTable: 1000
};

// تخفيضات حسب مدة الإقامة (على معدات الشاطئ فقط)
export const durationDiscounts = {
    5: 0.10,  // -10% لمدة 5 أيام
    7: 0.15   // -15% لمدة أسبوع كامل
};

// تعرفة الأطفال والرضّع
// ✅ مُفعّلة تلقائيًا في calculateTotal() (index.html) و calculateEditTotal() (admin.html)
export const childPricing = {
    maxAgeYears: 13,               // يُعتبر "طفلاً" كل من عمره أقل من هذا الرقم
    babyFree: true,               // الرضّع: دخول مجاني
    childNoChairFree: true,       // أطفال بدون كرسي استلقاء: دخول مجاني
    childWithChairDiscount: 0.40  // أطفال على كرسي استلقاء: خصم ثابت = 40% من سعر الكرسي الواحد، يُطبّق حتى ضمن عرض 2 كراسي
};

// ==========================================================
// 🧮 دالة الحساب المشتركة — المصدر الوحيد لمنطق تسعير
// Chaise Longue / Transat en Bois / Baldaquin (كومبو، قطعة واحدة، أطفال)
// يستخدمها reservation.js (index.html) و admin.js (تعديل حجز) معاً
// أي تصحيح مستقبلي في هذا المنطق يكفي أن يصير هنا فقط
// ==========================================================
export function calculateEquipmentPricing({ qtyChaise = 0, qtyTransat = 0, qtyBaldaquin = 0, qtyChaiseEnfant = 0 }) {
    qtyChaiseEnfant = Math.min(qtyChaiseEnfant || 0, qtyChaise || 0);
    const childRebate = equipPrices['qty-chaise'] * childPricing.childWithChairDiscount;
    let subtotal = 0;
    const notes = [];

    // يُضيف ملاحظة خصم الأطفال (مع تذكير بسن الأهلية) ويرجّع القيمة المخصومة
    const applyChildRebate = (count) => {
        const rebateTotal = count * childRebate;
        notes.push(`${count} enfant(s) de moins de ${childPricing.maxAgeYears} ans sur Chaise Longue : -${rebateTotal.toLocaleString()} DA (-${childPricing.childWithChairDiscount * 100}% par enfant)`);
        return rebateTotal;
    };

    const totalLoungers = qtyChaise + qtyTransat;

    // مجموع كرسي + ترانزا = 1 أو 2 (بأي تركيبة: كرسي فقط، ترانزا فقط، أو كرسي+ترانزا معاً)
    // يحتاج مظلة وطاولة واحدة، بزيادة ثابتة 1000 DA — نفس الصيغة تُغطي كل هذه الحالات دفعة واحدة
    if (totalLoungers >= 1 && totalLoungers <= 2) {
        subtotal += (qtyChaise * equipPrices['qty-chaise']) + (qtyTransat * equipPrices['qty-transat']);

        if (qtyChaiseEnfant > 0) {
            subtotal -= applyChildRebate(qtyChaiseEnfant);
        }

        subtotal += comboPricing.parasolTable;
        notes.push(`+ ${comboPricing.parasolTable.toLocaleString()} DA pour Parasol + Table`);
    }
    else {
        subtotal += (qtyChaise * equipPrices['qty-chaise']);
        if (qtyChaiseEnfant > 0) {
            subtotal -= applyChildRebate(qtyChaiseEnfant);
        }
        subtotal += (qtyTransat * equipPrices['qty-transat']);
    }

    subtotal += (qtyBaldaquin * equipPrices['qty-baldaquin']);

    return { subtotal, notes };
}

// يطبّق تخفيض المدة (5 أيام / أسبوع) على مجموع المعدات
export function applyDurationDiscount(subtotal, duration) {
    let total = subtotal * (duration || 1);
    let discountApplied = false;
    if (durationDiscounts[duration]) {
        total *= (1 - durationDiscounts[duration]);
        discountApplied = true;
    }
    return { total, discountApplied };
}

// يتحقق إذا كان حجز مُسجَّل مسبقاً (قراءة قيم Chaise Longue / Transat en Bois من items) يستحق ملاحظة "زيادة مظلة وطاولة"
// يُستخدم في العرض فقط (لوحة الأدمن، ورقة الطباعة، صفحة التتبع، رسالة واتساب) — الحساب نفسه يصير في calculateEquipmentPricing
export function getParasolTableNote(items) {
    const qtyChaise = (items && items['Chaise Longue']) || 0;
    const qtyTransat = (items && items['Transat en Bois']) || 0;
    const total = qtyChaise + qtyTransat;
    if (total >= 1 && total <= 2) {
        return `+ ${comboPricing.parasolTable.toLocaleString()} DA pour Parasol + Table`;
    }
    return null;
}
