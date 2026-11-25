import {
  IoArrowBack,
  IoChevronDown,
  IoSparkles,
  IoDownloadOutline,
  IoAdd,
  IoTrashOutline,
  IoColorPaletteOutline,
  IoPrintOutline,
  IoArrowUpOutline,
  IoArrowDownOutline,
  IoRefreshOutline,
  IoClose,
} from "react-icons/io5";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import pptxgen from "pptxgenjs";
import "./slayd.css";

const DRAFT_KEY = "ziyo_slayd_draft";

const THEMES = [
  {
    id: "ziyo-purple",
    name: "Hatif Purple",
    bg: "#ffffff",
    cardBg: "#f8fafc",
    cardBorder: "#e2e8f0",
    titleColor: "#0f172a",
    accent: "#461fe2",
    textColor: "#334155",
    badgeBg: "rgba(70, 31, 226, 0.1)",
  },
  {
    id: "dark-pro",
    name: "Tungi Pro",
    bg: "#0f172a",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    titleColor: "#f8fafc",
    accent: "#38bdf8",
    textColor: "#cbd5e1",
    badgeBg: "rgba(56, 189, 248, 0.15)",
  },
  {
    id: "warm-cream",
    name: "Issiq Krem",
    bg: "#fdfbf7",
    cardBg: "#f5efe6",
    cardBorder: "#e7dec8",
    titleColor: "#292524",
    accent: "#d97706",
    textColor: "#44403c",
    badgeBg: "rgba(217, 119, 6, 0.12)",
  },
  {
    id: "emerald",
    name: "Zumrad",
    bg: "#f0fdf4",
    cardBg: "#ffffff",
    cardBorder: "#bbf7d0",
    titleColor: "#064e3b",
    accent: "#059669",
    textColor: "#1f2937",
    badgeBg: "rgba(5, 150, 105, 0.12)",
  },
];

// Tezkor mavzu takliflari (Loyihadagi create.jsx kabi)
const SUGGESTED_SLIDE_TOPICS = [
  "Sun'iy intellekt kelajagi",
  "Startap va investitsiya rejasi",
  "Kriptovalyuta va blokcheyn",
  "Zamonaviy ta'lim metodlari",
  "Raqamli marketing strategiyasi",
  "Koinot va zamonaviy fizika",
];

// Mavzuga mos saralangan tasvirlar zaxirasi
const CURATED_IMAGES = [
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=80",
];

