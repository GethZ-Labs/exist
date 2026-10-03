"use client";

import { useSyncExternalStore } from "react";
import { sound } from "@/lib/sound";

/* Sound on/off: animated equaliser bars, remembered across visits. */
export default function SoundToggle({
  className = "",
  label = false,
}: {
  className?: string;
  label?: boolean;
}) {
  const on = useSyncExternalStore(sound.subscribe, sound.isEnabled, () => true);
  return (
    <button
      type="button"
      className={`sound-toggle ${on ? "is-on" : ""} ${label ? "has-label" : ""} ${className}`}
      aria-pressed={on}
      aria-label={on ? "Mute sound" : "Turn sound on"}
      title={on ? "Mute sound" : "Turn sound on"}
      data-cursor={on ? "Mute" : "Sound"}
      onClick={() => sound.setEnabled(!on)}
    >
      <span className="sound-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {label && (
        <span className="sound-label" aria-hidden="true">
          Sound {on ? "on" : "off"}
        </span>
      )}
    </button>
  );
}
