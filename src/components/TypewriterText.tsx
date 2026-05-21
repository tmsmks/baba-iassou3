import { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface Props {
  text: string;
  /** Si true, affiche tout instantanément (bulles historiques). */
  instant?: boolean;
  /** ms entre 2 caractères. Défaut 18 (rapide mais lisible). */
  speed?: number;
  /** Caractères révélés en bloc à chaque tick (pour accélérer sur longs textes). */
  charsPerTick?: number;
  style?: StyleProp<TextStyle>;
  onDone?: () => void;
}

export function TypewriterText({
  text,
  instant = false,
  speed = 18,
  charsPerTick = 2,
  style,
  onDone,
}: Props) {
  const [revealed, setRevealed] = useState(instant ? text.length : 0);
  const doneRef = useRef(false);

  // Reset si le texte change vraiment
  useEffect(() => {
    doneRef.current = false;
    setRevealed(instant ? text.length : 0);
  }, [text, instant]);

  useEffect(() => {
    if (instant) return;
    if (revealed >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
      return;
    }
    const id = setTimeout(() => {
      setRevealed((r) => Math.min(text.length, r + charsPerTick));
    }, speed);
    return () => clearTimeout(id);
  }, [revealed, text, speed, instant, charsPerTick, onDone]);

  return <Text style={style}>{instant ? text : text.slice(0, revealed)}</Text>;
}
