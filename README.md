# FOG Adverts renderer

Produces FOG Technologies Nexus video adverts: a scripted advert from FOG Nexus
becomes a narrated, subtitled video in 4:5, 9:16 and 16:9.

- `voice/`: narration with Chatterbox (MIT) from a Nigerian-English reference
  voice, scored per sentence with faster-whisper; flagged sentences are
  re-voiced automatically. Music beds are generated (`make_bed*.py`).
- `renderer/`: Remotion compositions. `Executive.tsx` is the board-level style
  (serif headlines, ivory and gold, subtitles for sound-off viewing).
- `worker/`: the render worker that claims jobs from FOG Nexus, renders them and
  uploads the files. See `worker/README.md`.
- `samples/`: hand-written advert specs.

Rendering runs offline once the models are downloaded; only claiming jobs and
uploading results need the internet.

Image credits: `renderer/public/media/CREDITS.md` and
`renderer/public/media/exec/CREDITS.md`. Fonts: SIL Open Font License
(`renderer/public/fonts/`). Brand marks © FOG Technologies Nexus.
