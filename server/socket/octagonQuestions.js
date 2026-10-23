// ====================================================
// OKTAGON QUESTIONS GENERATOR & POOL
// ====================================================

// 1. Oson daraja generatorlari: 1000 gacha qo'shish, ayirish, ko'paytirish, bo'lish
const osonGenerators = [
  // Qo'shish: a + b (natija 1000 gacha)
  () => {
    const a = Math.floor(Math.random() * 450) + 20;
    const b = Math.floor(Math.random() * (980 - a)) + 15;
    const ans = a + b;
    return makeMultipleChoice(`${a} + ${b} = ?`, ans);
  },
  // Ayirish: a - b (natija 1000 gacha, musbat)
  () => {
    const a = Math.floor(Math.random() * 850) + 100;
    const b = Math.floor(Math.random() * (a - 15)) + 10;
    const ans = a - b;
    return makeMultipleChoice(`${a} − ${b} = ?`, ans);
  },
  // Ko'paytirish: a * b (natija 1000 gacha)
  () => {
    const a = Math.floor(Math.random() * 35) + 6;
    const maxB = Math.min(45, Math.floor(980 / a));
    const b = Math.floor(Math.random() * Math.max(3, maxB - 2)) + 3;
    const ans = a * b;
    return makeMultipleChoice(`${a} × ${b} = ?`, ans);
  },
  // Bo'lish: a / b (qoldiqsiz butun bo'lish, a 1000 gacha)
  () => {
    const b = Math.floor(Math.random() * 20) + 2;
    const quotient = Math.floor(Math.random() * Math.min(50, Math.floor(980 / b))) + 4;
    const a = b * quotient;
    return makeMultipleChoice(`${a} ÷ ${b} = ?`, quotient);
  },
  // Aralash qo'shish va ayirish: a + b - c (1000 gacha)
  () => {
    const a = Math.floor(Math.random() * 350) + 50;
    const b = Math.floor(Math.random() * 300) + 30;
    const c = Math.floor(Math.random() * Math.min(250, a + b - 20)) + 10;
    const ans = a + b - c;
    return makeMultipleChoice(`${a} + ${b} − ${c} = ?`, ans);
  },
  // Bo'lish va qo'shish: a / b + c (1000 gacha)
  () => {
    const b = Math.floor(Math.random() * 10) + 2;
    const mult = Math.floor(Math.random() * 25) + 5;
    const a = b * mult;
    const c = Math.floor(Math.random() * 150) + 15;
    const ans = a / b + c;
    return makeMultipleChoice(`${a} ÷ ${b} + ${c} = ?`, ans);
  },
  // Ko'paytirish va ayirish: a * b - c (1000 gacha)
  () => {
    const a = Math.floor(Math.random() * 25) + 5;
    const b = Math.floor(Math.random() * 15) + 4;
    const prod = a * b;
    const c = Math.floor(Math.random() * Math.min(60, prod - 5)) + 5;
    const ans = prod - c;
    return makeMultipleChoice(`${a} × ${b} − ${c} = ?`, ans);
  },
];

// 2. Qiyin daraja generatorlari: Qavsli ifodalar, amallar tartibi, foizlar, kvadratlar, tenglamalar
const qiyinGenerators = [
  // Qavsli ifoda: (a - b) * c
  () => {
    const b = Math.floor(Math.random() * 35) + 10;
    const a = b + Math.floor(Math.random() * 45) + 10;
    const c = Math.floor(Math.random() * 14) + 4;
    const ans = (a - b) * c;
    return makeMultipleChoice(`(${a} − ${b}) × ${c} = ?`, ans);
  },
  // Qavsli qo'shish va bo'lish: (a + b) / c
  () => {
    const c = Math.floor(Math.random() * 9) + 3;
    const mult = Math.floor(Math.random() * 35) + 12;
    const sum = c * mult;
    const a = Math.floor(Math.random() * (sum - 20)) + 10;
    const b = sum - a;
    return makeMultipleChoice(`(${a} + ${b}) ÷ ${c} = ?`, mult);
  },
  // Amallar tartibi: a + b * c - d
  () => {
    const a = Math.floor(Math.random() * 80) + 20;
    const b = Math.floor(Math.random() * 18) + 4;
    const c = Math.floor(Math.random() * 12) + 3;
    const d = Math.floor(Math.random() * 45) + 10;
    const ans = a + b * c - d;
    return makeMultipleChoice(`${a} + ${b} × ${c} − ${d} = ?`, ans);
  },
  // Kvadrat va ayirish: a² - b
  () => {
    const a = Math.floor(Math.random() * 18) + 12; // 12..29
    const b = Math.floor(Math.random() * 60) + 15;
    const ans = a * a - b;
    return makeMultipleChoice(`${a}² − ${b} = ?`, ans);
  },
  // Foiz topish
  () => {
    const pList = [15, 20, 25, 30, 40, 60, 75];
    const p = pList[Math.floor(Math.random() * pList.length)];
    const base = (Math.floor(Math.random() * 16) + 4) * 50; // 200..1000
    const ans = (base * p) / 100;
    return makeMultipleChoice(`${base} sonining ${p}% qismi nechaga teng?`, ans);
  },
  // Chiziqli tenglama: ax + b = c
  () => {
    const x = Math.floor(Math.random() * 20) + 4;
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 35) + 5;
    const c = a * x + b;
    return makeMultipleChoice(`Agar ${a}x + ${b} = ${c} bo'lsa, x = ?`, x);
  },
  // Qo'shaloq ko'paytma: a * b - c * d
  () => {
    const a = Math.floor(Math.random() * 18) + 7;
    const b = Math.floor(Math.random() * 14) + 5;
    const c = Math.floor(Math.random() * 10) + 3;
    const d = Math.floor(Math.random() * 8) + 2;
    const ans = a * b - c * d;
    return makeMultipleChoice(`${a} × ${b} − ${c} × ${d} = ?`, ans);
  },
];

