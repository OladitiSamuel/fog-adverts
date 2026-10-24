import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, FPS, body, display } from "./theme";
import type { AdvertProps, Scene, Word } from "./types";

const WIPE = 14; // frames the brand-bar transition covers the cut

/** Scene i runs from its narration start to the next scene's start; the first starts at 0, the last runs to the end. */
function sceneFrames(p: AdvertProps, total: number) {
  return p.scenes.map((_, i) => {
    const from = i === 0 ? 0 : Math.round(p.voice.scenes[i].start * FPS) - Math.round(WIPE / 2);
    const to = i === p.scenes.length - 1 ? total : Math.round(p.voice.scenes[i + 1].start * FPS) - Math.round(WIPE / 2);
    return { from, duration: to - from };
  });
}

export const Advert: React.FC<AdvertProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  const frames = sceneFrames(p, durationInFrames);
  const isSecurity = p.division === "FOG Security";

  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily: body }}>
      {p.scenes.map((s, i) => (
        <Sequence key={i} from={frames[i].from} durationInFrames={frames[i].duration} premountFor={FPS}>
          {s.kind === "cta" ? <CtaCard scene={s} /> : <PhotoScene scene={s} index={i} viewfinder={isSecurity && s.kind === "hook"} />}
        </Sequence>
      ))}

      {frames.slice(1).map((f, i) => (
        <Sequence key={`w${i}`} from={f.from - Math.round(WIPE / 2)} durationInFrames={WIPE}>
          <BarWipe />
        </Sequence>
      ))}

      <Chrome division={p.division} />
      <Captions words={p.voice.words} ctaStart={p.voice.scenes[p.scenes.length - 1].start} />
      <ProgressBar />

      {p.voice.audio ? <Audio src={p.voice.audio} /> : null}
      {p.music ? <Audio src={staticFile(p.music)} volume={(f) => interpolate(f, [0, 20, durationInFrames - 30, durationInFrames], [0, 0.12, 0.12, 0], { extrapolateRight: "clamp" })} /> : null}
    </AbsoluteFill>
  );
};

/** Full-bleed photo with a slow push-in, a navy grade, and the scene's headline. */
const PhotoScene: React.FC<{ scene: Scene; index: number; viewfinder: boolean }> = ({ scene, index, viewfinder }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.06, 1.18]);
  const drift = interpolate(frame, [0, durationInFrames], [0, index % 2 ? -40 : 40]);
  const inHead = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const inKick = spring({ frame: frame - 18, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${drift}px)` }}>
        <Img src={staticFile(scene.image!)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${C.navy}e6 0%, ${C.navy}66 34%, ${C.navy}33 52%, ${C.navy}cc 78%, ${C.navy} 100%)`,
        }}
      />
      {viewfinder ? <Viewfinder /> : null}

      <div style={{ position: "absolute", top: 300, left: 72, right: 110, display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: scene.headline.length > 28 ? 96 : 116,
            lineHeight: 0.98,
            color: C.white,
            textTransform: "uppercase",
            letterSpacing: "-0.5px",
            opacity: inHead,
            transform: `translateY(${(1 - inHead) * 40}px)`,
            textShadow: "0 4px 30px rgba(0,0,0,.45)",
          }}
        >
          {scene.headline}
        </div>
        {scene.kicker ? (
          <div
            style={{
              alignSelf: "flex-start",
              fontFamily: body,
              fontWeight: 600,
              fontSize: 44,
              color: C.white,
              background: C.blue,
              padding: "10px 22px",
              transform: `skewX(-12deg) translateX(${(1 - inKick) * -60}px)`,
              opacity: inKick,
            }}
          >
            <span style={{ display: "inline-block", transform: "skewX(12deg)" }}>{scene.kicker}</span>
          </div>
        ) : null}
        {scene.bullets ? <Bullets items={scene.bullets} /> : null}
      </div>
    </AbsoluteFill>
  );
};

const Bullets: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const step = Math.min(40, Math.floor((durationInFrames - 40) / items.length));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 18 }}>
      {items.map((t, i) => {
        const s = spring({ frame: frame - 30 - i * step, fps, config: { damping: 200 } });
        return (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 20, opacity: s, transform: `translateX(${(1 - s) * 50}px)` }}>
            <div style={{ width: 54, height: 54, flex: "none", background: C.blue, display: "grid", placeItems: "center", transform: "skewX(-12deg)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: "skewX(12deg)" }}>
                <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={C.white} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: 46, fontWeight: 600, color: C.white, textShadow: "0 2px 18px rgba(0,0,0,.6)" }}>{t}</div>
          </div>
        );
      })}
    </div>
  );
};

