// ====================================================
// OKTAGON QUESTIONS GENERATOR & POOL
// ====================================================

// 1. Dinamik Matematika Generator (Cheksiz, yodlab bo'lmaydigan savollar)
export function generateMathQuestions(count = 10) {
  const questions = [];

  const generators = [
    // Qo'shish va ko'paytirish: a + b * c
    () => {
      const a = Math.floor(Math.random() * 40) + 10;
      const b = Math.floor(Math.random() * 12) + 3;
      const c = Math.floor(Math.random() * 9) + 2;
      const ans = a + b * c;
      const text = `${a} + ${b} × ${c} = ?`;
      return makeMultipleChoice(text, ans);
    },

    // Qavsli ifoda: (a - b) * c
    () => {
      const b = Math.floor(Math.random() * 20) + 5;
      const a = b + Math.floor(Math.random() * 30) + 5;
      const c = Math.floor(Math.random() * 8) + 3;
      const ans = (a - b) * c;
      const text = `(${a} − ${b}) × ${c} = ?`;
      return makeMultipleChoice(text, ans);
    },

    // Bo'lish va qo'shish: a / b + c
    () => {
      const b = Math.floor(Math.random() * 8) + 2;
      const multiplier = Math.floor(Math.random() * 15) + 3;
      const a = b * multiplier;
      const c = Math.floor(Math.random() * 50) + 10;
      const ans = a / b + c;
      const text = `${a} ÷ ${b} + ${c} = ?`;
      return makeMultipleChoice(text, ans);
    },

    // Kvadrat hisoblash: a^2 - b
    () => {
      const a = Math.floor(Math.random() * 16) + 5; // 5..20
      const b = Math.floor(Math.random() * 30) + 5;
      const ans = a * a - b;
      const text = `${a}² − ${b} = ?`;
      return makeMultipleChoice(text, ans);
    },

    // Foiz topish: a ning b% i
    () => {
      const percentages = [10, 20, 25, 50, 75];
      const p = percentages[Math.floor(Math.random() * percentages.length)];
      const baseOptions = [40, 60, 80, 100, 120, 160, 200, 240, 300, 400];
      const base = baseOptions[Math.floor(Math.random() * baseOptions.length)];
      const ans = (base * p) / 100;
      const text = `${base} sonining ${p}% qismi nechaga teng?`;
      return makeMultipleChoice(text, ans);
    },

    // Tenglama: x + a = b yoki x * a = b
    () => {
      const x = Math.floor(Math.random() * 25) + 4;
      const a = Math.floor(Math.random() * 9) + 2;
      const b = x * a;
      const text = `Agar ${a}x = ${b} bo'lsa, x = ?`;
      return makeMultipleChoice(text, x);
    },

    // Qo'shaloq ko'paytirish: a * b - c * d
    () => {
      const a = Math.floor(Math.random() * 9) + 2;
      const b = Math.floor(Math.random() * 9) + 2;
      const c = Math.floor(Math.random() * 5) + 2;
      const d = Math.floor(Math.random() * 5) + 2;
      const ans = a * b - c * d;
      const text = `${a} × ${b} − ${c} × ${d} = ?`;
      return makeMultipleChoice(text, ans);
    },

    // Mantiqiy ketma-ketlik
    () => {
      const start = Math.floor(Math.random() * 10) + 2;
      const step = Math.floor(Math.random() * 6) + 3;
      const s1 = start;
      const s2 = s1 + step;
      const s3 = s2 + step;
      const s4 = s3 + step;
      const ans = s4 + step;
      const text = `Ketma-ketlikni davom ettiring: ${s1}, ${s2}, ${s3}, ${s4}, ... ?`;
      return makeMultipleChoice(text, ans);
    },
  ];

  while (questions.length < count) {
    const fn = generators[Math.floor(Math.random() * generators.length)];
    const q = fn();
    // Takrorlanmaslikni tekshirish
    if (!questions.some((item) => item.text === q.text)) {
      questions.push(q);
    }
  }

  return questions;
}