// 3. Murakkab daraja generatorlari: Ildizlar, kublar, ko'p bosqichli algebra, manfiy sonlar
const murakkabGenerators = [
  // Ildiz va kvadrat: √a + b²
  () => {
    const perfectSquares = [64, 81, 100, 121, 144, 169, 196, 225, 256, 289, 324, 400];
    const a = perfectSquares[Math.floor(Math.random() * perfectSquares.length)];
    const b = Math.floor(Math.random() * 14) + 8; // 8..21
    const ans = Math.round(Math.sqrt(a)) + b * b;
    return makeMultipleChoice(`√${a} + ${b}² = ?`, ans);
  },
  // Murakkab tenglama: a(x + b) = c
  () => {
    const x = Math.floor(Math.random() * 18) + 3;
    const a = Math.floor(Math.random() * 6) + 3;
    const b = Math.floor(Math.random() * 12) + 2;
    const c = a * (x + b);
    return makeMultipleChoice(`Agar ${a}(x + ${b}) = ${c} bo'lsa, x = ?`, x);
  },
  // Kub va kvadrat ayirmasi: a³ - b²
  () => {
    const a = Math.floor(Math.random() * 5) + 4; // 4..8
    const b = Math.floor(Math.random() * 12) + 4;
    const ans = a * a * a - b * b;
    return makeMultipleChoice(`${a}³ − ${b}² = ?`, ans);
  },
  // 3 bosqichli qavsli ifoda: (a² - b) ÷ c + d × e
  () => {
    const c = Math.floor(Math.random() * 7) + 2;
    const mult = Math.floor(Math.random() * 12) + 4;
    const a = Math.floor(Math.random() * 8) + 12; // 12..19
    const b = a * a - c * mult;
    const d = Math.floor(Math.random() * 11) + 3;
    const e = Math.floor(Math.random() * 8) + 3;
    const ans = mult + d * e;
    return makeMultipleChoice(`(${a}² − ${b}) ÷ ${c} + ${d} × ${e} = ?`, ans);
  },
  // Ildiz ostida yig'indi va ko'paytirish: √(a + b) × c - d
  () => {
    const root = Math.floor(Math.random() * 9) + 11; // 11..19
    const sum = root * root;
    const a = Math.floor(Math.random() * (sum - 30)) + 15;
    const b = sum - a;
    const c = Math.floor(Math.random() * 9) + 4;
    const d = Math.floor(Math.random() * 35) + 10;
    const ans = root * c - d;
    return makeMultipleChoice(`√(${a} + ${b}) × ${c} − ${d} = ?`, ans);
  },
  // Manfiy sonlar amali: (-a) * b + c * d
  () => {
    const a = Math.floor(Math.random() * 14) + 5;
    const b = Math.floor(Math.random() * 10) + 4;
    const c = Math.floor(Math.random() * 16) + 6;
    const d = Math.floor(Math.random() * 12) + 5;
    const ans = -a * b + c * d;
    return makeMultipleChoice(`(−${a}) × ${b} + ${c} × ${d} = ?`, ans);
  },
  // Chiziqli tenglamadan x ni topish: a(x - b) = c
  () => {
    const x = Math.floor(Math.random() * 15) + 6;
    const a = Math.floor(Math.random() * 6) + 3;
    const b = Math.floor(Math.random() * 10) + 2;
    const c = a * (x - b);
    return makeMultipleChoice(`Agar ${a}(x − ${b}) = ${c} bo'lsa, x = ?`, x);
  },
];

// Dinamik Matematika Generator
export function generateMathQuestions(count = 10, difficulty = "oson") {
  const questions = [];
  let generators = osonGenerators;
  if (difficulty === "qiyin") {
    generators = qiyinGenerators;
  } else if (difficulty === "murakkab") {
    generators = murakkabGenerators;
  }

  while (questions.length < count) {
    const fn = generators[Math.floor(Math.random() * generators.length)];
    const q = fn();
    if (!questions.some((item) => item.text === q.text)) {
      questions.push(q);
    }
  }

  return questions;
}

function makeMultipleChoice(questionText, correctAnswer) {
  const distractors = new Set();
  const correctNum = Number(correctAnswer);

  const deltas = [-10, 10, -5, 5, -2, 2, -1, 1, -3, 3, -4, 4, -15, 15, -20, 20];
  let attempts = 0;
  while (distractors.size < 3 && attempts < 50) {
    attempts++;
    const delta = deltas[Math.floor(Math.random() * deltas.length)];
    const fake = correctNum + delta;
    if (fake !== correctNum) {
      distractors.add(fake);
    }
  }

  while (distractors.size < 3) {
    distractors.add(correctNum + distractors.size + 1);
  }

  const allOptions = [String(correctNum), ...Array.from(distractors).map(String)];
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
export function getBattleQuestions(category = "matematika", count = 10, difficulty = "oson") {
  if (category === "matematika") {
    return generateMathQuestions(count, difficulty);
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