function SlaydYaratish() {
  const navigate = useNavigate();
  const [slaydText, setSlaydText] = useState("");
  const [showSlideList, setShowSlideList] = useState(false);
  const [selectedCount, setSelectedCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");

  const [slides, setSlides] = useState(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [currentTheme, setCurrentTheme] = useState(THEMES[0]);

  // ── LocalStorage dan draft yuklash (bir marta)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.slides && draft.slides.length > 0) {
          setSlaydText(draft.slaydText || "");
          setSlides(draft.slides);
          setActiveSlideIndex(0);
          const savedTheme = THEMES.find((t) => t.id === draft.themeId);
          if (savedTheme) setCurrentTheme(savedTheme);
          toast.info("Oldingi ishingiz tiklandi! 💾", { autoClose: 3000 });
        }
      }
    } catch {}
  }, []);

  // ── slides yoki theme o'zgarganda avtomatik saqlash
  useEffect(() => {
    if (!slides) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ slides, slaydText, themeId: currentTheme.id }),
      );
    } catch {}
  }, [slides, slaydText, currentTheme]);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSlideList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const slideOptions = [
    { id: 1, num: 5 },
    { id: 2, num: 8 },
    { id: 3, num: 10 },
    { id: 4, num: 12 },
    { id: 5, num: 15, premium: true },
    { id: 6, num: 20, premium: true },
  ];

  const handleCreateSlayd = async () => {
    if (!slaydText.trim()) {
      toast.info("Iltimos, taqdimot mavzusini kiriting!");
      return;
    }
    setLoading(true);
    setLoadingStep("Mavzu chuqur tahlil qilinmoqda...");

    const apiKey = process.env.VITE_GEMINI_API_KEY;

    const prompt = `Sen dunyo darajasidagi professional Gamma.app taqdimot dizayneri va analitigisan.
Mavzu: "${slaydText}"
Jami slaydlar soni: ${selectedCount} ta.

QAT'IY QOIDA: Barcha sahifalar bir xil bo'lib qolishi mutlaqo MUMKIN EMAS! Har bir slayd quyidagi Gamma layoutlaridan biriga ega bo'lsin:
1. "cover" - Asosiy muqova (sarlavha, jozibali taglavha, 2 ta kirish fikri).
2. "cards" - 3 ta mustaqil tahliliy karta (har birida o'z sarlavhasi va batafsil tushuntirish matni).
3. "stats" - 3 ta muhim raqam/statistika (value: masalan "85%", "$2.4M", "3.5x"; label: ko'rsatkich nomi; desc: izoh).
4. "split" - Matn va yonidagi tasvir (chapda sarlavha, chuqur fikrlar bulletlari, o'ngda tasvir kalit so'zi).
5. "process" - 3 bosqichli jarayon (01, 02, 03 qadamlar, har birining nomi va tavsifi).
6. "comparison" - 2 tomonlama taqqoslash (masalan: "An'anaviy usul" vs "Zamonaviy innovatsion usul", har birida 2-3 ta band).
7. "conclusion" - Yakuniy xulosa (katta ilhomlantiruvchi iqtibos, asosiy xulosalar bulletlari).

Slaydlar ketma-ketligi:
- 1-slayd doimo "cover"
- 2-slayd "cards" yoki "stats"
- 3-slayd "split"
- 4-slayd "process" yoki "comparison"
- Keyingi slaydlar navbatma-navbat: "stats", "cards", "split", "comparison"
- Oxirgi slayd "conclusion"

Javobni FAQAT toza JSON massiv ko'rinishida qaytar (markdown va boshqa matnsiz):
[
  {
    "id": 1,
    "layout": "cover",
    "badge": "Kirish",
    "title": "Mavzu nomi",
    "subtitle": "Kengroq tushuntirish va taqdimot g'oyasi",
    "bullets": ["Asosiy maqsad va yo'nalish", "Kutilayotgan natijalar"],
    "imageKeyword": "technology futuristic innovation concept"
  },
  {
    "id": 2,
    "layout": "cards",
    "badge": "Asosiy Ustunlar",
    "title": "Soha Yo'nalishlari",
    "subtitle": "Uchta asosiy strategik yo'nalish tahlili",
    "cards": [
      { "title": "1-yo'nalish", "desc": "Batafsil tushuntirish..." },
      { "title": "2-yo'nalish", "desc": "Batafsil tushuntirish..." },
      { "title": "3-yo'nalish", "desc": "Batafsil tushuntirish..." }
    ]
  },
  {
    "id": 3,
    "layout": "stats",
    "badge": "Raqamlar va Dalillar",
    "title": "Asosiy Ko'rsatkichlar",
    "subtitle": "Sohadagi eng muhim tahliliy ma'lumotlar",
    "stats": [
      { "value": "85%", "label": "Samaradorlik", "desc": "Jarayonlarni optimallashtirish hisobiga" },
      { "value": "2.4x", "label": "O'sish sur'ati", "desc": "So'nggi 3 yillik dinamika bo'yicha" },
      { "value": "100+", "label": "Amaliy yechimlar", "desc": "Global bozorda joriy qilingan loyihalar" }
    ]
  },
  {
    "id": 4,
    "layout": "split",
    "badge": "Tafsilotlar",
    "title": "Chuqur Tahlil",
    "subtitle": "Amaliy tajriba va asosiy omillar",
    "bullets": [
      "Birinchi muhim tahliliy fikr va asos",
      "Ikkinchi amaliy jihat va uning ahamiyati",
      "Uchinchi istiqbolli imkoniyat"
    ],
    "imageKeyword": "business analytics strategy planning modern"
  },
  {
    "id": 5,
    "layout": "process",
    "badge": "Bosqichlar",
    "title": "Amalga Oshirish Rejasi",
    "subtitle": "Muvaffaqiyatga eltuvchi qadamlar",
    "steps": [
      { "step": "01", "title": "Tadqiqot", "desc": "Dastlabki tahlil va rejalashtirish" },
      { "step": "02", "title": "Ishlab chiqish", "desc": "Asosiy yechimni tayyorlash va testlash" },
      { "step": "03", "title": "Kengaytirish", "desc": "To'liq joriy etish va monitoring" }
    ]
  },
  {
    "id": 6,
    "layout": "comparison",
    "badge": "Taqqoslash",
    "title": "Yondashuvlar Qiyosi",
    "subtitle": "Klassik va zamonaviy usullar farqi",
    "columns": [
      { "title": "An'anaviy usul", "points": ["Vaqt talab etadi", "Cheklangan moslashuvchanlik", "Qo'lda boshqaruv"] },
      { "title": "Zamonaviy innovatsion usul", "points": ["Tezkor natija", "Yuqori samaradorlik", "To'liq avtomatlashtirish"] }
    ]
  },
  {
    "id": 7,
    "layout": "conclusion",
    "badge": "Xulosa",
    "title": "Kelajak Istiqbollari",
    "subtitle": "Asosiy xulosalar va navbatdagi qadamlar",
    "quote": "Innovatsiyalar va to'g'ri strategiya ertangi kun muvaffaqiyatining mustahkam poydevoridir.",
    "bullets": [
      "Doimiy rivojlanish va yangi bilimlarni o'zlashtirish",
      "Texnologik yechimlarni amaliyotga dadil tatbiq etish"
    ]
  }
]
Matnlar chuqur, mazmunli, o'zbek tilida bexato va jozibali bo'lsin. Qisqartirib tashlama.`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    };

    try {
      setLoadingStep("ZIYO slaydlari generatsiya qilinmoqda...");
      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      // Agar xato bo'lsa, zaxira model bilan qayta urinish
      if (!response.ok) {
        setLoadingStep("Qayta urinilmoqda...");
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
        );
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content) {
        let rawJsonText = data.candidates[0].content.parts[0].text.trim();

        // Markdown teglarni tozalash
        if (rawJsonText.startsWith("```json")) {
          rawJsonText = rawJsonText
            .replace(/^```json\s*/, "")
            .replace(/```\s*$/, "")
            .trim();
        } else if (rawJsonText.startsWith("```")) {
          rawJsonText = rawJsonText
            .replace(/^```\s*/, "")
            .replace(/```\s*$/, "")
            .trim();
        }

        const firstBracket = rawJsonText.indexOf("[");
        const lastBracket = rawJsonText.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket !== -1) {
          rawJsonText = rawJsonText.substring(firstBracket, lastBracket + 1);
        }

        const parsed = JSON.parse(rawJsonText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((s, idx) => ({
            id: s.id || Date.now() + idx,
            layout: s.layout || (idx === 0 ? "cover" : "split"),
            badge: s.badge || `Bo'lim ${idx + 1}`,
            title: s.title || `Slayd ${idx + 1}`,
            subtitle: s.subtitle || "",
            bullets: Array.isArray(s.bullets) ? s.bullets : [],
            cards: Array.isArray(s.cards) ? s.cards : [],
            stats: Array.isArray(s.stats) ? s.stats : [],
            steps: Array.isArray(s.steps) ? s.steps : [],
            columns: Array.isArray(s.columns) ? s.columns : [],
            quote: s.quote || "",
            imageKeyword: s.imageKeyword || "modern innovation technology",
            imageUrl: CURATED_IMAGES[idx % CURATED_IMAGES.length],
          }));

          setSlides(normalized);
          setActiveSlideIndex(0);
          toast.success("Taqdimot muvaffaqiyatli yaratildi! 🎉");
        } else {
          throw new Error("Bo'sh slaydlar ro'yxati");
        }
      } else {
        throw new Error(data.error?.message || "Gemini javob bermadi");
      }
    } catch (error) {
      console.error("Xatolik:", error);
      toast.error(
        "Slayd yaratishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
      );
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  // Slayd maydonini yangilash
  const updateSlideField = (index, field, value) => {
    const updated = [...slides];
    updated[index][field] = value;
    setSlides(updated);
  };

  // Bulletlarni tahrirlash
  const updateBullet = (slideIndex, bulletIndex, value) => {
    const updated = [...slides];
    updated[slideIndex].bullets[bulletIndex] = value;
    setSlides(updated);
  };

  const addBullet = (slideIndex) => {
    const updated = [...slides];
    if (!updated[slideIndex].bullets) updated[slideIndex].bullets = [];
    updated[slideIndex].bullets.push("Yangi tahliliy fikr yoki ko'rsatkich...");
    setSlides(updated);
  };

  const removeBullet = (slideIndex, bulletIndex) => {
    const updated = [...slides];
    updated[slideIndex].bullets.splice(bulletIndex, 1);
    setSlides(updated);
  };

  // Kartalarni tahrirlash (cards layout)
  const updateCardField = (slideIndex, cardIndex, field, value) => {
    const updated = [...slides];
    if (!updated[slideIndex].cards[cardIndex]) return;
    updated[slideIndex].cards[cardIndex][field] = value;
    setSlides(updated);
  };

  // Statlarni tahrirlash (stats layout)
  const updateStatField = (slideIndex, statIndex, field, value) => {
    const updated = [...slides];
    if (!updated[slideIndex].stats[statIndex]) return;
    updated[slideIndex].stats[statIndex][field] = value;
    setSlides(updated);
  };

  // Step tahrirlash (process layout)
  const updateStepField = (slideIndex, stepIndex, field, value) => {
    const updated = [...slides];
    if (!updated[slideIndex].steps[stepIndex]) return;
    updated[slideIndex].steps[stepIndex][field] = value;
    setSlides(updated);
  };

  // Column tahrirlash (comparison layout)
  const updateColumnTitle = (slideIndex, colIndex, value) => {
    const updated = [...slides];
    if (!updated[slideIndex].columns[colIndex]) return;
    updated[slideIndex].columns[colIndex].title = value;
    setSlides(updated);
  };

  const updateColumnPoint = (slideIndex, colIndex, pointIndex, value) => {
    const updated = [...slides];
    if (
      !updated[slideIndex].columns[colIndex] ||
      !updated[slideIndex].columns[colIndex].points
    )
      return;
    updated[slideIndex].columns[colIndex].points[pointIndex] = value;
    setSlides(updated);
  };

  // Layoutni o'zgartirish
  const changeSlideLayout = (slideIndex, newLayout) => {
    const updated = [...slides];
    const s = updated[slideIndex];
    s.layout = newLayout;

    if (newLayout === "cards" && (!s.cards || s.cards.length === 0)) {
      s.cards = [
        {
          title: "1-Yo'nalish",
          desc: "Ushbu yo'nalish bo'yicha muhim ma'lumot va tahlil.",
        },
        {
          title: "2-Yo'nalish",
          desc: "Ikkinchi ustuvor omil va uning ahamiyati.",
        },
        { title: "3-Yo'nalish", desc: "Uchinchi istiqbolli strategik jihat." },
      ];
    } else if (newLayout === "stats" && (!s.stats || s.stats.length === 0)) {
      s.stats = [
        {
          value: "85%",
          label: "Samaradorlik",
          desc: "Jarayonlarni optimallashtirish ko'rsatkichi",
        },
        {
          value: "2.4x",
          label: "O'sish sur'ati",
          desc: "Yillik rivojlanish ko'rsatkichi",
        },
        {
          value: "100+",
          label: "Yangi loyihalar",
          desc: "Joriy etilgan yechimlar soni",
        },
      ];
    } else if (newLayout === "process" && (!s.steps || s.steps.length === 0)) {
      s.steps = [
        {
          step: "01",
          title: "Tayyorgarlik",
          desc: "Dastlabki reja va tadqiqot",
        },
        {
          step: "02",
          title: "Amaliyot",
          desc: "Asosiy jarayonni joriy qilish",
        },
        {
          step: "03",
          title: "Natija",
          desc: "Monitoring va samaradorlikni baholash",
        },
      ];
    } else if (
      newLayout === "comparison" &&
      (!s.columns || s.columns.length === 0)
    ) {
      s.columns = [
        {
          title: "An'anaviy usul",
          points: ["Cheklangan tezlik", "Qo'lda kiritish talab etiladi"],
        },
        {
          title: "Innovatsion usul",
          points: ["To'liq avtomatlashtirilgan", "Yuqori aniqlik va tezlik"],
        },
      ];
    } else if (newLayout === "conclusion" && !s.quote) {
      s.quote =
        "To'g'ri rejalashtirish va yangi texnologiyalar kelajak muvaffaqiyatini belgilaydi.";
    }

    setSlides(updated);
  };

  // Yangi slayd qo'shish
  const addNewSlide = (preferredLayout) => {
    const availableLayouts = [
      "cards",
      "stats",
      "split",
      "process",
      "comparison",
    ];
    const layout =
      preferredLayout ||
      availableLayouts[Math.floor(Math.random() * availableLayouts.length)];

    const newSlide = {
      id: Date.now(),
      layout: layout,
      badge: "Yangi bo'lim",
      title: "Yangi slayd sarlavhasi",
      subtitle: "Qo'shimcha tahliliy izoh va maqsad",
      bullets: [
        "Birinchi muhim ko'rsatkich yoki fakt",
        "Ikkinchi chuqur tahliliy fikr",
      ],
      cards: [
        { title: "Omil 1", desc: "Asosiy parametrlar va uning natijalari." },
        { title: "Omil 2", desc: "Samaradorlikni oshirish usullari." },
        { title: "Omil 3", desc: "Kelajakdagi rivojlanish yo'nalishi." },
      ],
      stats: [
        {
          value: "90%",
          label: "Muvaffaqiyat",
          desc: "Rejalashtirilgan vazifalar bajarilishi",
        },
        {
          value: "3x",
          label: "Tezlashuv",
          desc: "Vaqt tejalishi va samaradorlik",
        },
        {
          value: "50+",
          label: "Hamkorlar",
          desc: "Global miqyosdagi ishonchli aloqalar",
        },
      ],
      steps: [
        { step: "01", title: "Reja", desc: "Vazifalarni belgilash" },
        { step: "02", title: "Ijro", desc: "Amaliyotga tatbiq qilish" },
        { step: "03", title: "Tahlil", desc: "Xulosalar chiqarish" },
      ],
      columns: [
        {
          title: "Klassik",
          points: ["Ko'proq resurs talab etiladi", "Sekin jarayon"],
        },
        { title: "Zamonaviy", points: ["Tejamkor va tezkor", "Yuqori natija"] },
      ],
      quote: "Har bir yangi qadam yangi imkoniyatlar eshigini ochadi.",
      imageKeyword: "modern professional business technology",
      imageUrl: CURATED_IMAGES[slides.length % CURATED_IMAGES.length],
    };

    const updated = [...slides, newSlide];
    setSlides(updated);
    setActiveSlideIndex(updated.length - 1);
    toast.info("Yangi slayd qo'shildi");
  };

  // Slaydni o'chirish
  const deleteSlide = (index) => {
    if (slides.length <= 1) {
      toast.warning("Oxirgi slaydni o'chirib bo'lmaydi!");
      return;
    }
    const updated = slides.filter((_, i) => i !== index);
    setSlides(updated);
    setActiveSlideIndex(Math.max(0, index - 1));
    toast.info("Slayd o'chirildi");
  };

  // Slaydni siljitish
  const moveSlide = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    const updated = [...slides];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSlides(updated);
    setActiveSlideIndex(targetIndex);
  };

  // Slayd rasmini yangilash
  const refreshSlideImage = (index) => {
    const updated = [...slides];
    const currentUrl = updated[index].imageUrl;
    let nextIndex =
      (CURATED_IMAGES.indexOf(currentUrl) + 1) % CURATED_IMAGES.length;
    if (nextIndex < 0) nextIndex = 0;
    updated[index].imageUrl = CURATED_IMAGES[nextIndex];
    setSlides(updated);
    toast.info("Tasvir yangilandi");
  };

  // PowerPoint (.pptx) ga eksport qilish
  const exportToPPTX = () => {
    try {
      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_16x9";
      pptx.author = "ziyo AI";
      pptx.title = slaydText || "Taqdimot";

      const bgColor = currentTheme.bg.replace("#", "");
      const titleColor = currentTheme.titleColor.replace("#", "");
      const accentColor = currentTheme.accent.replace("#", "");
      const textColor = currentTheme.textColor.replace("#", "");

      slides.forEach((s, idx) => {
        const slide = pptx.addSlide();
        slide.background = { color: bgColor };

        // Badge
        if (s.badge) {
          slide.addText(s.badge.toUpperCase(), {
            x: 0.8,
            y: 0.4,
            w: 8.5,
            h: 0.3,
            fontSize: 10,
            bold: true,
            color: accentColor,
          });
        }

        // Layout bo'yicha mos elementlar
        if (s.layout === "cover") {
          slide.addText(s.title, {
            x: 0.8,
            y: 1.8,
            w: 8.5,
            h: 1.2,
            fontSize: 34,
            bold: true,
            color: titleColor,
          });
          if (s.subtitle) {
            slide.addText(s.subtitle, {
              x: 0.8,
              y: 3.1,
              w: 8.5,
              h: 0.6,
              fontSize: 16,
              color: accentColor,
            });
          }
          if (s.bullets && s.bullets.length > 0) {
            const items = s.bullets.map((b) => ({
              text: b,
              options: { bullet: true, breakLine: true },
            }));
            slide.addText(items, {
              x: 0.8,
              y: 3.9,
              w: 8.5,
              h: 1.2,
              fontSize: 14,
              color: textColor,
            });
          }
        } else if (s.layout === "cards" && s.cards && s.cards.length > 0) {
          slide.addText(s.title, {
            x: 0.8,
            y: 0.7,
            w: 8.5,
            h: 0.6,
            fontSize: 22,
            bold: true,
            color: titleColor,
          });
          if (s.subtitle) {
            slide.addText(s.subtitle, {
              x: 0.8,
              y: 1.3,
              w: 8.5,
              h: 0.4,
              fontSize: 13,
              color: accentColor,
            });
          }
          const colWidth = 2.6;
          s.cards.slice(0, 3).forEach((card, cIdx) => {
            const posX = 0.8 + cIdx * (colWidth + 0.35);
            slide.addShape(pptx.ShapeType.roundRect, {
              x: posX,
              y: 2.0,
              w: colWidth,
              h: 3.0,
              fill: { color: currentTheme.cardBg.replace("#", "") },
              line: { color: accentColor, width: 1 },
              rectRadius: 0.1,
            });
            slide.addText(card.title, {
              x: posX + 0.15,
              y: 2.2,
              w: colWidth - 0.3,
              h: 0.5,
              fontSize: 14,
              bold: true,
              color: titleColor,
            });
            slide.addText(card.desc, {
              x: posX + 0.15,
              y: 2.7,
              w: colWidth - 0.3,
              h: 2.1,
              fontSize: 12,
              color: textColor,
            });
          });
        } else if (s.layout === "stats" && s.stats && s.stats.length > 0) {
          slide.addText(s.title, {
            x: 0.8,
            y: 0.7,
            w: 8.5,
            h: 0.6,
            fontSize: 22,
            bold: true,
            color: titleColor,
          });
          if (s.subtitle) {
            slide.addText(s.subtitle, {
              x: 0.8,
              y: 1.3,
              w: 8.5,
              h: 0.4,
              fontSize: 13,
              color: accentColor,
            });
          }
          const colWidth = 2.6;
          s.stats.slice(0, 3).forEach((st, sIdx) => {
            const posX = 0.8 + sIdx * (colWidth + 0.35);
            slide.addShape(pptx.ShapeType.roundRect, {
              x: posX,
              y: 2.0,
              w: colWidth,
              h: 3.0,
              fill: { color: currentTheme.cardBg.replace("#", "") },
              line: { color: accentColor, width: 2 },
              rectRadius: 0.1,
            });
            slide.addText(st.value, {
              x: posX + 0.15,
              y: 2.2,
              w: colWidth - 0.3,
              h: 0.7,
              fontSize: 28,
              bold: true,
              color: accentColor,
            });
            slide.addText(st.label, {
              x: posX + 0.15,
              y: 2.9,
              w: colWidth - 0.3,
              h: 0.4,
              fontSize: 13,
              bold: true,
              color: titleColor,
            });
            slide.addText(st.desc, {
              x: posX + 0.15,
              y: 3.3,
              w: colWidth - 0.3,
              h: 1.5,
              fontSize: 11,
              color: textColor,
            });
          });
        } else if (s.layout === "process" && s.steps && s.steps.length > 0) {
          slide.addText(s.title, {
            x: 0.8,
            y: 0.7,
            w: 8.5,
            h: 0.6,
            fontSize: 22,
            bold: true,
            color: titleColor,
          });
          const colWidth = 2.6;
          s.steps.slice(0, 3).forEach((st, pIdx) => {
            const posX = 0.8 + pIdx * (colWidth + 0.35);
            slide.addShape(pptx.ShapeType.roundRect, {
              x: posX,
              y: 2.0,
              w: colWidth,
              h: 3.0,
              fill: { color: currentTheme.cardBg.replace("#", "") },
              line: { color: accentColor, width: 1 },
              rectRadius: 0.1,
            });
            slide.addText(`Qadam ${st.step}`, {
              x: posX + 0.15,
              y: 2.2,
              w: colWidth - 0.3,
              h: 0.4,
              fontSize: 12,
              bold: true,
              color: accentColor,
            });
            slide.addText(st.title, {
              x: posX + 0.15,
              y: 2.6,
              w: colWidth - 0.3,
              h: 0.5,
              fontSize: 13,
              bold: true,
              color: titleColor,
            });
            slide.addText(st.desc, {
              x: posX + 0.15,
              y: 3.1,
              w: colWidth - 0.3,
              h: 1.7,
              fontSize: 11,
              color: textColor,
            });
          });
        } else if (
          s.layout === "comparison" &&
          s.columns &&
          s.columns.length > 0
        ) {
          slide.addText(s.title, {
            x: 0.8,
            y: 0.7,
            w: 8.5,
            h: 0.6,
            fontSize: 22,
            bold: true,
            color: titleColor,
          });
          const colWidth = 4.1;
          s.columns.slice(0, 2).forEach((col, cIdx) => {
            const posX = 0.8 + cIdx * (colWidth + 0.3);
            slide.addShape(pptx.ShapeType.roundRect, {
              x: posX,
              y: 1.8,
              w: colWidth,
              h: 3.2,
              fill: { color: currentTheme.cardBg.replace("#", "") },
              line: { color: accentColor, width: 1 },
              rectRadius: 0.1,
            });
            slide.addText(col.title, {
              x: posX + 0.2,
              y: 2.0,
              w: colWidth - 0.4,
              h: 0.5,
              fontSize: 14,
              bold: true,
              color: titleColor,
            });
            const pItems = (col.points || []).map((pt) => ({
              text: pt,
              options: { bullet: true, breakLine: true },
            }));
            slide.addText(pItems, {
              x: posX + 0.2,
              y: 2.5,
              w: colWidth - 0.4,
              h: 2.3,
              fontSize: 12,
              color: textColor,
            });
          });
        } else if (s.layout === "conclusion") {
          slide.addText(s.title, {
            x: 0.8,
            y: 1.0,
            w: 8.5,
            h: 0.7,
            fontSize: 26,
            bold: true,
            color: titleColor,
          });
          if (s.quote) {
            slide.addText(`"${s.quote}"`, {
              x: 0.8,
              y: 1.9,
              w: 8.5,
              h: 1.2,
              fontSize: 16,
              italic: true,
              color: accentColor,
            });
          }
          if (s.bullets && s.bullets.length > 0) {
            const items = s.bullets.map((b) => ({
              text: b,
              options: { bullet: true, breakLine: true },
            }));
            slide.addText(items, {
              x: 0.8,
              y: 3.2,
              w: 8.5,
              h: 1.8,
              fontSize: 13,
              color: textColor,
            });
          }
        } else {
          slide.addText(s.title, {
            x: 0.8,
            y: 0.8,
            w: 8.5,
            h: 0.7,
            fontSize: 22,
            bold: true,
            color: titleColor,
          });
          if (s.subtitle) {
            slide.addText(s.subtitle, {
              x: 0.8,
              y: 1.5,
              w: 8.5,
              h: 0.4,
              fontSize: 13,
              color: accentColor,
            });
          }
          if (s.bullets && s.bullets.length > 0) {
            const items = s.bullets.map((b) => ({
              text: b,
              options: { bullet: true, breakLine: true },
            }));
            slide.addText(items, {
              x: 0.8,
              y: 2.1,
              w: 5.2,
              h: 2.8,
              fontSize: 13,
              color: textColor,
            });
          }
        }

        // Pastki raqam
        slide.addText(`${idx + 1} / ${slides.length}`, {
          x: 8.8,
          y: 5.2,
          w: 0.8,
          h: 0.3,
          fontSize: 10,
          color: "888888",
          align: "right",
        });
      });

      pptx.writeFile({ fileName: `${slaydText || "Taqdimot"}.pptx` });
      localStorage.removeItem(DRAFT_KEY);
      toast.success("PowerPoint fayli yuklab olindi!");
    } catch (e) {
      console.error("PPTX eksport xatosi:", e);
      toast.error("PPTX eksport qilishda xatolik.");
    }
  };

  // ── Draft ni tozalash va yangi yaratishga qaytish
  const handleBackToNew = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setSlides(null);
    setSlaydText("");
    setActiveSlideIndex(0);
    setCurrentTheme(THEMES[0]);
  };

  // ================= GAMMA INTERAKTIV ISH MAYDONI =================
  if (slides) {
    return (
      <div className="gamma-workspace">
        {/* Yuqori boshqaruv paneli */}
        <header className="gamma-topbar">
          <div className="gamma-topbar-left">
            <button
              className="gamma-icon-btn"
              onClick={handleBackToNew}
              title="Yangi yaratishga qaytish"
            >
              <IoArrowBack />
            </button>
            <span className="gamma-doc-title" title={slaydText}>
              {slaydText}
            </span>
          </div>

          <div className="gamma-themes">
            <IoColorPaletteOutline className="theme-icon" />
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`theme-pill ${
                  currentTheme.id === theme.id ? "active" : ""
                }`}
                style={{
                  backgroundColor: theme.bg,
                  borderColor: theme.accent,
                  color: theme.titleColor,
                }}
                onClick={() => setCurrentTheme(theme)}
              >
                <span
                  className="theme-dot"
                  style={{ backgroundColor: theme.accent }}
                />
                {theme.name}
              </button>
            ))}
          </div>

          {/* Eksport tugmalari */}
          <div className="gamma-actions">
            <button
              className="gamma-btn-secondary"
              onClick={() => window.print()}
              title="PDF qilib saqlash yoki chop etish"
            >
              <IoPrintOutline /> PDF / Chop etish
            </button>
            <button
              className="gamma-btn-primary"
              onClick={exportToPPTX}
              title="PowerPoint .pptx formatida yuklab olish"
            >
              <IoDownloadOutline /> PPTX yuklash
            </button>
          </div>
        </header>

        <div className="gamma-main">
          {/* Chap panel: Slaydlar ro'yxati (Thumbnails) */}
          <aside className="gamma-sidebar">
            <div className="gamma-sidebar-list">
              {slides.map((slide, index) => (
                <div
                  key={slide.id || index}
                  className={`gamma-thumb ${
                    activeSlideIndex === index ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveSlideIndex(index);
                    document
                      .getElementById(`slide-card-${index}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <span className="thumb-number">{index + 1}</span>
                  <div
                    className="thumb-preview"
                    style={{
                      backgroundColor: currentTheme.bg,
                      color: currentTheme.titleColor,
                    }}
                  >
                    <p className="thumb-title">{slide.title}</p>
                    <span className="thumb-layout-tag">{slide.layout}</span>
                  </div>

                  <div className="thumb-controls">
                    {index > 0 && (
                      <button
                        className="thumb-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSlide(index, -1);
                        }}
                        title="Yuqoriga"
                      >
                        <IoArrowUpOutline />
                      </button>
                    )}
                    {index < slides.length - 1 && (
                      <button
                        className="thumb-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSlide(index, 1);
                        }}
                        title="Pastga"
                      >
                        <IoArrowDownOutline />
                      </button>
                    )}
                    {slides.length > 1 && (
                      <button
                        className="thumb-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSlide(index);
                        }}
                        title="O'chirish"
                      >
                        <IoTrashOutline />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="gamma-add-slide-btn"
              onClick={() => addNewSlide()}
            >
              <IoAdd /> Yangi slayd qo'shish
            </button>
          </aside>

          {/* Asosiy Ish Maydoni (Canvas) */}
          <main className="gamma-canvas">
            {slides.map((slide, sIdx) => {
              const isSelected = activeSlideIndex === sIdx;

              return (
                <div
                  key={slide.id || sIdx}
                  id={`slide-card-${sIdx}`}
                  className={`gamma-slide-card layout-${slide.layout} ${
                    isSelected ? "selected-card" : ""
                  }`}
                  onClick={() => setActiveSlideIndex(sIdx)}
                  style={{
                    backgroundColor: currentTheme.bg,
                    color: currentTheme.textColor,
                    borderTop: `6px solid ${currentTheme.accent}`,
                  }}
                >
                  {/* Slayd Yuqori Paneli */}
                  <div className="slide-top-bar">
                    <div className="slide-header-info">
                      <span
                        className="slide-badge"
                        style={{
                          backgroundColor: currentTheme.badgeBg,
                          color: currentTheme.accent,
                        }}
                      >
                        {slide.badge || `Slayd ${sIdx + 1}`}
                      </span>

                      {/* Layout tanlash dropdown */}
                      <select
                        className="layout-picker-select"
                        value={slide.layout}
                        onChange={(e) =>
                          changeSlideLayout(sIdx, e.target.value)
                        }
                        title="Slayd tartibini (layout) o'zgartirish"
                      >
                        <option value="cover">Muqova (Cover)</option>
                        <option value="cards">Kartalar (Cards)</option>
                        <option value="stats">Statistika (Stats)</option>
                        <option value="split">Matn va Surat (Split)</option>
                        <option value="process">Bosqichlar (Process)</option>
                        <option value="comparison">
                          Taqqoslash (Comparison)
                        </option>
                        <option value="conclusion">Xulosa (Conclusion)</option>
                      </select>
                    </div>

                    <div className="slide-quick-toolbar">
                      {sIdx > 0 && (
                        <button
                          className="card-action-btn"
                          onClick={() => moveSlide(sIdx, -1)}
                          title="Yuqoriga surish"
                        >
                          <IoArrowUpOutline />
                        </button>
                      )}
                      {sIdx < slides.length - 1 && (
                        <button
                          className="card-action-btn"
                          onClick={() => moveSlide(sIdx, 1)}
                          title="Pastga surish"
                        >
                          <IoArrowDownOutline />
                        </button>
                      )}
                      {slides.length > 1 && (
                        <button
                          className="card-action-btn delete"
                          onClick={() => deleteSlide(sIdx)}
                          title="Slaydni o'chirish"
                        >
                          <IoTrashOutline />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Slayd Sarlavhalari */}
                  <input
                    type="text"
                    className={`editable-title ${
                      slide.layout === "cover" ? "cover-title" : ""
                    }`}
                    value={slide.title}
                    onChange={(e) =>
                      updateSlideField(sIdx, "title", e.target.value)
                    }
                    style={{ color: currentTheme.titleColor }}
                    placeholder="Slayd sarlavhasi..."
                  />

                  <input
                    type="text"
                    className={`editable-subtitle ${
                      slide.layout === "cover" ? "cover-subtitle" : ""
                    }`}
                    value={slide.subtitle || ""}
                    placeholder="Taglavha yoki qisqacha mazmun..."
                    onChange={(e) =>
                      updateSlideField(sIdx, "subtitle", e.target.value)
                    }
                    style={{ color: currentTheme.accent }}
                  />

                  {/* ================= 1. COVER LAYOUT ================= */}
                  {slide.layout === "cover" && (
                    <div className="layout-cover-content">
                      <div className="cover-footer-text">
                        {slide.bullets?.map((bullet, bIdx) => (
                          <div key={bIdx} className="bullet-row">
                            <span
                              className="bullet-dot"
                              style={{ backgroundColor: currentTheme.accent }}
                            />
                            <textarea
                              rows={2}
                              className="editable-bullet-input"
                              value={bullet}
                              onChange={(e) =>
                                updateBullet(sIdx, bIdx, e.target.value)
                              }
                              style={{ color: currentTheme.textColor }}
                            />
                            <button
                              className="remove-bullet-btn"
                              onClick={() => removeBullet(sIdx, bIdx)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          className="add-bullet-btn"
                          onClick={() => addBullet(sIdx)}
                          style={{ color: currentTheme.accent }}
                        >
                          + Yangi band qo'shish
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ================= 2. CARDS LAYOUT ================= */}
                  {slide.layout === "cards" && (
                    <div className="gamma-cards-grid">
                      {slide.cards?.map((card, cIdx) => (
                        <div
                          key={cIdx}
                          className="gamma-card-item"
                          style={{
                            backgroundColor: currentTheme.cardBg,
                            borderColor: currentTheme.cardBorder,
                          }}
                        >
                          <div className="card-item-header">
                            <span
                              className="card-item-num"
                              style={{ backgroundColor: currentTheme.accent }}
                            >
                              {cIdx + 1}
                            </span>
                          </div>
                          <input
                            type="text"
                            className="editable-card-title"
                            value={card.title}
                            onChange={(e) =>
                              updateCardField(
                                sIdx,
                                cIdx,
                                "title",
                                e.target.value,
                              )
                            }
                            style={{ color: currentTheme.titleColor }}
                            placeholder="Karta nomi..."
                          />
                          <textarea
                            rows={4}
                            className="editable-card-desc"
                            value={card.desc}
                            onChange={(e) =>
                              updateCardField(
                                sIdx,
                                cIdx,
                                "desc",
                                e.target.value,
                              )
                            }
                            style={{ color: currentTheme.textColor }}
                            placeholder="Tahliliy ta'rif..."
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ================= 3. STATS LAYOUT ================= */}
                  {slide.layout === "stats" && (
                    <div className="gamma-stats-grid">
                      {slide.stats?.map((stat, stIdx) => (
                        <div
                          key={stIdx}
                          className="gamma-stat-card"
                          style={{
                            backgroundColor: currentTheme.cardBg,
                            borderColor: currentTheme.cardBorder,
                            borderTopColor: currentTheme.accent,
                          }}
                        >
                          <input
                            type="text"
                            className="editable-stat-value"
                            value={stat.value}
                            onChange={(e) =>
                              updateStatField(
                                sIdx,
                                stIdx,
                                "value",
                                e.target.value,
                              )
                            }
                            style={{ color: currentTheme.accent }}
                            placeholder="85%"
                          />
                          <input
                            type="text"
                            className="editable-stat-label"
                            value={stat.label}
                            onChange={(e) =>
                              updateStatField(
                                sIdx,
                                stIdx,
                                "label",
                                e.target.value,
                              )
                            }
                            style={{ color: currentTheme.titleColor }}
                            placeholder="Ko'rsatkich nomi"
                          />
                          <textarea
                            rows={3}
                            className="editable-stat-desc"
                            value={stat.desc}
                            onChange={(e) =>
                              updateStatField(
                                sIdx,
                                stIdx,
                                "desc",
                                e.target.value,
                              )
                            }
                            style={{ color: currentTheme.textColor }}
                            placeholder="Tahliliy izoh..."
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ================= 4. PROCESS LAYOUT ================= */}
                  {slide.layout === "process" && (
                    <div className="gamma-process-grid">
                      {slide.steps?.map((stepItem, spIdx) => (
                        <div
                          key={spIdx}
                          className="gamma-process-step"
                          style={{
                            backgroundColor: currentTheme.cardBg,
                            borderColor: currentTheme.cardBorder,
                          }}
                        >
                          <div className="process-step-header">
                            <span
                              className="step-num-badge"
                              style={{ backgroundColor: currentTheme.accent }}
                            >
                              {stepItem.step || `0${spIdx + 1}`}
                            </span>
                          </div>
                          <input
                            type="text"
                            className="editable-card-title"
                            value={stepItem.title}
                            onChange={(e) =>
                              updateStepField(
                                sIdx,
                                spIdx,
                                "title",
                                e.target.value,
                              )
                            }
                            style={{ color: currentTheme.titleColor }}
                            placeholder="Bosqich nomi..."
                          />
                          <textarea
                            rows={3}
                            className="editable-card-desc"
                            value={stepItem.desc}
                            onChange={(e) =>
                              updateStepField(
                                sIdx,
                                spIdx,
                                "desc",
                                e.target.value,
                              )
                            }
                            style={{ color: currentTheme.textColor }}
                            placeholder="Bosqich tavsifi..."
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ================= 5. COMPARISON LAYOUT ================= */}
                  {slide.layout === "comparison" && (
                    <div className="gamma-comparison-grid">
                      {slide.columns?.map((col, colIdx) => (
                        <div
                          key={colIdx}
                          className="gamma-comparison-col"
                          style={{
                            backgroundColor: currentTheme.cardBg,
                            borderColor: currentTheme.cardBorder,
                          }}
                        >
                          <input
                            type="text"
                            className="comparison-col-header"
                            value={col.title}
                            onChange={(e) =>
                              updateColumnTitle(sIdx, colIdx, e.target.value)
                            }
                            style={{
                              color: currentTheme.titleColor,
                              borderBottomColor: currentTheme.accent,
                              background: "transparent",
                              border: "none",
                              borderBottom: `2px solid ${currentTheme.accent}`,
                              width: "100%",
                              outline: "none",
                            }}
                            placeholder="Ustun sarlavhasi..."
                          />
                          <div className="editable-bullets">
                            {col.points?.map((pt, pIdx) => (
                              <div key={pIdx} className="bullet-row">
                                <span
                                  className="bullet-dot"
                                  style={{
                                    backgroundColor: currentTheme.accent,
                                  }}
                                />
                                <textarea
                                  rows={2}
                                  className="editable-bullet-input"
                                  value={pt}
                                  onChange={(e) =>
                                    updateColumnPoint(
                                      sIdx,
                                      colIdx,
                                      pIdx,
                                      e.target.value,
                                    )
                                  }
                                  style={{ color: currentTheme.textColor }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ================= 6. CONCLUSION LAYOUT ================= */}
                  {slide.layout === "conclusion" && (
                    <div className="gamma-conclusion-box">
                      <div
                        className="quote-bubble"
                        style={{ borderLeftColor: currentTheme.accent }}
                      >
                        <textarea
                          rows={3}
                          className="editable-quote"
                          value={slide.quote || ""}
                          placeholder="Asosiy yakuniy iqtibos yoki chaqiriq..."
                          onChange={(e) =>
                            updateSlideField(sIdx, "quote", e.target.value)
                          }
                          style={{ color: currentTheme.titleColor }}
                        />
                      </div>

                      <div className="editable-bullets">
                        {slide.bullets?.map((bullet, bIdx) => (
                          <div key={bIdx} className="bullet-row">
                            <span
                              className="bullet-dot"
                              style={{ backgroundColor: currentTheme.accent }}
                            />
                            <textarea
                              rows={2}
                              className="editable-bullet-input"
                              value={bullet}
                              onChange={(e) =>
                                updateBullet(sIdx, bIdx, e.target.value)
                              }
                              style={{ color: currentTheme.textColor }}
                            />
                            <button
                              className="remove-bullet-btn"
                              onClick={() => removeBullet(sIdx, bIdx)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          className="add-bullet-btn"
                          onClick={() => addBullet(sIdx)}
                          style={{ color: currentTheme.accent }}
                        >
                          + Xulosa bandi qo'shish
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ================= 7. SPLIT LAYOUT ================= */}
                  {slide.layout === "split" && (
                    <div className="slide-body-grid">
                      <div className="slide-text-area">
                        <div className="editable-bullets">
                          {slide.bullets?.map((bullet, bIdx) => (
                            <div key={bIdx} className="bullet-row">
                              <span
                                className="bullet-dot"
                                style={{ backgroundColor: currentTheme.accent }}
                              />
                              <textarea
                                rows={2}
                                className="editable-bullet-input"
                                value={bullet}
                                onChange={(e) =>
                                  updateBullet(sIdx, bIdx, e.target.value)
                                }
                                style={{ color: currentTheme.textColor }}
                              />
                              <button
                                className="remove-bullet-btn"
                                onClick={() => removeBullet(sIdx, bIdx)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            className="add-bullet-btn"
                            onClick={() => addBullet(sIdx)}
                            style={{ color: currentTheme.accent }}
                          >
                            + Tafsilot qo'shish
                          </button>
                        </div>
                      </div>

                      {/* Mavzuga mos haqiqiy rasm bloki */}
                      <div className="slide-visual-area">
                        <img
                          src={
                            slide.imageUrl ||
                            CURATED_IMAGES[sIdx % CURATED_IMAGES.length]
                          }
                          alt={slide.title}
                          className="slide-image gamma-styled-image"
                          onError={(e) => {
                            e.target.src = CURATED_IMAGES[0];
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span className="image-caption-tag">
                            Mavzu: {slide.imageKeyword || "ilmiy tahlil"}
                          </span>
                          <button
                            onClick={() => refreshSlideImage(sIdx)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: currentTheme.accent,
                              fontSize: 12,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Boshqa rasm tanlash"
                          >
                            <IoRefreshOutline /> Rasmni almashtirish
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Slayd pastki ma'lumot qatori */}
                  <div className="slide-footer-row">
                    <span>Hatif Taqdimot</span>
                    <span>
                      {sIdx + 1} / {slides.length}
                    </span>
                  </div>
                </div>
              );
            })}
          </main>
        </div>
      </div>
    );
  }

  // ================= BOSHLANG'ICH YARATISH OYNASI =================
  return (
    <div className="create-slayd-container">
      <button
        className="create-back-btn"
        onClick={() => navigate(-1)}
        title="Ortga qaytish"
      >
        <IoArrowBack />
      </button>

      <div className="create-header-text">
        <h2>Yaratish</h2>
        <p>Bugun qanday mavzuda Taqdimot yaratmoqchisiz?</p>
      </div>

      <div className="create-action">
        <div className="slide-dropdown-wrapper" ref={dropdownRef}>
          <div className="create-action-row">
            <button
              onClick={() => setShowSlideList(!showSlideList)}
              disabled={loading}
            >
              <span>{selectedCount} slayd</span>
              <span>
                <IoChevronDown />
              </span>
            </button>
          </div>

          {showSlideList && (
            <div className="board-container">
              {slideOptions.map((item) => (
                <button
                  key={item.id}
                  className={selectedCount === item.num ? "active-count" : ""}
                  onClick={() => {
                    setSelectedCount(item.num);
                    setShowSlideList(false);
                  }}
                >
                  <span>{item.num} slayd</span>
                  {item.premium && (
                    <span
                      style={{
                        background: "var(--primary, #461fe2)",
                        padding: "2px 8px",
                        color: "white",
                        fontSize: 11,
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      pro
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="create-slayd-input">
          <input
            type="text"
            placeholder="Nima yaratmoqchisiz tasvirlab bering"
            value={slaydText}
            onChange={(e) => setSlaydText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                handleCreateSlayd();
              }
            }}
            disabled={loading}
          />
          {slaydText && !loading && (
            <button
              className="input-clear-btn"
              onClick={() => setSlaydText("")}
              title="Tozalash"
            >
              <IoClose />
            </button>
          )}
        </div>

        {/* Tezkor tavsiya qilingan mavzular (Suggestion Chips) */}
        {!loading && slaydText.trim().length === 0 && (
          <div className="quick-topics-wrapper">
            <span className="quick-topics-label">Mavzu g'oyalari:</span>
            <div className="quick-topics-list">
              {SUGGESTED_SLIDE_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  type="button"
                  className="quick-topic-chip"
                  onClick={() => setSlaydText(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Yuklanish jarayoni holati */}
        {loading && (
          <div className="create-loading-state">
            <div className="loading-spinner-ring" />
            <p className="loading-status-text">{loadingStep}</p>
          </div>
        )}

        {!loading && slaydText.trim().length > 0 && (
          <div className="css-1e54vvi">
            <button
              onClick={handleCreateSlayd}
              className="create-slyde"
              disabled={loading}
            >
              <span>
                <IoSparkles />
              </span>
              <span>Taqdimot yaratish</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SlaydYaratish;