function makeMultipleChoice(questionText, correctAnswer) {
  const distractors = new Set();
  const correctNum = Number(correctAnswer);

  const deltas = [-10, 10, -5, 5, -2, 2, -1, 1, -3, 3, -4, 4];
  while (distractors.size < 3) {
    const delta = deltas[Math.floor(Math.random() * deltas.length)];
    const fake = correctNum + delta;
    if (fake !== correctNum && fake >= 0) {
      distractors.add(fake);
    }
  }

  const allOptions = [String(correctNum), ...Array.from(distractors).map(String)];
  // Shuffled options
  const shuffled = shuffleArray(allOptions);
  const correctIndex = shuffled.indexOf(String(correctNum));

  return {
    text: questionText,
    options: shuffled,
    correctIndex,
    timeLimit: 12,
  };
}

// 2. Tarix Savollar Banki (O'zbekiston va Jahon tarixi)
const HISTORY_BANK = [
  {
    text: "Amir Temur qaysi yili tug'ilgan?",
    options: ["1336-yil", "1340-yil", "1325-yil", "1350-yil"],
    correctAnswer: "1336-yil",
  },
  {
    text: "Buyuk ipak yo'li qaysi asrlarda eng rivojlangan cho'qqisiga chiqqan?",
    options: ["Milodiy VI-VIII asrlarda", "Mil. avv. III asrda", "Milodiy XI asrda", "Milodiy XIV asrda"],
    correctAnswer: "Milodiy VI-VIII asrlarda",
  },
  {
    text: "Zahiriddin Muhammad Bobur qaysi davlatga asos solgan?",
    options: ["Boburiylar imperiyasi (Hindiston)", "Temuriylar", "Xorazmshohlar", "Somoniylar"],
    correctAnswer: "Boburiylar imperiyasi (Hindiston)",
  },
  {
    text: "Birinchi jahon urushi qaysi yillarda bo'lib o'tgan?",
    options: ["1914–1918-yillar", "1939–1945-yillar", "1905–1907-yillar", "1917–1922-yillar"],
    correctAnswer: "1914–1918-yillar",
  },
  {
    text: "Mirzo Ulug'bek tomonidan bunyod etilgan rasadxona qaysi shaharda joylashgan?",
    options: ["Samarqand", "Buxoro", "Hirot", "Xiva"],
    correctAnswer: "Samarqand",
  },
  {
    text: "Jaloliddin Manguberdi qaysi bosqinchilarga qarshi mardonavor kurashgan?",
    options: ["Mo'g'ullar (Chingizxon)", "Arablar", "Salibchilar", "Eron shohlari"],
    correctAnswer: "Mo'g'ullar (Chingizxon)",
  },
  {
    text: "Qadimgi Misr podsholari qanday nomlangan?",
    options: ["Fir'avn", "Xon", "Sulton", "Imperator"],
    correctAnswer: "Fir'avn",
  },
  {
    text: "Al-Xorazmiy qaysi fanga asos solgan deb hisoblanadi?",
    options: ["Algebra", "Astronomiya", "Falsafa", "Biologiya"],
    correctAnswer: "Algebra",
  },
  {
    text: "Abu Ali ibn Sino qaysi mashhur tibbiy asar muallifi hisoblanadi?",
    options: ["Tib qonunlari", "Al-Qonun fi at-tibb", "Ziji Ko'ragoniy", "Hamsa"],
    correctAnswer: "Tib qonunlari",
  },
  {
    text: "O'zbekiston Respublikasi Mustaqilligi qachon e'lon qilingan?",
    options: ["1991-yil 31-avgust", "1990-yil 1-sentyabr", "1991-yil 8-dekabr", "1992-yil 2-mart"],
    correctAnswer: "1991-yil 31-avgust",
  },
  {
    text: "Ikkinchi jahon urushi qaysi yili tugagan?",
    options: ["1945-yil", "1943-yil", "1944-yil", "1950-yil"],
    correctAnswer: "1945-yil",
  },
  {
    text: "Qadimgi Yunonistonda Olimpiya o'yinlari qaysi xudo sharafiga o'tkazilgan?",
    options: ["Zevs", "Apollon", "Poseydon", "Ares"],
    correctAnswer: "Zevs",
  },
  {
    text: "Somoniylar davlatining poytaxti qaysi shahar bo'lgan?",
    options: ["Buxoro", "Samarqand", "Marv", "Balx"],
    correctAnswer: "Buxoro",
  },
  {
    text: "Jadidchilik harakatining O'zbekistondagi yetakchilaridan biri kim?",
    options: ["Mahmudxo'ja Behbudiy", "Alisher Navoiy", "Bobur", "Mashrab"],
    correctAnswer: "Mahmudxo'ja Behbudiy",
  },
  {
    text: "Buyuk geografik kashfiyotlar davrida Amerikani kashf etgan dengizchi kim?",
    options: ["Xristofor Kolumb", "Vasko da Gama", "Fernan Magellan", "Jeyms Kuk"],
    correctAnswer: "Xristofor Kolumb",
  },
];

