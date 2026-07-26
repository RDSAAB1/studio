const fs = require('fs');

const userPdfTextStream = `--- Page 1 ---
Part 1: Medicine & Pediatrics (Q1 - Q50)
Q1. Which is the most common cause of Community-Acquired Pneumonia (CAP) worldwide?
(A) Mycoplasma pneumoniae
(B) Streptococcus pneumoniae
(C) Klebsiella pneumoniae
(D) Haemophilus influenzae
Answer: (B) Streptococcus pneumoniae
Explanation: Streptococcus pneumoniae (Pneumococcus) duniya bhar me Community- Acquired Pneumonia (CAP) ka sabse common bacterial cause hai.
Q2. A patient presents with chest pain. ECG shows ST elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?
(A) Left anterior descending artery
(B) Right coronary artery
(C) Left circumflex artery
(D) Left main coronary artery
Answer: (B) Right coronary artery
Explanation: Leads II, III, aur aVF heart ke inferior wall ko represent karte hain. Inferior wall ki main blood supply Right Coronary Artery (RCA) se aati hai.
Q3. A 30-year-old female presents with sudden onset palpitation. ECG shows SVT with HR 180 bpm. Vagal maneuvers fail. What is the drug of choice?
(A) Digoxin
(B) Adenosine
(C) Amiodarone
(D) Atropine
Answer: (B) Adenosine
Explanation: Stable Paroxysmal Supraventricular Tachycardia (PSVT) ko terminate karne ke liye Adenosine (6 mg IV bolus) 1st-line drug of choice hai.
Q4. Which class of antidiabetic drugs acts by inhibiting sodium-glucose cotransporter-2 (SGLT2) in the renal tubules?
(A) Sulfonylureas
(B) Empagliflozin
(C) Gliptins
--- Page 2 ---
(D) Metformin
Answer: (B) Empagliflozin
Explanation: SGLT2 inhibitors (jaise Empagliflozin, Dapagliflozin) kidney ke proximal convoluted tubule (PCT) me glucose reabsorption ko rok kar urine se glucose excrete karvate hain.
Q5. Which antibody is most specific for Systemic Lupus Erythematosus (SLE)?
(A) Anti-nuclear antibody (ANA)
(B) Anti-dsDNA
(C) Anti-Smith (Anti-Sm)
(D) Anti-Ro
Answer: (C) Anti-Smith (Anti-Sm)
Explanation: ANA sensitive hota hai, aur Anti-dsDNA disease activity track karta hai, par Anti-Smith (Anti-Sm) SLE ke liye sabse specific antibody hai.
Q6. Classic EEG finding in Absence (Petit mal) Seizures is:
(A) 3 Hz spike and wave discharges
(B) Hypsarrhythmia
(C) Generalized polyspike activity
(D) Focal temporal spikes
Answer: (A) 3 Hz spike and wave discharges
Explanation: Absence seizures (jo mostly children me dekhe jaate hain) ka classic diagnostic EEG pattern 3 Hz spike-and-wave discharge hota hai.
--- Page 13 ---
Q50. "Rib notching" on chest X-ray (inferior border of 3rd to 8th ribs) is seen in:
(A) Patent Ductus Arteriosus
(B) Coarctation of the Aorta
(C) Ventricular Septal Defect
(D) Pulmonary Stenosis
Answer: (B) Coarctation of the Aorta
Explanation: Narrowed aorta ko bypass karne ke liye intercostal collateral arteries enlarge ho kar ribs ke inferior margin par erosion (Rib Notching) karati hain.
Part 2: Obstetrics & Gynecology (Q51-Q100)
Q51. Most common site for ectopic pregnancy implantation is:
(A) Ampulla of Fallopian tube
(B) Isthmus
(C) Infundibulum
--- Page 14 ---
(D) Ovary
Answer: (A) Ampulla of Fallopian tube
Explanation: Tubal ectopic pregnancies me sabse wide aur frequent fertilization site Ampulla (~75-80%) hota hai.
Q52. Gold standard diagnostic modality for ectopic pregnancy is:
(A) Transvaginal Ultrasound
(B) Laparoscopy
(C) Serial beta-hCG
(D) MRI
Answer: (B) Laparoscopy
Explanation: Direct visualization aur same time surgical management ke liye Laparoscopy gold standard modality mani jaati hai.`;