/** CCTV viewfinder: corner brackets, blinking REC and a running timestamp. */
const Viewfinder: React.FC = () => {
  const frame = useCurrentFrame();
  const secs = 23 * 3600 + 47 * 60 + 12 + Math.floor(frame / FPS);
  const ts = [Math.floor(secs / 3600) % 24, Math.floor(secs / 60) % 60, secs % 60].map((n) => String(n).padStart(2, "0")).join(":");
  const corner = (rot: number, pos: React.CSSProperties) => (
    <div style={{ position: "absolute", width: 90, height: 90, borderTop: `6px solid ${C.white}cc`, borderLeft: `6px solid ${C.white}cc`, transform: `rotate(${rot}deg)`, ...pos }} />
  );
  return (
    <AbsoluteFill>
      {corner(0, { top: 190, left: 48 })}
      {corner(90, { top: 190, right: 48 })}
      {corner(270, { bottom: 420, left: 48 })}
      {corner(180, { bottom: 420, right: 48 })}
      <div style={{ position: "absolute", top: 1440, left: 76, display: "flex", gap: 18, alignItems: "center", fontFamily: "monospace", fontSize: 34, color: C.white }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, background: C.rec, opacity: Math.floor(frame / 15) % 2 ? 0.25 : 1 }} />
        REC · CAM 04 · {ts}
      </div>
    </AbsoluteFill>
  );
};

/** Three slanted brand bars sweep across the cut, echoing the FOG logo. */
const BarWipe: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {[0, 1, 2].map((i) => {
        const x = interpolate(frame, [i * 1.5, WIPE - 3 + i * 1.5], [-1500, 1500], { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: i * 640 - 40,
              left: 0,
              width: 1700,
              height: 720,
              background: i === 1 ? C.blueLight : C.blue,
              transform: `translateX(${x}px) skewX(-28deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Closing card: lockup, the ask, and how to reach FOG. */
const CtaCard: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = (d: number) => spring({ frame: frame - d, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 34%, ${C.navy2} 0%, ${C.navy} 72%)`, alignItems: "center" }}>
      {/* The lockup PNG has its own navy ground; "lighten" lets only the light marks through. */}
      <Img
        src={staticFile("brand/fog-lockup.png")}
        style={{ position: "absolute", top: 360, width: 860, mixBlendMode: "lighten", opacity: a(4), transform: `scale(${0.92 + 0.08 * a(4)})` }}
      />
      <div style={{ position: "absolute", top: 860, left: 80, right: 80, textAlign: "center", display: "flex", flexDirection: "column", gap: 36, alignItems: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 118, lineHeight: 0.98, color: C.white, textTransform: "uppercase", opacity: a(14), transform: `translateY(${(1 - a(14)) * 30}px)` }}>
          {scene.headline}
        </div>
        {scene.lines?.map((l, i) => (
          <div
            key={l}
            style={{
              fontSize: i === 0 ? 56 : 48,
              fontWeight: i === 0 ? 700 : 600,
              color: C.white,
              background: i === 0 ? C.blue : "transparent",
              padding: i === 0 ? "16px 38px" : 0,
              transform: i === 0 ? "skewX(-10deg)" : undefined,
              opacity: a(26 + i * 10),
            }}
          >
            <span style={{ display: "inline-block", transform: i === 0 ? "skewX(10deg)" : undefined }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1490, left: 80, right: 80, textAlign: "center", fontSize: 34, letterSpacing: "2px", color: C.silver, textTransform: "uppercase", opacity: a(46) }}>
        FOG Technologies Nexus · Ibadan · Nigeria-wide
      </div>
    </AbsoluteFill>
  );
};

/** Persistent brand mark and division tag. */
const Chrome: React.FC<{ division: string }> = ({ division }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 96, left: 72, display: "flex", alignItems: "center", gap: 18, opacity: o }}>
      <div style={{ width: 76, height: 76, background: C.white, borderRadius: 14, display: "grid", placeItems: "center" }}>
        <Img src={staticFile("brand/fog-icon.png")} style={{ width: 66 }} />
      </div>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 40, letterSpacing: "3px", color: C.white, textTransform: "uppercase", textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
        {division}
      </div>
    </div>
  );
};

/** Word-by-word captions in short phrases; the spoken word lights up blue. Hidden over the closing card. */
const Captions: React.FC<{ words: Word[]; ctaStart: number }> = ({ words, ctaStart }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (!words.length || t >= ctaStart - 0.2) return null;

  const groups: Word[][] = [];
  for (const w of words) {
    const g = groups[groups.length - 1];
    const brk = !g || g.length >= 4 || w.start - g[g.length - 1].end > 0.35 || /[.,?!]$/.test(g[g.length - 1].text);
    if (brk) groups.push([w]);
    else g.push(w);
  }
  const current = groups.find((g) => t >= g[0].start - 0.05 && t <= g[g.length - 1].end + 0.25);
  if (!current) return null;

  return (
    <div style={{ position: "absolute", top: 1180, left: 60, right: 60, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px 18px" }}>
      {current.map((w, i) => {
        const on = t >= w.start && t <= w.end + 0.08;
        return (
          <span
            key={i}
            style={{
              fontFamily: display,
              fontWeight: 800,
              fontSize: 78,
              textTransform: "uppercase",
              color: on ? C.white : "#ffffffd9",
              background: on ? C.blue : "transparent",
              padding: "0 10px",
              textShadow: on ? "none" : "0 3px 14px rgba(0,0,0,.85)",
            }}
          >
            {w.text.replace(/[.,!?]+$/, "")}
          </span>
        );
      })}
    </div>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <div style={{ position: "absolute", top: 0, left: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, background: C.blue }} />;
};
