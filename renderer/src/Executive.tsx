import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import nigeria from "./data/nigeria.json";
import { FPS, X, body, serif } from "./theme";
import type { AdvertProps, Scene, Word } from "./types";

/**
 * Executive style: for adverts aimed at CEOs and boards. Calm pacing, a serif
 * headline face, ivory on ink with a gold accent, slow cross-dissolves, and
 * sentence subtitles for sound-off viewing (LinkedIn autoplays muted).
 * Lays itself out for 4:5, 9:16 and 16:9 from the composition size.
 */

/** Type settings for the two text styles; "bold" is for clear reading on small screens. */
const STYLES = {
  light: { head: 300, headScale: 1, body: 500, eyebrow: 25, eyebrowW: 600, line: 36, lineColor: X.ivoryDim, item: 34, sub: 36, subW: 500, subBg: "#07101dad", grade: 0, shadow: "none", label: 22 },
  bold: { head: 600, headScale: 1.06, body: 600, eyebrow: 29, eyebrowW: 700, line: 40, lineColor: X.ivory, item: 37, sub: 42, subW: 600, subBg: "#07101de6", grade: 0.18, shadow: "0 2px 22px rgba(0,0,0,.65)", label: 25 },
};
type TS = (typeof STYLES)["bold"];
const StyleCtx = React.createContext<TS>(STYLES.bold);
const useTS = () => React.useContext(StyleCtx);

