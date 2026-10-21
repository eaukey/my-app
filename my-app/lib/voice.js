"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Contrôle vocal de l'assistant SAV, sans dépendance :
// - dictée : Web Speech API (SpeechRecognition / webkitSpeechRecognition), fr-FR.
//   Le texte reconnu est écrit dans le champ de saisie ; rien n'est envoyé
//   automatiquement (le client relit puis envoie).
// - lecture : speechSynthesis, voix française si le navigateur en propose une.
// Tout est détecté après le montage (pas de différence serveur/client au rendu),
// et absent si le navigateur ne fournit pas l'API (Firefox pour la dictée…).

const AUTO_READ_KEY = "sav_voice_autoread";

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getSynth() {
  if (typeof window === "undefined") return null;
  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") return null;
  return window.speechSynthesis;
}

const DICTATION_ERRORS = {
  "not-allowed": "Micro refusé : autorisez-le dans les réglages du navigateur.",
  "service-not-allowed": "Micro refusé : autorisez-le dans les réglages du navigateur.",
  "audio-capture": "Aucun micro détecté.",
  "no-speech": "Aucune voix détectée. Réessayez.",
  network: "Dictée indisponible (connexion).",
  "language-not-supported": "Dictée en français indisponible sur ce navigateur.",
};

/**
 * Dictée vers un champ de saisie.
 * getText() renvoie le texte actuel du champ, setText(t) le remplace.
 * Le texte dicté s'ajoute à ce qui était déjà saisi au démarrage.
 */
export function useDictation(getText, setText) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const getTextRef = useRef(getText);
  const setTextRef = useRef(setText);
  getTextRef.current = getText;
  setTextRef.current = setText;

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => {
      try {
        recRef.current?.abort();
      } catch {}
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
  }, []);

  // Coupe net (avant un envoi) : les résultats encore en route sont ignorés.
  const abort = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    setListening(false);
    try {
      rec?.abort();
    } catch {}
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return;
    setError(null);

    const base = (getTextRef.current() || "").trimEnd();
    const prefix = base ? `${base} ` : "";
    let rec;
    try {
      rec = new Ctor();
    } catch {
      setError("Dictée indisponible sur ce navigateur.");
      return;
    }
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      if (recRef.current !== rec) return;
      // Recompose tout le texte de la session : résultats finaux + intermédiaires.
      let said = "";
      for (let i = 0; i < event.results.length; i++) {
        said += event.results[i][0]?.transcript || "";
      }
      setTextRef.current(prefix + said.replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = (event) => {
      if (event?.error === "aborted" || recRef.current !== rec) return;
      setError(DICTATION_ERRORS[event?.error] || "La dictée s'est interrompue. Réessayez.");
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
      setError("Impossible de démarrer la dictée.");
    }
  }, []);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, error, start, stop, abort, toggle };
}

