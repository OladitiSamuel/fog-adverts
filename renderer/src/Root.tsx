import { Composition, staticFile } from "remotion";
import { Advert } from "./Advert";
import { Executive } from "./Executive";
import { FPS, H, W } from "./theme";
import type { AdvertProps } from "./types";

/** Seconds the closing card holds after the last word, so the CTA stays readable. */
export const TAIL_SECONDS = 2.2;
/** Executive adverts hold the closing card longer: it carries the contacts and image credits. */
export const EXEC_TAIL_SECONDS = 3.8;

const placeholder: AdvertProps = {
  id: "preview",
  division: "FOG Security",
  service: "CCTV Installation",
  scenes: [{ kind: "cta", headline: "Book a site assessment", lines: ["fogtechnexus.space"], voice: "" }],
  voice: { audio: "", duration: 3, scenes: [{ start: 0, end: 3 }], words: [] },
};

const metadata = (tail: number) => ({ props }: { props: AdvertProps }) => ({
  durationInFrames: Math.ceil((props.voice.duration + tail) * FPS),
  props: { ...props, voice: { ...props.voice, audio: props.voice.audio ? staticFile(props.voice.audio) : "" } },
});

// Executive formats: 4:5 for LinkedIn/Facebook/Instagram feeds, 9:16 for Shorts/Reels/TikTok, 16:9 for YouTube.
const EXEC_SIZES = [
  { id: "Exec-4x5", width: 1080, height: 1350 },
  { id: "Exec-9x16", width: 1080, height: 1920 },
  { id: "Exec-16x9", width: 1920, height: 1080 },
];

export const Root: React.FC = () => (
  <>
    <Composition
      id="Advert"
      component={Advert}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={FPS * 10}
      defaultProps={placeholder}
      calculateMetadata={metadata(TAIL_SECONDS)}
    />
    {EXEC_SIZES.map((s) => (
      <Composition
        key={s.id}
        id={s.id}
        component={Executive}
        width={s.width}
        height={s.height}
        fps={FPS}
        durationInFrames={FPS * 10}
        defaultProps={{ ...placeholder, style: "executive" as const }}
        calculateMetadata={metadata(EXEC_TAIL_SECONDS)}
      />
    ))}
  </>
);
