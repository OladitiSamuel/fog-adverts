export type SceneKind = "hook" | "problem" | "solution" | "proof" | "cta" | "title" | "statement" | "pillars" | "process" | "map";

export type Scene = {
  kind: SceneKind;
  image?: string;
  headline: string;
  kicker?: string;
  bullets?: string[];
  lines?: string[];
  eyebrow?: string; // executive style: small gold label above the headline
  items?: string[]; // executive style: pillars or process steps
  focus?: string; // CSS object-position for the photo
  voice: string;
};

export type Word = { text: string; start: number; end: number };

/** Output of the voice step: where each scene's narration sits in the audio, plus word timings for captions. */
export type VoiceTrack = {
  audio: string; // path under public/
  duration: number; // seconds
  scenes: { start: number; end: number }[];
  words: Word[];
};

export type AdvertProps = {
  id: string;
  division: string;
  service: string;
  scenes: Scene[];
  voice: VoiceTrack;
  music?: string;
  style?: "standard" | "executive";
  credits?: string;
  // "bold" (default for new adverts): heavier type, larger subtitles and stronger contrast
  // for small phone screens. "light" is the original look used by the launch advert.
  textStyle?: "light" | "bold";
  // Illustrative scenario (not a real job): shows an "Example" tag throughout.
  exampleLabel?: boolean;
};