function preprocessPdfText(rawText) {
  let text = rawText.replace(/--- Page \d+ ---/gi, '\n').replace(/\r\n/g, '\n');

  // Insert newline before Part / Topic headers
  text = text.replace(/([^\n])\s*(Part\s*\d+:|Topic\s*\d+:)/gi, '$1\n$2');

  // Insert newline before Question numbers (Q1., Q2., Q100., 1., 2.) - strictly Q<number> followed by . or ) or :
  text = text.replace(/([^\n])\s*(Q\d+[\.\):]\s+)/gi, '$1\n$2');

  // Insert newline before Options ONLY when label is (A), (B), (C), (D) or A), B), C), D) followed by a space
  text = text.replace(/([^\n])\s*([\(\[]?\b[A-Da-d][\)\.\-\]]\s+)/g, '$1\n$2');

  // Insert newline before Answer: or Ans:
  text = text.replace(/([^\n])\s*(Answer:|Ans:|Correct Answer:)/gi, '$1\n$2');

  // Insert newline before Explanation: or vyakhya:
  text = text.replace(/([^\n])\s*(Explanation:|vyakhya:|Solution:)/gi, '$1\n$2');

  return text;
}

function parseBulkQuestions(rawText, defaultSubject = 'Medical & Science') {
  if (!rawText || !rawText.trim()) return [];

  const text = preprocessPdfText(rawText);
  const lines = text.split('\n');

  const questions = [];
  let currentSubject = defaultSubject;
  let currentBlock = [];

  function processCurrentBlock() {
    if (currentBlock.length === 0) return;
    const blockText = currentBlock.join('\n').trim();
    currentBlock = [];

    const contentText = blockText.split(/(?:Answer Key & Explanations|Answer Key \(1)/i)[0];

    const qNumMatch = contentText.match(/^(?:Q|q)?(\d+)[\.\):]\s+([\s\S]+)/i);
    if (!qNumMatch) return;

    const qNum = parseInt(qNumMatch[1], 10);
    const content = qNumMatch[2];

    let inlineCorrectIdx = undefined;
    const ansMatch = content.match(/(?:Answer|Ans|Correct Answer)[\s:-]+[\(\[]?\s*([A-Da-d])\s*[\)\]]?/i);
    if (ansMatch) {
      inlineCorrectIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
    }

    let inlineExplanation = undefined;
    const expMatch = content.match(/(?:Explanation|vyakhya|Solution)[\s:-]+([\s\S]*?)(?=(?:\n\s*(?:Q|q)?\d+[\.\)]|\n\s*Part|\n\s*Topic|$))/i);
    if (expMatch) {
      inlineExplanation = expMatch[1].trim().replace(/\s+/g, ' ');
    }

    const optionMatches = [...content.matchAll(/(?:^|\n)\s*[\(\[]?\s*([A-Da-d])\s*[\)\.\-\]]\s+([^\n]+)/gi)];
    const optionsMap = {};
    let firstOptIdx = content.length;

    optionMatches.forEach((m) => {
      const letter = m[1].toUpperCase();
      let val = m[2].trim();
      val = val.split(/(?:Answer|Ans|Explanation)/i)[0].trim().replace(/\s+/g, ' ');
      if (val) {
        optionsMap[letter] = val;
      }
      const mIdx = content.indexOf(m[0]);
      if (mIdx !== -1 && mIdx < firstOptIdx) {
        firstOptIdx = mIdx;
      }
    });

    let questionStatement = content.slice(0, firstOptIdx).trim().replace(/\s+/g, ' ');
    questionStatement = questionStatement.replace(/(?:Topic|Part)\s*\d*[:\s]*[^\n]+/gi, '').trim();

    const optionsList = [];
    ['A', 'B', 'C', 'D'].forEach((l) => {
      if (optionsMap[l]) optionsList.push(optionsMap[l]);
    });

    if (!questionStatement || optionsList.length < 2) return;

    let correctIdx = 0;
    if (inlineCorrectIdx !== undefined && inlineCorrectIdx >= 0 && inlineCorrectIdx <= 3) {
      correctIdx = inlineCorrectIdx;
    }

    const explanation = inlineExplanation || `Solution for Question ${qNum}`;

    questions.push({
      id: `q-pdf-${qNum}-${questions.length}`,
      qNum,
      subject: currentSubject,
      questionText: questionStatement,
      options: optionsList,
      correctOptionIndex: correctIdx,
      explanation,
    });
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const partMatch = trimmed.match(/^(?:Topic|Part)\s*\d*[:\s]*([^\n\(]+)/i);
    if (partMatch && partMatch[1].trim()) {
      processCurrentBlock();
      currentSubject = partMatch[1].trim().replace(/\(Q\d+.*?\)/gi, '').trim() || defaultSubject;
      return;
    }

    const isNewQuestion = /^(?:Q|q)?\d+[\.\):]\s+/i.test(trimmed);
    if (isNewQuestion) {
      processCurrentBlock();
    }

    currentBlock.push(line);
  });

  processCurrentBlock();

  return questions;
}

const parsed = parseBulkQuestions(userPdfTextStream);
console.log('Parsed questions count from formatted PDF stream:', parsed.length);
console.log('Parsed questions detail:', JSON.stringify(parsed, null, 2));
