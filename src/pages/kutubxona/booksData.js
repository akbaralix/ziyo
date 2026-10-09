import utganKunlarPdf from "../../assets/books/utgan_kunlar_.pdf";

export const BOOKS_DATA = [
  {
    id: "utgan-kunlar",
    title: "O'tgan kunlar",
    author: "Abdulla Qodiriy",
    category: "Badiiy adabiyot",
    img: "src/pages/kutubxona/bookimg/O'tgan-kunlar.jpg",
    year: "1926",
    pages: 288,
    rating: 4.9,
    readersCount: 1420,
    coverColor: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
    badge: "O'zbek durdonasi",
    description:
      "O'zbek adabiyotidagi birinchi milliy roman. XIX asr o'rtalaridagi Qo'qon xonligi davridagi muhabbat, sadoqat va fojiali taqdirlar haqida hikoya qiladi.",
    pdfUrl: utganKunlarPdf,
    featured: true,
  },
  {
    id: "mehrobdan-chayon",
    title: "Mehrobdan chayon",
    author: "Abdulla Qodiriy",
    category: "Tarixiy",
    img: "src/pages/kutubxona/bookimg/mehrobdan-chayon.webp",
    year: "1928",
    pages: 260,
    rating: 4.8,
    readersCount: 980,
    coverColor: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
    badge: "Tarixiy roman",
    description:
      "Xudoyorxon davridagi saroy fitnalari, adolat va qabohat o'rtasidagi ziddiyatlarni yorqin tasvirlab bergan o'lmas asar.",
    pdfUrl: utganKunlarPdf, // fallback
    featured: true,
  },
  {
    id: "sariq-devni-minib",
    title: "Sariq devni minib",
    author: "Xudoyberdi To'xtaboyev",
    img: "src/pages/kutubxona/bookimg/sariq-devni-minib.jpg",
    category: "Sarguzasht",
    year: "1968",
    pages: 240,
    rating: 4.9,
    readersCount: 1650,
    coverColor: "linear-gradient(135deg, #065f46 0%, #10b981 100%)",
    badge: "Sarguzasht",
    description:
      "Hoshimjonning sehrli qalpoqcha orqali boshidan kechirgan kulgili va ibratli sarguzashtlari.",
    pdfUrl: utganKunlarPdf, // fallback
    featured: false,
  },
  {
    id: "dunyoning-ishlari",
    title: "Dunyoning ishlari",
    author: "O'tkir Hoshimov",
    category: "Badiiy adabiyot",
    year: "1982",
    pages: 210,
    rating: 4.9,
    readersCount: 1890,
    coverColor: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)",
    badge: "Eng ko'p o'qilgan",
    description:
      "Ona mehri, insoniy fazilatlar va hayotiy qissalardan iborat qalblarni larzaga soluvchi durdona asar.",
    pdfUrl: utganKunlarPdf, // fallback
    featured: true,
  },
  {
    id: "atom-odatlari",
    title: "Atom odatlari",
    author: "James Clear",
    category: "Rivojlanish",
    year: "2018",
    pages: 320,
    rating: 4.8,
    readersCount: 2300,
    coverColor: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
    badge: "Bestseller",
    description:
      "Mayda o'zgarishlar orqali ulkan natijalarga erishish va yaxshi odatlarni shakllantirish bo'yicha dunyo bo'yicha eng mashhur qo'llanma.",
    pdfUrl: utganKunlarPdf, // fallback
    featured: true,
  },
  {
    id: "toza-kod",
    title: "Clean Code (Toza kod)",
    author: "Robert C. Martin",
    category: "Dasturlash",
    year: "2008",
    pages: 464,
    rating: 4.9,
    readersCount: 870,
    coverColor: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
    badge: "IT & Dasturlash",
    description:
      "Har bir dasturchi o'qishi shart bo'lgan kodlash madaniyati, refaktoring va sifatli dasturiy ta'minot yaratish san'ati.",
    pdfUrl: utganKunlarPdf, // fallback
    featured: false,
  },
];
