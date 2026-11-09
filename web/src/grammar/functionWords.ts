// Hand-written notes for French closed-class words: articles, contractions,
// elided forms and pronouns. Looked up by lower-case form, first as
// "form|POS" (for words whose role depends on the tag) and then as "form".

export interface FunctionWord {
  /** Short label shown as the word's kind. */
  kind: string;
  /** Spanish equivalent. */
  es: string;
  /** Explanation in English. */
  note?: string;
}

const ELIDED = "Elided before a vowel or mute h: the final vowel is dropped and replaced by an apostrophe.";

const W: Record<string, FunctionWord> = {
  // Articles and their contractions
  "le|DET": { kind: "definite article, masc. sing.", es: "el" },
  "la|DET": { kind: "definite article, fem. sing.", es: "la" },
  "les|DET": { kind: "definite article, plural", es: "los / las" },
  "l'|DET": { kind: "definite article (elided le / la)", es: "el / la", note: `l' = le or la. ${ELIDED}` },
  "un|DET": { kind: "indefinite article, masc. sing.", es: "un" },
  "une|DET": { kind: "indefinite article, fem. sing.", es: "una" },
  "un|NUM": { kind: "number (one), masc.", es: "uno / un" },
  "une|NUM": { kind: "number (one), fem.", es: "una" },
  "des|DET": {
    kind: "indefinite article, plural",
    es: "unos / unas (often left out)",
    note: "Plural of un / une. Spanish usually drops it: « des enfants » → « niños ». After a verb or noun that takes de, des can also be the contraction de + les (see below).",
  },
  des: {
    kind: "contraction de + les",
    es: "de los / de las",
    note: "des = de + les. French must contract de + les. The same word is also the plural indefinite article (« des enfants », « unos niños »).",
  },
  "du|DET": {
    kind: "partitive article, masc.",
    es: "(nothing) / algo de",
    note: "du = de + le, here as a partitive article: an unspecified amount of something you can't count (« du sable », sand). Spanish leaves it out.",
  },
  du: { kind: "contraction de + le", es: "del", note: "du = de + le. French must contract de + le, just like Spanish « de + el » → « del »." },
  au: { kind: "contraction à + le", es: "al", note: "au = à + le. French must contract à + le, like Spanish « a + el » → « al »." },
  aux: { kind: "contraction à + les", es: "a los / a las", note: "aux = à + les. French must contract à + les (Spanish keeps « a los »)." },
  de: { kind: "preposition", es: "de", note: "Also used, as « de » alone, instead of un/une/des after a negation (« pas de mouton », « ningún cordero ») and before an adjective in the plural." },
  "d'": { kind: "preposition (elided de)", es: "de", note: `d' = de. ${ELIDED}` },
  à: { kind: "preposition", es: "a / en", note: "Contracts with le → au and with les → aux; à la and à l' stay separate." },

  // Subject pronouns
  je: { kind: "subject pronoun, 1st sing.", es: "yo (usually not said)" },
  "j'": { kind: "subject pronoun (elided je)", es: "yo (usually not said)", note: `j' = je. ${ELIDED} French verbs need an explicit subject; Spanish usually drops it.` },
  tu: { kind: "subject pronoun, 2nd sing.", es: "tú" },
  il: { kind: "subject pronoun, 3rd masc. sing.", es: "él (often not said)", note: "Also the impersonal subject: « il faut », « il y a », « il pleut » (hay que, hay, llueve)." },
  elle: { kind: "pronoun, 3rd fem. sing.", es: "ella" },
  on: { kind: "subject pronoun, indefinite", es: "se / uno / nosotros", note: "« on » takes a 3rd-person singular verb. It means « people / one » (« se dice ») and in speech often « we »." },
  nous: { kind: "pronoun, 1st plural", es: "nosotros / nos", note: "Subject (« nous »), object or reflexive (« nos »)." },
  vous: { kind: "pronoun, 2nd plural or polite", es: "vosotros / usted / os / le", note: "Plural you, or polite singular you (usted). Also the object and reflexive form. The little prince says « s'il vous plaît » (polite) but « dessine-moi » (familiar)." },
  ils: { kind: "subject pronoun, 3rd masc. plural", es: "ellos (often not said)" },
  elles: { kind: "pronoun, 3rd fem. plural", es: "ellas" },

  // Object / reflexive pronouns
  me: { kind: "object or reflexive pronoun, 1st sing.", es: "me" },
  "m'": { kind: "object or reflexive pronoun (elided me)", es: "me", note: `m' = me. ${ELIDED}` },
  te: { kind: "object or reflexive pronoun, 2nd sing.", es: "te" },
  "t'": { kind: "object or reflexive pronoun (elided te)", es: "te", note: `t' = te. ${ELIDED}` },
  se: { kind: "reflexive pronoun, 3rd person", es: "se", note: "Marks a pronominal verb (« se coucher », acostarse) or a reciprocal action." },
  "s'|PRON": { kind: "reflexive pronoun (elided se)", es: "se", note: `s' = se. ${ELIDED}` },
  "s'|SCONJ": { kind: "conjunction (elided si)", es: "si", note: "s' = si (if), elided only before il / ils: « s'il » = « si il ». Not to be confused with s' = se." },
  "s'": { kind: "elided se or si", es: "se / si", note: "s' is se (reflexive) before a vowel, or si (if) before il / ils (« s'il vous plaît » = « si il vous plaît », literally « si le place a usted », por favor)." },
  "le|PRON": { kind: "object pronoun, masc. sing.", es: "lo", note: "Direct object pronoun; goes before the verb (« je le vois », « lo veo »)." },
  "la|PRON": { kind: "object pronoun, fem. sing.", es: "la", note: "Direct object pronoun; goes before the verb." },
  "les|PRON": { kind: "object pronoun, plural", es: "los / las", note: "Direct object pronoun; goes before the verb (« je les ai vues », « las vi »)." },
  "l'|PRON": { kind: "object pronoun (elided le / la)", es: "lo / la", note: `l' = le or la as an object pronoun. ${ELIDED}` },
  lui: { kind: "pronoun, 3rd sing.", es: "le / él", note: "Indirect object (to him / to her: « je lui dis », « le digo ») or stressed form of il (« lui », « él »)." },
  leur: { kind: "pronoun or possessive", es: "les / su", note: "Before a verb: indirect object « to them » (les). Before a noun: possessive « their » (su)." },
  leurs: { kind: "possessive determiner, plural", es: "sus" },
  moi: { kind: "stressed pronoun, 1st sing.", es: "yo / mí", note: "Used alone, after a preposition (« avec moi », conmigo) and after an imperative." },
  "-moi": { kind: "pronoun after an imperative", es: "-me", note: "After an affirmative imperative, me becomes moi and is joined with a hyphen: « dessine-moi » = « dibújame »." },
  toi: { kind: "stressed pronoun, 2nd sing.", es: "tú / ti", note: "Used alone, after a preposition and after an imperative (« assieds-toi », siéntate)." },
  "-toi": { kind: "pronoun after an imperative", es: "-te", note: "After an affirmative imperative, te becomes toi: « approche-toi » = « acércate »." },
  soi: { kind: "stressed reflexive pronoun", es: "sí / uno mismo" },
  eux: { kind: "stressed pronoun, 3rd masc. plural", es: "ellos" },
  y: { kind: "adverbial pronoun", es: "allí / en ello / (nothing)", note: "Replaces à + a thing, or a place (« j'y vais », voy allí). In « il y a » (hay / hace) it is part of a fixed expression." },
  en: { kind: "pronoun or preposition", es: "de ello / en", note: "As a pronoun before a verb it replaces de + something (« j'en ai », tengo de eso; « s'en souvenir », acordarse de ello). As a preposition: in (en)." },
  "en|ADP": { kind: "preposition", es: "en", note: "Also forms the gérondif: en + present participle (« en marchant », caminando)." },
  "en|PRON": { kind: "pronoun", es: "de ello / (nothing)", note: "Replaces de + something, or a quantity (« j'en ai trois », tengo tres). Often has no word in Spanish." },

  // Demonstratives
  ce: { kind: "demonstrative", es: "este / eso / lo", note: "Before a noun: this / that (este). As a pronoun: « ce que » = lo que, « c'est » = es." },
  "c'": { kind: "demonstrative pronoun (elided ce)", es: "eso / (nothing)", note: `c' = ce, almost always in « c'est » (es / eso es). ${ELIDED}` },
  cet: { kind: "demonstrative, masc. sing. before a vowel", es: "este / ese", note: "cet is ce before a vowel or mute h (« cet homme »)." },
  cette: { kind: "demonstrative, fem. sing.", es: "esta / esa" },
  ces: { kind: "demonstrative, plural", es: "estos / esos" },
  ça: { kind: "demonstrative pronoun", es: "eso / esto", note: "Informal short form of cela." },
  cela: { kind: "demonstrative pronoun", es: "eso" },
  ceci: { kind: "demonstrative pronoun", es: "esto" },
  celui: { kind: "demonstrative pronoun, masc. sing.", es: "el / aquel" },
  celle: { kind: "demonstrative pronoun, fem. sing.", es: "la / aquella" },
  ceux: { kind: "demonstrative pronoun, masc. plural", es: "los / aquellos" },
  celles: { kind: "demonstrative pronoun, fem. plural", es: "las / aquellas" },

  // Possessives
  mon: { kind: "possessive, 1st sing. (masc., or fem. before a vowel)", es: "mi" },
  ma: { kind: "possessive, 1st sing., fem.", es: "mi" },
  mes: { kind: "possessive, 1st sing., plural", es: "mis" },
  ton: { kind: "possessive, 2nd sing.", es: "tu" },
  ta: { kind: "possessive, 2nd sing., fem.", es: "tu" },
  tes: { kind: "possessive, 2nd sing., plural", es: "tus" },
  son: { kind: "possessive, 3rd sing.", es: "su", note: "Agrees with the thing owned, not the owner: « son étoile » (his or her star)." },
  sa: { kind: "possessive, 3rd sing., fem.", es: "su", note: "Agrees with the thing owned, not the owner." },
  ses: { kind: "possessive, 3rd sing., plural", es: "sus" },
  notre: { kind: "possessive, 1st plural", es: "nuestro / nuestra" },
  nos: { kind: "possessive, 1st plural, plural", es: "nuestros / nuestras" },
  votre: { kind: "possessive, 2nd plural or polite", es: "vuestro / su" },
  vos: { kind: "possessive, 2nd plural or polite, plural", es: "vuestros / sus" },

  // Relatives, interrogatives, conjunctions
  qui: { kind: "relative or interrogative pronoun", es: "que / quien / quién", note: "Relative: the subject of the clause (« un livre qui s'appelait », un libro que se llamaba). Question: who." },
  que: { kind: "conjunction or pronoun", es: "que / qué", note: "Relative: the object of the clause. Conjunction: that. In « ne ... que »: only. Question: what." },
  "qu'": { kind: "elided que", es: "que / qué", note: `qu' = que. ${ELIDED} « qu'est-ce que » = « qué » (literally « what is it that »).` },
  quoi: { kind: "interrogative pronoun", es: "qué" },
  dont: { kind: "relative pronoun", es: "del que / cuyo", note: "Replaces de + qui / lequel: « l'ami dont je parle » = « el amigo del que hablo »." },
  où: { kind: "relative or interrogative adverb", es: "donde / dónde", note: "With an accent: where. Without (ou): or." },
  ou: { kind: "conjunction", es: "o" },
  "lorsqu'": { kind: "conjunction (elided lorsque)", es: "cuando", note: "lorsqu' = lorsque, elided before il, elle, on, un, une." },
  "puisqu'": { kind: "conjunction (elided puisque)", es: "ya que", note: "puisqu' = puisque, elided before a vowel." },
  "jusqu'": { kind: "preposition (elided jusque)", es: "hasta", note: "jusqu' = jusque, almost always in « jusqu'à » (hasta)." },
  "quoiqu'": { kind: "conjunction (elided quoique)", es: "aunque" },
  "presqu'": { kind: "adverb (elided presque)", es: "casi" },
  si: { kind: "conjunction or adverb", es: "si / tan / sí", note: "If (si); so (tan); or « yes » contradicting a negative question. Elided to s' only before il / ils." },

  voilà: { kind: "presentative", es: "he aquí / ahí está", note: "Points at something: « voilà » = there is / here it is (originally « vois là », see there)." },
  voici: { kind: "presentative", es: "he aquí / aquí está", note: "Points at something near: here is (originally « vois ici », see here)." },

  // Negation
  ne: { kind: "negation particle", es: "no", note: "First half of the negation: ne + verb + pas / plus / jamais / rien / personne / que. Together they mean Spanish « no » (« ne ... plus », ya no; « ne ... jamais », nunca)." },
  "n'": { kind: "negation particle (elided ne)", es: "no", note: `n' = ne. ${ELIDED} Goes with pas / plus / jamais / rien after the verb.` },
  pas: { kind: "negation (second half)", es: "no", note: "With ne: « ne ... pas » = no. Spoken French often drops the ne." },
  plus: { kind: "adverb", es: "más / ya no", note: "« ne ... plus » = ya no (no longer). Otherwise: more." },
  jamais: { kind: "adverb", es: "nunca", note: "« ne ... jamais » = nunca." },
  rien: { kind: "pronoun", es: "nada", note: "« ne ... rien » = nada." },

  // Expressions with euphonic letters
  "-t-il": { kind: "pronoun il with euphonic t", es: "(él)", note: "In inverted questions the t is inserted between two vowels just for sound: « a-t-il » = « a il »." },
  "-t-elle": { kind: "pronoun elle with euphonic t", es: "(ella)", note: "The t is inserted between two vowels just for sound: « répondit-elle » / « a-t-elle »." },
  "-t-on": { kind: "pronoun on with euphonic t", es: "(se)", note: "The t is inserted between two vowels just for sound." },
  "-il": { kind: "subject pronoun, inverted", es: "(él)", note: "Inverted after the verb in questions and in « dit-il » (dijo él)." },
  "-elle": { kind: "subject pronoun, inverted", es: "(ella)", note: "Inverted after the verb in questions and after speech verbs." },
  "-je": { kind: "subject pronoun, inverted", es: "(yo)", note: "Inverted after the verb in questions and after speech verbs." },
  "-tu": { kind: "subject pronoun, inverted", es: "(tú)", note: "Inverted in questions: « veux-tu » = « ¿quieres? »." },
  "-vous": { kind: "pronoun, inverted or after imperative", es: "(usted) / -os", note: "Inverted in questions or attached to an imperative." },
  "-nous": { kind: "pronoun, inverted or after imperative", es: "-nos", note: "Inverted in questions or attached to an imperative." },
  "-ce": { kind: "demonstrative ce, inverted", es: "(eso)", note: "« est-ce que » turns a sentence into a question; « qu'est-ce que » = qué." },
  "-le": { kind: "object pronoun after an imperative", es: "-lo", note: "« dessine-le » = « dibújalo »." },
  "-la": { kind: "object pronoun after an imperative", es: "-la" },
  "-les": { kind: "object pronoun after an imperative", es: "-los / -las" },
  "-lui": { kind: "indirect object after an imperative", es: "-le" },
  "-leur": { kind: "indirect object after an imperative", es: "-les" },
  "-en": { kind: "pronoun en after an imperative", es: "(de ello)" },
  "-y": { kind: "pronoun y after an imperative", es: "(allí)" },
  "-là": { kind: "adverb suffix", es: "ese / aquel", note: "« ce ... -là » points at something further away (ese, aquel); « celui-là » = aquel." },
  "-ci": { kind: "adverb suffix", es: "este", note: "« ce ... -ci » points at something near (este); « celui-ci » = este." },
};

export function functionWord(form: string, pos?: string): FunctionWord | undefined {
  const f = form.toLowerCase().replace("’", "'");
  return (pos && W[`${f}|${pos}`]) || W[f];
}