/** Texte lisible à voix haute : sans markdown, sans URL longues. */
export function toSpeechText(markdown) {
  if (!markdown) return "";
  let t = String(markdown);
  t = t.replace(/```[a-z0-9]*\n?([\s\S]*?)```/gi, "$1"); // blocs de code : on garde le contenu
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1"); // images
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // [texte](url) → texte
  // URL nues : on ne lit que le nom du site (ex. « eaukey.fr »).
  t = t.replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/gi, (url) => {
    try {
      const host = new URL(url.startsWith("www.") ? `https://${url}` : url).hostname.replace(/^www\./, "");
      return host || "lien";
    } catch {
      return "lien";
    }
  });
  t = t.replace(/`([^`]*)`/g, "$1");
  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, ""); // titres
  t = t.replace(/^[ \t]{0,3}>[ \t]?/gm, ""); // citations
  t = t.replace(/^[ \t]*([-*_][ \t]*){3,}$/gm, ""); // séparateurs
  t = t.replace(/^[ \t]*[-*+•][ \t]+/gm, ""); // puces
  t = t.replace(/^[ \t]*\|?[ \t]*:?-{2,}.*$/gm, ""); // lignes de séparation de tableau
  t = t.replace(/^[ \t]*\|(.*?)\|?[ \t]*$/gm, "$1"); // bords de tableau
  t = t.replace(/[ \t]*\|[ \t]*/g, ", ");
  t = t.replace(/(\*\*\*|\*\*|\*|~~)(?=\S)([^*~\n]+?)\1/g, "$2"); // gras / italique / barré
  t = t.replace(/(^|[^\w])__?([^_\n]+?)__?(?=[^\w]|$)/g, "$1$2"); // _italique_, __gras__ (pas les noms_avec_tirets)
  t = t.replace(/[*#~]+/g, " ");
  t = t.replace(/[ \t]+/g, " ");
  // Fin de ligne sans ponctuation → petite pause.
  t = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/[.!?:;,…]$/.test(l) ? l : `${l}.`))
    .join(" ");
  return t.trim();
}

// Chrome coupe les énoncés trop longs (~15 s) : on découpe par phrases.
function chunkText(text, max = 220) {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) || [text];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      chunks.push(cur.trim());
      cur = "";
    }
    if (s.length > max) {
      // phrase très longue : coupe aux virgules / espaces
      let rest = s;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(",", max);
        if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
        if (cut <= 0) cut = max;
        chunks.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1);
      }
      cur = rest;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function pickFrenchVoice(synth) {
  let voices = [];
  try {
    voices = synth.getVoices() || [];
  } catch {}
  const fr = voices.filter((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith("fr"));
  return (
    fr.find((v) => (v.lang || "").toLowerCase().replace("_", "-") === "fr-fr" && v.localService) ||
    fr.find((v) => (v.lang || "").toLowerCase().replace("_", "-") === "fr-fr") ||
    fr[0] ||
    null
  );
}

function readAutoRead() {
  try {
    return window.localStorage.getItem(AUTO_READ_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Lecture à voix haute des réponses de l'assistant.
 * speakingId : identifiant du message en cours de lecture (ou null).
 * autoRead : préférence « Lecture automatique des réponses » (localStorage).
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [autoRead, setAutoReadState] = useState(false);
  const autoReadRef = useRef(false);
  const tokenRef = useRef(0); // invalide les fins de lecture d'une lecture annulée

  useEffect(() => {
    const synth = getSynth();
    setSupported(!!synth);
    const saved = readAutoRead();
    autoReadRef.current = saved;
    setAutoReadState(saved);
    // Certaines voix n'arrivent qu'après coup (Chrome) : on les précharge.
    try {
      synth?.getVoices();
    } catch {}
    const tokens = tokenRef;
    return () => {
      tokens.current++; // ignore les fins de lecture après démontage
      try {
        synth?.cancel();
      } catch {}
    };
  }, []);

  const stop = useCallback(() => {
    tokenRef.current++;
    setSpeakingId(null);
    try {
      getSynth()?.cancel();
    } catch {}
  }, []);

  const speak = useCallback((id, markdown) => {
    const synth = getSynth();
    if (!synth) return;
    const text = toSpeechText(markdown);
    const token = ++tokenRef.current;
    try {
      synth.cancel();
    } catch {}
    if (!text) {
      setSpeakingId(null);
      return;
    }
    const voice = pickFrenchVoice(synth);
    const chunks = chunkText(text);
    const done = () => {
      if (tokenRef.current === token) setSpeakingId(null);
    };
    setSpeakingId(id);
    chunks.forEach((chunk, i) => {
      const u = new window.SpeechSynthesisUtterance(chunk);
      u.lang = voice?.lang || "fr-FR";
      if (voice) u.voice = voice;
      u.rate = 1;
      if (i === chunks.length - 1) u.onend = done;
      u.onerror = (e) => {
        if (e?.error !== "interrupted" && e?.error !== "canceled") done();
      };
      try {
        synth.speak(u);
      } catch {
        done();
      }
    });
  }, []);

  const setAutoRead = useCallback(
    (value) => {
      autoReadRef.current = !!value;
      setAutoReadState(!!value);
      try {
        window.localStorage.setItem(AUTO_READ_KEY, value ? "1" : "0");
      } catch {}
      if (!value) stop();
    },
    [stop]
  );

  return { supported, speakingId, speak, stop, autoRead, autoReadRef, setAutoRead };
}