// 3. Ingliz tili Savollar Banki (Grammar & Vocabulary)
const ENGLISH_BANK = [
  {
    text: "Choose the correct sentence: 'She ___ to the library yesterday.'",
    options: ["went", "goes", "has gone", "is going"],
    correctAnswer: "went",
  },
  {
    text: "What is the synonym of the word 'BENEFICIAL'?",
    options: ["Helpful", "Dangerous", "Useless", "Difficult"],
    correctAnswer: "Helpful",
  },
  {
    text: "Complete the sentence: 'If it rains tomorrow, we ___ at home.'",
    options: ["will stay", "stayed", "would stay", "stay"],
    correctAnswer: "will stay",
  },
  {
    text: "What is the opposite (antonym) of 'GENEROUS'?",
    options: ["Mean / Stingy", "Polite", "Careful", "Brave"],
    correctAnswer: "Mean / Stingy",
  },
  {
    text: "Choose the correct option: 'I have been living in Tashkent ___ 2018.'",
    options: ["since", "for", "during", "from"],
    correctAnswer: "since",
  },
  {
    text: "What is the plural form of the word 'CHILD'?",
    options: ["Children", "Childs", "Childrens", "Childes"],
    correctAnswer: "Children",
  },
  {
    text: "Choose the correct question tag: 'You are a student, ___?'",
    options: ["aren't you", "don't you", "are you", "isn't it"],
    correctAnswer: "aren't you",
  },
  {
    text: "Which word means 'an unexpected and lucky event'?",
    options: ["Serendipity", "Disaster", "Mistake", "Conflict"],
    correctAnswer: "Serendipity",
  },
  {
    text: "Complete: 'This book is much ___ than the previous one.'",
    options: ["more interesting", "most interesting", "interesting", "as interesting"],
    correctAnswer: "more interesting",
  },
  {
    text: "Choose the correct modal verb: 'You ___ drive without a license.'",
    options: ["mustn't", "needn't", "don't have to", "might"],
    correctAnswer: "mustn't",
  },
  {
    text: "What does the idiom 'Piece of cake' mean?",
    options: ["Very easy task", "Sweet food", "Big problem", "Expensive item"],
    correctAnswer: "Very easy task",
  },
  {
    text: "Choose the correct preposition: 'She is interested ___ learning languages.'",
    options: ["in", "on", "at", "about"],
    correctAnswer: "in",
  },
  {
    text: "Which word is spelled correctly?",
    options: ["Necessary", "Necesary", "Neccessary", "Nesesary"],
    correctAnswer: "Necessary",
  },
  {
    text: "Choose the correct passive voice: 'The letter ___ yesterday.'",
    options: ["was sent", "sent", "is sent", "has sent"],
    correctAnswer: "was sent",
  },
  {
    text: "What is the superlative form of the adjective 'BAD'?",
    options: ["Worst", "Baddest", "Worse", "Less bad"],
    correctAnswer: "Worst",
  },
];

// Fan bo'yicha 10 ta savolni tayyorlab berish
export function getBattleQuestions(category = "matematika", count = 10) {
  if (category === "matematika") {
    return generateMathQuestions(count);
  }

  let bank = HISTORY_BANK;
  if (category === "ingliz-tili" || category === "ingliz tili" || category === "english") {
    bank = ENGLISH_BANK;
  }

  // Shuffle and pick `count` questions
  const shuffledBank = shuffleArray([...bank]);
  const selected = shuffledBank.slice(0, count);

  return selected.map((q) => {
    const shuffledOptions = shuffleArray([...q.options]);
    const correctIndex = shuffledOptions.indexOf(q.correctAnswer);
    return {
      text: q.text,
      options: shuffledOptions,
      correctIndex,
      timeLimit: 12,
    };
  });
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
