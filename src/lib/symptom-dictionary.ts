/**
 * Common symptom misspellings and colloquial variants mapped to
 * standardized clinical-ish terms for consistent LLM input.
 */
export const SYMPTOM_CORRECTIONS: Record<string, string> = {
  // Head / neuro
  headeache: "headache",
  headahe: "headache",
  migrane: "migraine",
  migriane: "migraine",
  dizzyness: "dizziness",
  dizzines: "dizziness",
  lightheded: "lightheaded",
  lightheadednes: "lightheadedness",
  faintting: "fainting",
  confussion: "confusion",
  seisure: "seizure",
  siezure: "seizure",

  // Respiratory
  couging: "coughing",
  couph: "cough",
  sorethrot: "sore throat",
  sorethroat: "sore throat",
  runnynose: "runny nose",
  stuffynose: "stuffy nose",
  shortofbreath: "shortness of breath",
  breathlessnes: "breathlessness",
  wheezingg: "wheezing",
  congession: "congestion",
  nasel: "nasal",

  // GI
  nausia: "nausea",
  nauseau: "nausea",
  vomitting: "vomiting",
  diarrea: "diarrhea",
  diarrhoea: "diarrhea",
  stomache: "stomach ache",
  stomachache: "stomach ache",
  stamoach: "stomach",
  stomac: "stomach",
  stomack: "stomach",
  stomah: "stomach",
  stomacch: "stomach",
  bellyache: "abdominal pain",
  tummyache: "abdominal pain",
  appitite: "appetite",
  apetite: "appetite",
  constipaton: "constipation",
  heartburnn: "heartburn",
  indigestionn: "indigestion",
  bloatting: "bloating",

  // Musculoskeletal
  backacke: "backache",
  backpain: "back pain",
  joinpain: "joint pain",
  musle: "muscle",
  muscel: "muscle",
  crampingg: "cramping",
  stifness: "stiffness",
  swellling: "swelling",

  // Systemic / general
  feaver: "fever",
  fevr: "fever",
  chills: "chills",
  fatige: "fatigue",
  fatique: "fatigue",
  tirednes: "tiredness",
  weaknes: "weakness",
  nightswets: "night sweats",
  nightsweats: "night sweats",
  lossofappetite: "loss of appetite",
  weightloss: "weight loss",

  // Dermatological
  itchyness: "itchiness",
  itchiness: "itchiness",
  rashh: "rash",
  hives: "hives",
  brusing: "bruising",

  // Cardio
  chestpain: "chest pain",
  heartpalpitations: "heart palpitations",
  palpitaions: "palpitations",
  palpitaitons: "palpitations",

  // ENT / eye
  earacke: "earache",
  earpain: "ear pain",
  eyepain: "eye pain",
  blurryvision: "blurry vision",
  blurredvision: "blurred vision",

  // Urinary
  burningurinaton: "burning urination",
  frequenturination: "frequent urination",
  painfulurination: "painful urination",

  // Mental / sleep
  anxity: "anxiety",
  anxeity: "anxiety",
  depresion: "depression",
  insomina: "insomnia",
  sleeplessnes: "sleeplessness",
};

/** Multi-word colloquial phrases normalized before token cleanup. */
export const PHRASE_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bthrowing up\b/gi, "vomiting"],
  [/\bfeel(?:ing)? sick\b/gi, "nausea"],
  [/\bcan't (?:breathe|breath)\b/gi, "shortness of breath"],
  [/\bhard to breathe\b/gi, "shortness of breath"],
  [/\bout of breath\b/gi, "shortness of breath"],
  [/\bshort of breath\b/gi, "shortness of breath"],
  [/\bstuffed up\b/gi, "nasal congestion"],
  [/\brunny nose\b/gi, "runny nose"],
  [/\bsore throat\b/gi, "sore throat"],
  [/\bchest pain\b/gi, "chest pain"],
  [/\bstomach (?:ache|pain)\b/gi, "abdominal pain"],
  [/\btummy (?:ache|pain)\b/gi, "abdominal pain"],
  [/\bhigh temperature\b/gi, "fever"],
  [/\bfeeling hot\b/gi, "fever"],
  [/\bno energy\b/gi, "fatigue"],
  [/\bvery tired\b/gi, "fatigue"],
  [/\bcan't sleep\b/gi, "insomnia"],
  [/\bbody aches?\b/gi, "body aches"],
  [/\bjoint pains?\b/gi, "joint pain"],
  [/\bback pain\b/gi, "back pain"],
  [/\bon wards\b/gi, "onwards"],
  [/\bcould not eat\b/gi, "loss of appetite"],
  [/\bcan't eat\b/gi, "loss of appetite"],
  [/\bcannot eat\b/gi, "loss of appetite"],
  [/\bnot able to eat\b/gi, "loss of appetite"],
  [/\bhappening in (?:my )?stomach\b/gi, "stomach discomfort"],
  [/\bsomething happening in (?:my )?stomach\b/gi, "stomach discomfort"],
];