const XF = 18; // cross-dissolve length in frames
const LEAD = 0.35; // a scene's visuals arrive this many seconds before its narration

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const rise = (frame: number, at: number, len = 26) => interpolate(frame, [at, at + len], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

type Layout = { W: number; H: number; landscape: boolean; tall: boolean; padX: number; top: number; contentBottom: number; subY: number };

function useLayout(): Layout {
  const { width: W, height: H } = useVideoConfig();
  const landscape = W > H;
  const tall = H / W > 1.5;
  return {
    W,
    H,
    landscape,
    tall,
    padX: landscape ? 140 : 84,
    top: landscape ? 64 : tall ? 150 : 72,
    // Bottom of the content area; below it sit the subtitles (and, on 9:16, the app's own UI).
    contentBottom: landscape ? H - 190 : tall ? H * 0.68 : H - 240,
    subY: landscape ? H - 150 : tall ? H * 0.71 : H - 190,
  };
}

function sceneFrames(p: AdvertProps, total: number) {
  return p.scenes.map((_, i) => {
    const from = i === 0 ? 0 : Math.round((p.voice.scenes[i].start - LEAD) * FPS);
    const to = i === p.scenes.length - 1 ? total : Math.round((p.voice.scenes[i + 1].start - LEAD) * FPS) + XF;
    return { from, duration: to - from };
  });
}

export const Executive: React.FC<AdvertProps> = (p) => {
  const { durationInFrames } = useVideoConfig();
  const frames = sceneFrames(p, durationInFrames);
  const ctaFrom = frames[frames.length - 1].from;

  return (
    <StyleCtx.Provider value={STYLES[p.textStyle ?? "bold"]}>
    <AbsoluteFill style={{ background: X.ink, fontFamily: body }}>
      {p.scenes.map((s, i) => (
        <Sequence key={i} from={frames[i].from} durationInFrames={frames[i].duration} premountFor={FPS}>
          <Fade first={i === 0} last={i === p.scenes.length - 1}>
            <SceneView scene={s} index={i} count={p.scenes.length} credits={p.credits} />
          </Fade>
        </Sequence>
      ))}

      <Chrome count={p.scenes.length} frames={frames} hideFrom={ctaFrom} example={Boolean(p.exampleLabel)} />
      <Subtitles words={p.voice.words} hideFrom={p.voice.scenes[p.scenes.length - 1].start - 0.2} />
      <Progress />

      {p.voice.audio ? <Audio src={p.voice.audio} /> : null}
      {p.music ? (
        <Audio
          src={staticFile(p.music)}
          volume={(f) => interpolate(f, [0, 30, durationInFrames - 45, durationInFrames], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      ) : null}
    </AbsoluteFill>
    </StyleCtx.Provider>
  );
};

const Fade: React.FC<{ first: boolean; last: boolean; children: React.ReactNode }> = ({ first, last, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = first ? 1 : interpolate(frame, [0, XF], [0, 1], { extrapolateRight: "clamp" });
  const b = last ? 1 : interpolate(frame, [durationInFrames - XF, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  return <AbsoluteFill style={{ opacity: Math.min(a, b) }}>{children}</AbsoluteFill>;
};

const SceneView: React.FC<{ scene: Scene; index: number; count: number; credits?: string }> = ({ scene, credits }) => {
  switch (scene.kind) {
    case "pillars":
      return <Pillars scene={scene} />;
    case "process":
      return <Process scene={scene} />;
    case "map":
      return <MapScene scene={scene} />;
    case "cta":
      return <Closing scene={scene} credits={credits} />;
    default:
      return <Statement scene={scene} />;
  }
};

/** Photo, slow push-in, ink grade and vignette. */
const Backdrop: React.FC<{ image?: string; focus?: string; dim?: number }> = ({ image, focus, dim: dimIn = 0 }) => {
  const frame = useCurrentFrame();
  const T = useTS();
  const dim = image ? Math.min(0.75, dimIn + T.grade) : dimIn;
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.04, 1.13]);
  return (
    <AbsoluteFill>
      {image ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <Img
            src={staticFile(image)}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus ?? "50% 50%", filter: "saturate(0.7) contrast(1.06) brightness(0.82)" }}
          />
        </AbsoluteFill>
      ) : (
        <Field />
      )}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${X.ink}d9 0%, ${X.ink}40 30%, ${X.ink}33 50%, ${X.ink}e6 78%, ${X.ink} 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 45%, transparent 55%, ${X.ink}cc 100%)` }} />
      {dim ? <AbsoluteFill style={{ background: X.ink, opacity: dim }} /> : null}
    </AbsoluteFill>
  );
};

/** Graphic ground for scenes without a photo: ink with a navy glow and a faint drifting grid. */
const Field: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = (frame * 0.25) % 120;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(90% 70% at 30% 30%, ${X.navy} 0%, ${X.ink} 70%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${X.ivory}0a 1px, transparent 1px), linear-gradient(90deg, ${X.ivory}0a 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          backgroundPosition: `${shift}px ${shift}px`,
        }}
      />
    </AbsoluteFill>
  );
};

const Eyebrow: React.FC<{ text?: string; at?: number }> = ({ text, at = 4 }) => {
  const frame = useCurrentFrame();
  const T = useTS();
  if (!text) return null;
  const line = rise(frame, at, 30);
  const word = rise(frame, at + 10);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ width: 72 * line, height: 2, background: X.gold }} />
      <div style={{ fontFamily: body, fontWeight: T.eyebrowW, fontSize: T.eyebrow, letterSpacing: "6px", textTransform: "uppercase", color: T === STYLES.bold ? X.goldSoft : X.gold, opacity: word, textShadow: T.shadow }}>{text}</div>
    </div>
  );
};

const Headline: React.FC<{ text: string; at?: number; size?: number }> = ({ text, at = 12, size }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const T = useTS();
  const a = rise(frame, at, 34);
  const base = (size ?? (L.landscape ? 76 : text.length > 48 ? 70 : 82)) * T.headScale;
  return (
    <div
      style={{
        fontFamily: serif,
        fontWeight: T.head,
        fontSize: base,
        lineHeight: 1.1,
        letterSpacing: "-0.5px",
        color: X.ivory,
        opacity: a,
        transform: `translateY(${(1 - a) * 28}px)`,
        textWrap: "balance",
        textShadow: T.shadow,
        maxWidth: L.landscape ? L.W * 0.56 : undefined,
      }}
    >
      {text}
    </div>
  );
};

/** Title and statement scenes: photo, eyebrow, serif headline, optional short lines. */
const Statement: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const L = useLayout();
  const T = useTS();
  const lines = scene.lines ?? [];
  const gap = Math.min(40, Math.max(18, Math.floor((durationInFrames * 0.55) / Math.max(1, lines.length))));
  return (
    <AbsoluteFill>
      <Backdrop image={scene.image} focus={scene.focus} />
      <div
        style={{
          position: "absolute",
          left: L.padX,
          right: L.padX,
          top: L.top + 140,
          bottom: L.H - L.contentBottom,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 30,
        }}
      >
        <Eyebrow text={scene.eyebrow} />
        <Headline text={scene.headline} />
        {lines.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            {lines.map((t, i) => {
              const a = rise(frame, 40 + i * gap);
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 18, opacity: a, transform: `translateX(${(1 - a) * 24}px)` }}>
                  <div style={{ width: 26, height: 2, background: X.gold, flex: "none" }} />
                  <div style={{ fontFamily: body, fontWeight: T.body, fontSize: L.landscape ? T.line - 2 : T.line, color: T.lineColor, textShadow: T.shadow }}>{t}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Capability grid: numbered items reveal one by one across the scene. */
const Pillars: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const L = useLayout();
  const T = useTS();
  const items = scene.items ?? [];
  const cols = L.landscape ? 4 : 2;
  const step = Math.floor((durationInFrames * 0.6) / Math.max(1, items.length));
  return (
    <AbsoluteFill>
      <Field />
      <div style={{ position: "absolute", left: L.padX, right: L.padX, top: L.top + 140, bottom: L.H - L.contentBottom, display: "flex", flexDirection: "column", justifyContent: "center", gap: L.landscape ? 48 : 60 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <Eyebrow text={scene.eyebrow} />
          <Headline text={scene.headline} size={L.landscape ? 64 : 68} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: 40, rowGap: L.landscape ? 34 : 30 }}>
          {items.map((t, i) => {
            const a = rise(frame, 30 + i * step, 22);
            return (
              <div key={t} style={{ borderTop: `1px solid ${X.rule}`, paddingTop: 16, opacity: 0.15 + 0.85 * a, transform: `translateY(${(1 - a) * 14}px)` }}>
                <div style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: 32, color: T === STYLES.bold ? X.goldSoft : X.gold }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ fontFamily: body, fontWeight: T.body, fontSize: L.landscape ? T.item - 4 : T.item, color: X.ivory, marginTop: 6, lineHeight: 1.15 }}>{t}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Delivery process: a gold line advances through the steps. */
const Process: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const L = useLayout();
  const T = useTS();
  const items = scene.items ?? [];
  const span = durationInFrames * 0.72;
  const progress = interpolate(frame, [24, 24 + span], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const n = items.length;
  const active = (i: number) => progress >= (n === 1 ? 0 : i / (n - 1)) - 0.001;

  const steps = L.landscape ? (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, marginTop: 20 }}>
      <div style={{ position: "absolute", top: 11, left: "10%", right: "10%", height: 2, background: X.rule }} />
      <div style={{ position: "absolute", top: 11, left: "10%", width: `${80 * progress}%`, height: 2, background: X.gold }} />
      {items.map((t, i) => (
        <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center" }}>
          <Node on={active(i)} />
          <div style={{ fontFamily: body, fontWeight: T.body, fontSize: T === STYLES.bold ? 31 : 28, color: active(i) ? X.ivory : X.ivoryDim, maxWidth: 280, textShadow: T.shadow }}>{t}</div>
        </div>
      ))}
    </div>
  ) : (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: L.tall ? 38 : 30, marginTop: 10 }}>
      <div style={{ position: "absolute", left: 11, top: 12, bottom: 12, width: 2, background: X.rule }} />
      <div style={{ position: "absolute", left: 11, top: 12, height: `calc(${progress * 100}% - ${progress * 24}px)`, width: 2, background: X.gold }} />
      {items.map((t, i) => (
        <div key={t} style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <Node on={active(i)} />
          <div style={{ fontFamily: body, fontWeight: T.body, fontSize: T === STYLES.bold ? (t.length > 30 ? 36 : 42) : 40, color: active(i) ? X.ivory : T === STYLES.bold ? "#f3eee499" : "#f3eee466", textShadow: T.shadow }}>{t}</div>
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill>
      <Backdrop image={scene.image} focus={scene.focus} dim={0.45} />
      <div style={{ position: "absolute", left: L.padX, right: L.padX, top: L.top + 140, bottom: L.H - L.contentBottom, display: "flex", flexDirection: "column", justifyContent: "center", gap: L.landscape ? 60 : 56 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <Eyebrow text={scene.eyebrow} />
          <Headline text={scene.headline} size={L.landscape ? 64 : 68} />
        </div>
        {steps}
      </div>
    </AbsoluteFill>
  );
};

const Node: React.FC<{ on: boolean }> = ({ on }) => (
  <div style={{ width: 24, height: 24, borderRadius: 12, flex: "none", border: `2px solid ${X.gold}`, background: on ? X.gold : X.ink, boxShadow: on ? `0 0 18px ${X.gold}88` : "none", position: "relative", zIndex: 1 }} />
);

type NG = { aspect: number; outline: number[][]; dots: number[][]; cities: Record<string, number[]>; hub: string };
const NGD = nigeria as NG;
// Label placement for cities that sit close together on the map.
const LEFT_LABEL = new Set(["Lagos", "Benin City", "Warri"]);
const BELOW_LABEL = new Set(["Lagos"]);

/** Nigeria as a dot field; links run from the Ibadan hub to cities across the country. */
const MapScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const L = useLayout();
  const T = useTS();
  const mapW = L.landscape ? L.W * 0.4 : L.W - L.padX * 2 - (L.tall ? 40 : 300);
  const mapH = mapW / NGD.aspect;
  const hub = NGD.cities[NGD.hub];
  const others = Object.entries(NGD.cities).filter(([k]) => k !== NGD.hub);
  const step = Math.floor((durationInFrames * 0.5) / others.length);
  const reveal = rise(frame, 0, 40);
  const P = (c: number[]) => [c[0] * mapW, c[1] * mapH];
  const [hx, hy] = P(hub);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 9);

  const map = (
    <svg width={mapW} height={mapH} viewBox={`0 0 ${mapW} ${mapH}`} style={{ overflow: "visible", opacity: reveal }}>
      <polygon points={NGD.outline.map((c) => P(c).join(",")).join(" ")} fill="none" stroke={`${X.ivory}33`} strokeWidth={1.5} />
      {NGD.dots.map((c, i) => {
        const [x, y] = P(c);
        return <circle key={i} cx={x} cy={y} r={mapW / 340} fill={`${X.ivory}2e`} />;
      })}
      {others.map(([name, c], i) => {
        const [x, y] = P(c);
        const t = rise(frame, 20 + i * step, 30);
        const mx = (hx + x) / 2;
        const my = Math.min(hy, y) - Math.hypot(x - hx, y - hy) * 0.28;
        const len = Math.hypot(x - hx, y - hy) * 1.25 + 1;
        return (
          <g key={name}>
            <path d={`M ${hx} ${hy} Q ${mx} ${my} ${x} ${y}`} fill="none" stroke={X.gold} strokeWidth={2} strokeDasharray={len} strokeDashoffset={len * (1 - t)} opacity={0.85} />
            <circle cx={x} cy={y} r={7 * t} fill={X.gold} />
            <text x={LEFT_LABEL.has(name) ? x - 14 : x + 14} y={y + (BELOW_LABEL.has(name) ? 30 : 7)} textAnchor={LEFT_LABEL.has(name) ? "end" : "start"} fill={X.ivory} opacity={t * 0.85} style={{ fontFamily: body, fontSize: L.landscape ? T.label - 2 : T.label, fontWeight: T.body }}>
              {name}
            </text>
          </g>
        );
      })}
      <circle cx={hx} cy={hy} r={16 + 14 * pulse} fill="none" stroke={X.gold} strokeWidth={2} opacity={0.6 * (1 - pulse)} />
      <circle cx={hx} cy={hy} r={11} fill={X.goldSoft} />
      <text x={hx - 18} y={hy - 18} fill={X.goldSoft} textAnchor="end" style={{ fontFamily: body, fontSize: L.landscape ? 22 : 24, fontWeight: 600, letterSpacing: "2px" }}>
        {NGD.hub.toUpperCase()}
      </text>
    </svg>
  );

  const text = (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <Eyebrow text={scene.eyebrow} />
      <Headline text={scene.headline} size={L.landscape ? 64 : 66} />
      {(scene.lines ?? []).map((t, i) => {
        const a = rise(frame, 50 + i * 30);
        return (
          <div key={t} style={{ fontFamily: body, fontWeight: T.body, fontSize: L.landscape ? T.line - 8 : T.line - 5, letterSpacing: "1px", color: T.lineColor, opacity: a }}>
            {t}
          </div>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill>
      <Field />
      {L.landscape ? (
        <div style={{ position: "absolute", left: L.padX, right: L.padX, top: L.top + 110, bottom: L.H - L.contentBottom, display: "flex", alignItems: "center", gap: 90 }}>
          <div style={{ flex: 1 }}>{text}</div>
          {map}
        </div>
      ) : (
        <div style={{ position: "absolute", left: L.padX, right: L.padX, top: L.top + 130, bottom: L.H - L.contentBottom, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ alignSelf: "center" }}>{map}</div>
          {text}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Closing card: lockup, the ask, contacts, image credits. */
const Closing: React.FC<{ scene: Scene; credits?: string }> = ({ scene, credits }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const T = useTS();
  const a = (d: number) => rise(frame, d, 30);
  const lockW = L.landscape ? 620 : 700;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 70% at 50% 38%, ${X.navy} 0%, ${X.ink} 72%)`, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: L.landscape ? 30 : 40, marginTop: L.tall ? -160 : 0, textAlign: "center", padding: `0 ${L.padX}px` }}>
        {/* The lockup PNG has its own navy ground; "lighten" lets only the light marks through. */}
        <Img src={staticFile("brand/fog-lockup.png")} style={{ width: lockW, mixBlendMode: "lighten", opacity: a(0), transform: `scale(${0.96 + 0.04 * a(0)})` }} />
        <div style={{ width: 120 * a(12), height: 2, background: X.gold }} />
        <div style={{ fontFamily: serif, fontWeight: T.head, fontSize: (L.landscape ? 66 : 74) * T.headScale, lineHeight: 1.08, color: X.ivory, opacity: a(16), transform: `translateY(${(1 - a(16)) * 20}px)`, textWrap: "balance" }}>
          {scene.headline}
        </div>
        <div style={{ display: "flex", flexDirection: L.landscape ? "row" : "column", gap: L.landscape ? 48 : 14, alignItems: "center", marginTop: 6 }}>
          {(scene.lines ?? []).map((t, i) => (
            <div key={t} style={{ fontFamily: body, fontWeight: i === 0 ? 700 : T.body, fontSize: (L.landscape ? 32 : 38) + (T === STYLES.bold ? 4 : 0), letterSpacing: "1px", color: i === 0 ? X.goldSoft : T.lineColor, opacity: a(30 + i * 8) }}>
              {t}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: L.tall ? L.H * 0.2 : 70, left: L.padX, right: L.padX, textAlign: "center", fontFamily: body, fontWeight: 500, fontSize: 24, letterSpacing: "4px", textTransform: "uppercase", color: "#f3eee480", opacity: a(50) }}>
        Ibadan · Working across Nigeria
        {credits ? <div style={{ marginTop: 14, fontSize: 17, letterSpacing: "0.5px", textTransform: "none", color: "#f3eee455" }}>{credits}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Brand mark and chapter counter; fades out before the closing card. */
const Chrome: React.FC<{ count: number; frames: { from: number }[]; hideFrom: number; example: boolean }> = ({ count, frames, hideFrom, example }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const T = useTS();
  const o = interpolate(frame, [0, 14, hideFrom, hideFrom + XF], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let idx = 0;
  frames.forEach((f, i) => {
    if (frame >= f.from + XF / 2) idx = i;
  });
  return (
    <div style={{ position: "absolute", top: L.top, left: L.padX, right: L.padX, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: o }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 54, height: 54, background: X.ivory, borderRadius: 10, display: "grid", placeItems: "center" }}>
          <Img src={staticFile("brand/fog-icon.png")} style={{ width: 46 }} />
        </div>
        <div style={{ fontFamily: body, fontWeight: T === STYLES.bold ? 700 : 600, fontSize: T === STYLES.bold ? 25 : 22, letterSpacing: "5px", color: X.ivory, textTransform: "uppercase", textShadow: T.shadow }}>FOG Technologies Nexus</div>
      </div>
      <div style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 300, fontSize: T === STYLES.bold ? 32 : 28, color: T === STYLES.bold ? X.goldSoft : X.gold, textShadow: T.shadow }}>
        {String(idx + 1).padStart(2, "0")} <span style={{ color: T === STYLES.bold ? "#f3eee4aa" : "#f3eee466" }}>/ {String(count - 1).padStart(2, "0")}</span>
        {example ? (
          <div style={{ marginTop: 10, fontFamily: body, fontStyle: "normal", fontWeight: 700, fontSize: 20, letterSpacing: "4px", color: X.ink, background: X.goldSoft, padding: "4px 12px", borderRadius: 4, textAlign: "center" }}>
            EXAMPLE
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Split narration into subtitle lines: one sentence at a time, and a long
 * sentence into evenly sized parts (at most ~10 words each) that prefer to
 * break after a comma, so no line ends mid-phrase or strands a word or two.
 */
function subtitleChunks(words: Word[]): Word[][] {
  const sentences: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.?!]$/.test(w.text)) {
      sentences.push(cur);
      cur = [];
    }
  }
  if (cur.length) sentences.push(cur);

  const out: Word[][] = [];
  for (const sen of sentences) {
    const parts = Math.ceil(sen.length / 10);
    let start = 0;
    for (let p = parts; p > 1; p--) {
      const ideal = start + Math.round((sen.length - start) / p);
      // Prefer a comma within two words of the even split point.
      let cut = ideal;
      for (const d of [0, 1, -1, 2, -2]) {
        const i = ideal + d;
        if (i - start >= 3 && sen.length - i >= 3 && /,$/.test(sen[i - 1].text)) {
          cut = i;
          break;
        }
      }
      out.push(sen.slice(start, cut));
      start = cut;
    }
    out.push(sen.slice(start));
  }
  return out;
}

/** Sentence subtitles in short chunks (at most ~9 words), for viewers with the sound off. */
const Subtitles: React.FC<{ words: Word[]; hideFrom: number }> = ({ words, hideFrom }) => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const T = useTS();
  const t = frame / FPS;
  if (!words.length || t >= hideFrom) return null;

  const chunks = subtitleChunks(words);
  const c = chunks.find((g, i) => t >= g[0].start - 0.08 && t < (chunks[i + 1]?.[0].start ?? g[g.length - 1].end + 0.6) - 0.08 && t <= g[g.length - 1].end + 0.6);
  if (!c) return null;
  const text = c.map((w) => w.text).join(" ");
  return (
    <div style={{ position: "absolute", top: L.subY, left: L.padX, right: L.padX, display: "flex", justifyContent: "center" }}>
      <div style={{ fontFamily: body, fontWeight: T.subW, fontSize: L.landscape ? T.sub - 2 : T.sub, lineHeight: 1.3, color: X.ivory, background: T.subBg, padding: "12px 26px", borderRadius: 6, textAlign: "center", maxWidth: L.landscape ? L.W * 0.7 : undefined }}>
        {text}
      </div>
    </div>
  );
};

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <div style={{ position: "absolute", bottom: 0, left: 0, height: 4, width: `${(frame / durationInFrames) * 100}%`, background: X.gold, opacity: 0.8 }} />;
};
