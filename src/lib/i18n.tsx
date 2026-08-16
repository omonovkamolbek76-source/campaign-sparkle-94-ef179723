import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "uz" | "ru" | "en";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "uz", label: "O‘zbekcha" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

type Dict = Record<string, [string, string, string]>; // [uz, ru, en]

// Keys map to [uz, ru, en].
const DICT: Dict = {
  "bos.name": ["BusinessOS AI", "BusinessOS AI", "BusinessOS AI"],
  "bos.tagline": [
    "Tizimni o‘rganmang — tizim sizni tushunadi.",
    "Не изучайте систему — система понимает вас.",
    "Don’t learn the system — the system understands you.",
  ],
  "nav.command": ["AI Buyruq markazi", "AI Командный центр", "AI Command Center"],
  "nav.market": ["Bozor razvedkasi", "Аналитика рынка", "Market intelligence"],
  "nav.finance": ["Moliya agenti", "Финансовый агент", "Finance agent"],
  "nav.sources": ["Kuzatuv manbalari", "Источники мониторинга", "Monitoring sources"],
  "nav.actions": ["Tasdiqlash markazi", "Центр подтверждений", "Approval center"],
  "nav.profile": ["Biznes profili", "Профиль бизнеса", "Business profile"],

  "cc.placeholder": [
    "Menga nima kerak? Masalan: «Guruch narxi tushdimi? Eng arzon yetkazib beruvchini top»",
    "Что вам нужно? Например: «Упала ли цена на рис? Найди самого дешёвого поставщика»",
    "What do you need? e.g. “Did rice prices drop? Find the cheapest supplier.”",
  ],
  "cc.send": ["Yuborish", "Отправить", "Send"],
  "cc.thinking": ["AI o‘ylayapti…", "AI думает…", "AI is thinking…"],
  "cc.why": ["Nega?", "Почему?", "Why?"],
  "cc.confidence": ["Ishonch", "Уверенность", "Confidence"],
  "cc.sources": ["Manbalar", "Источники", "Sources"],
  "cc.newChat": ["Yangi suhbat", "Новый чат", "New chat"],
  "cc.voice": ["Ovoz bilan ayting", "Скажите голосом", "Speak instead"],
  "cc.examples": ["Namunalar", "Примеры", "Try these"],
  "cc.empty": [
    "Bitta savol yozing — AI ma’lumot yig‘adi, hisoblaydi va tayyor javob beradi.",
    "Задайте один вопрос — AI соберёт данные, посчитает и даст готовый ответ.",
    "Ask one question — the AI gathers data, calculates, and returns a ready answer.",
  ],

  "market.title": ["Bozor razvedkasi", "Аналитика рынка", "Market intelligence"],
  "market.subtitle": [
    "Kunlik bozor sotuvchilari, TV va radio kanallaridan yig‘ilgan narxlar.",
    "Цены, собранные у ежедневных продавцов рынка, с ТВ и радио.",
    "Prices collected from daily market vendors, TV and radio channels.",
  ],
  "market.product": ["Mahsulot", "Товар", "Product"],
  "market.avg": ["O‘rtacha narx", "Средняя цена", "Average price"],
  "market.min": ["Eng past", "Минимум", "Lowest"],
  "market.max": ["Eng yuqori", "Максимум", "Highest"],
  "market.trend": ["O‘zgarish", "Изменение", "Change"],
  "market.observations": ["Kuzatuvlar", "Наблюдения", "Observations"],
  "market.suppliers": ["Yetkazib beruvchilar", "Поставщики", "Suppliers"],
  "market.totalCost": ["Umumiy xarajat", "Итоговая стоимость", "Total cost"],
  "market.best": ["Eng maqbul taklif", "Лучшее предложение", "Best offer"],
  "market.ingest": ["Bozor yangiligini qo‘shish", "Добавить сводку рынка", "Add market update"],
  "market.ingestHint": [
    "Sotuvchi aytganini, TV/radio efiri matnini yoki narxlar ro‘yxatini joylashtiring — AI narxlarni ajratib oladi.",
    "Вставьте слова продавца, текст ТВ/радио эфира или список цен — AI извлечёт цены.",
    "Paste a vendor’s words, a TV/radio transcript, or a price list — the AI extracts prices.",
  ],
  "market.noData": [
    "Hali ma’lumot yo‘q. Manba qo‘shing yoki bozor yangiligini joylashtiring.",
    "Данных пока нет. Добавьте источник или вставьте сводку рынка.",
    "No data yet. Add a source or paste a market update.",
  ],

  "sources.title": ["Kuzatuv manbalari", "Источники мониторинга", "Monitoring sources"],
  "sources.subtitle": [
    "Kunlik bozor sotuvchilari, TV va radio kanallari — har kuni avtomatik tekshiriladi.",
    "Ежедневные продавцы рынка, ТВ и радио — проверяются автоматически каждый день.",
    "Daily market vendors, TV and radio channels — checked automatically every day.",
  ],
  "sources.add": ["Manba qo‘shish", "Добавить источник", "Add source"],
  "sources.kind": ["Turi", "Тип", "Type"],
  "sources.vendor": ["Bozor sotuvchisi", "Продавец рынка", "Market vendor"],
  "sources.tv": ["TV kanal", "ТВ канал", "TV channel"],
  "sources.radio": ["Radio", "Радио", "Radio"],
  "sources.web": ["Veb-manba", "Веб-источник", "Web source"],
  "sources.lastCheck": ["Oxirgi tekshiruv", "Последняя проверка", "Last check"],
  "sources.never": ["Hech qachon", "Никогда", "Never"],
  "sources.syncNow": ["Hozir tekshirish", "Проверить сейчас", "Check now"],

  "fin.title": ["Moliya agenti", "Финансовый агент", "Finance agent"],
  "fin.subtitle": [
    "Biznes-reja, kredit tayyorligi va soliq hisob-kitobi — bitta joyda.",
    "Бизнес-план, кредитная готовность и налоги — в одном месте.",
    "Business plan, credit readiness and tax math — in one place.",
  ],
  "fin.plan": ["Biznes-reja yaratish", "Создать бизнес-план", "Generate business plan"],
  "fin.credit": ["Kredit tayyorligi", "Кредитная готовность", "Credit readiness"],
  "fin.score": ["Ball", "Балл", "Score"],
  "fin.factors": ["Omillar", "Факторы", "Factors"],
  "fin.advice": ["Tavsiya", "Рекомендация", "Advice"],
  "fin.loanAmount": ["Kredit summasi", "Сумма кредита", "Loan amount"],
  "fin.rate": ["Yillik foiz", "Годовая ставка", "Annual rate"],
  "fin.months": ["Muddat (oy)", "Срок (мес.)", "Term (months)"],
  "fin.monthly": ["Oylik to‘lov", "Ежемесячный платёж", "Monthly payment"],
  "fin.overpay": ["Ortiqcha to‘lov", "Переплата", "Total interest"],
  "fin.calc": ["Hisoblash", "Рассчитать", "Calculate"],
  "fin.plans": ["Saqlangan rejalar", "Сохранённые планы", "Saved plans"],

  "profile.title": ["Biznes profili", "Профиль бизнеса", "Business profile"],
  "profile.subtitle": [
    "Bir marta kiriting — hamma joyda ishlatiladi.",
    "Введите один раз — используется везде.",
    "Enter once — used everywhere.",
  ],
  "profile.legalName": ["Yuridik nomi", "Юридическое название", "Legal name"],
  "profile.brandName": ["Brend nomi", "Бренд", "Brand name"],
  "profile.inn": ["STIR / INN", "ИНН", "Tax ID"],
  "profile.sector": ["Soha", "Отрасль", "Sector"],
  "profile.region": ["Hudud", "Регион", "Region"],
  "profile.employees": ["Xodimlar soni", "Сотрудников", "Employees"],
  "profile.revenue": ["Oylik tushum", "Месячная выручка", "Monthly revenue"],
  "profile.costs": ["Oylik xarajat", "Месячные расходы", "Monthly costs"],
  "profile.taxRegime": ["Soliq rejimi", "Налоговый режим", "Tax regime"],
  "profile.products": ["Asosiy mahsulotlar", "Основные товары", "Main products"],
  "profile.goals": ["Maqsadlar", "Цели", "Goals"],

  "actions.title": ["Tasdiqlash markazi", "Центр подтверждений", "Approval center"],
  "actions.subtitle": [
    "AI taklif qiladi — qaror sizniki.",
    "AI предлагает — решение за вами.",
    "The AI proposes — you decide.",
  ],
  "actions.approve": ["Tasdiqlash", "Подтвердить", "Approve"],
  "actions.reject": ["Rad etish", "Отклонить", "Reject"],
  "actions.pending": ["Kutilmoqda", "Ожидает", "Pending"],
  "actions.approved": ["Tasdiqlangan", "Подтверждено", "Approved"],
  "actions.rejected": ["Rad etilgan", "Отклонено", "Rejected"],
  "actions.none": ["Hozircha taklif yo‘q.", "Пока нет предложений.", "No proposals yet."],

  "common.save": ["Saqlash", "Сохранить", "Save"],
  "common.saving": ["Saqlanmoqda…", "Сохранение…", "Saving…"],
  "common.saved": ["Saqlandi", "Сохранено", "Saved"],
  "common.cancel": ["Bekor qilish", "Отмена", "Cancel"],
  "common.add": ["Qo‘shish", "Добавить", "Add"],
  "common.delete": ["O‘chirish", "Удалить", "Delete"],
  "common.loading": ["Yuklanmoqda…", "Загрузка…", "Loading…"],
  "common.language": ["Til", "Язык", "Language"],
  "common.generate": ["Yaratish", "Сгенерировать", "Generate"],
  "common.generating": ["Yaratilmoqda…", "Генерация…", "Generating…"],
  "common.open": ["Ochish", "Открыть", "Open"],
};

const IDX: Record<Lang, 0 | 1 | 2> = { uz: 0, ru: 1, en: 2 };
const STORAGE_KEY = "businessos.lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };

const I18nContext = createContext<Ctx>({ lang: "uz", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "uz" || stored === "ru" || stored === "en") setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => {
      const row = DICT[key];
      return row ? row[IDX[lang]] : key;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export const LANG_NAME: Record<Lang, string> = {
  uz: "Uzbek",
  ru: "Russian",
  en: "English",
};
