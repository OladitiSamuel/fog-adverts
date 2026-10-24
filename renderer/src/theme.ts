import { continueRender, delayRender, staticFile } from "remotion";

// Brand palette sampled from the FOG lockup: deep navy ground, electric-blue bars, silver cloud.
export const C = {
  navy: "#0a1424",
  navy2: "#10203a",
  blue: "#2f7be8",
  blueLight: "#5aa2ff",
  silver: "#c3c8d0",
  white: "#ffffff",
  rec: "#ff3b30",
};

// Fonts ship with the renderer (public/fonts, SIL OFL) so renders never depend on the network.
const faces: [string, string, string][] = [
  ["Barlow Condensed", "BarlowCondensed-SemiBold.ttf", "600"],
  ["Barlow Condensed", "BarlowCondensed-Bold.ttf", "700"],
  ["Barlow Condensed", "BarlowCondensed-ExtraBold.ttf", "800"],
  ["Barlow", "Barlow-Medium.ttf", "500"],
  ["Barlow", "Barlow-SemiBold.ttf", "600"],
  ["Barlow", "Barlow-Bold.ttf", "700"],
  ["Noto Serif Display", "NotoSerifDisplay-Light.ttf", "300"],
  ["Noto Serif Display", "NotoSerifDisplay-Regular.ttf", "400"],
  ["Noto Serif Display", "NotoSerifDisplay-Medium.ttf", "500"],
  ["Noto Serif Display", "NotoSerifDisplay-SemiBold.ttf", "600"],
];
const italics: [string, string, string][] = [["Noto Serif Display", "NotoSerifDisplay-LightItalic.ttf", "300"]];
if (typeof document !== "undefined") {
  const handle = delayRender("Loading bundled fonts");
  const load = async ([family, file, weight]: [string, string, string], style: string) => {
    const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("truetype")`, { weight, style });
    document.fonts.add(await face.load());
  };
  Promise.all([...faces.map((f) => load(f, "normal")), ...italics.map((f) => load(f, "italic"))]).then(() => continueRender(handle), (err) => { console.error(err); continueRender(handle); });
}

export const display = "'Barlow Condensed', 'Arial Narrow', sans-serif";
export const body = "Barlow, Arial, sans-serif";
export const serif = "'Noto Serif Display', Georgia, serif";

// Executive style: ink ground, ivory type, a champagne-gold accent used sparingly.
export const X = {
  ink: "#07101d",
  navy: "#0b1a2e",
  ivory: "#f3eee4",
  ivoryDim: "#f3eee4b3",
  gold: "#c8a46a",
  goldSoft: "#e2c99a",
  rule: "#f3eee426",
};

export const FPS = 30;
export const W = 1080;
export const H = 1920;
