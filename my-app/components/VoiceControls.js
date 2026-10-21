"use client";
import React from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import styles from "./VoiceControls.module.css";

// Boutons du contrôle vocal, partagés par la messagerie (/chat) et le widget
// « Assistance ». La logique est dans lib/voice.js (useDictation, useSpeech).

/** Bouton micro : clic pour démarrer / arrêter la dictée. Absent si non supporté. */
export function MicButton({ dictation, disabled = false, compact = false }) {
  if (!dictation?.supported) return null;
  const { listening, toggle } = dictation;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled && !listening}
      className={`${styles.micBtn} ${compact ? styles.compact : ""} ${listening ? styles.listening : ""}`}
      aria-pressed={listening}
      aria-label={listening ? "Arrêter la dictée" : "Dicter votre message"}
      title={listening ? "Arrêter la dictée" : "Dicter votre message"}
      data-testid="voice-mic"
    >
      {listening ? <Square size={16} strokeWidth={2.4} /> : <Mic size={18} strokeWidth={2} />}
    </button>
  );
}

/** Ligne d'état sous le champ : « Je vous écoute… » ou message d'erreur. */
export function DictationStatus({ dictation }) {
  if (!dictation?.supported) return null;
  if (dictation.listening) {
    return (
      <div className={styles.status} role="status" data-testid="voice-status">
        <span className={styles.pulse} />
        {"Je vous écoute… relisez puis envoyez."}
      </div>
    );
  }
  if (dictation.error) {
    return (
      <div className={`${styles.status} ${styles.statusError}`} role="alert" data-testid="voice-error">
        {dictation.error}
      </div>
    );
  }
  return null;
}

/** « Écouter » / « Arrêter » sur une réponse de l'assistant. */
export function ListenButton({ speech, id, text }) {
  if (!speech?.supported || !text) return null;
  const playing = speech.speakingId === id;
  return (
    <button
      type="button"
      className={`${styles.listenBtn} ${playing ? styles.playing : ""}`}
      onClick={() => (playing ? speech.stop() : speech.speak(id, text))}
      aria-label={playing ? "Arrêter la lecture" : "Écouter la réponse"}
      data-testid="voice-listen"
    >
      {playing ? <Square size={12} strokeWidth={2.4} /> : <Volume2 size={13} strokeWidth={2} />}
      {playing ? "Arrêter" : "Écouter"}
    </button>
  );
}

/** Interrupteur « Lecture automatique des réponses » (mémorisé dans le navigateur). */
export function AutoReadToggle({ speech }) {
  if (!speech?.supported) return null;
  const on = speech.autoRead;
  return (
    <div className={styles.autoRow}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => speech.setAutoRead(!on)}
        className={styles.toggle}
        data-testid="voice-autoread"
      >
        <span className={`${styles.track} ${on ? styles.trackOn : ""}`}>
          <span className={styles.thumb} />
        </span>
        Lecture automatique des réponses
      </button>
      {speech.speakingId != null && (
        <button type="button" className={styles.stopAll} onClick={speech.stop} data-testid="voice-stop">
          <Square size={11} strokeWidth={2.4} />
          Arrêter la lecture
        </button>
      )}
    </div>
  );
}
