# FOG Adverts render worker

Turns scripted adverts in FOG Nexus into finished videos: voice (Chatterbox,
Nigerian-English reference voice), executive-style render in 4:5, 9:16 and
16:9, upload, done. Rendering runs fully offline; only claiming a job and
uploading the result need the internet.

## 1. Register the worker (once, in FOG Nexus)

Platform → Workers → register a worker, tick **Advert rendering**, and copy the
token it shows (shown once). Save it on the machine that will render:

    mkdir -p ~/.config/fog-adverts
    printf 'FOG_NEXUS_URL=https://fogtechnexus.space\nFOG_WORKER_TOKEN=fogw_…\n' > ~/.config/fog-adverts/worker.env
    chmod 600 ~/.config/fog-adverts/worker.env

## 2a. On this PC (renders while it is switched on)

    ./worker/install.sh        # systemd user timer: one job every 15 minutes, never two at once

Check it: `systemctl --user list-timers fog-advert-worker.timer`, logs:
`journalctl --user -u fog-advert-worker -n 50`.

## 2b. In the cloud (renders when the PC is off)

The workflow `.github/workflows/advert-render.yml` runs in the fog-adverts repository;
add the worker token as repository secret `FOG_WORKER_TOKEN`.
It checks every 30 minutes and only installs and renders when an advert is
waiting. Free and unlimited on a public repository; ~20 adverts a month on a
private one (2,000 free minutes).

Both can run at the same time: FOG Nexus hands each advert to one worker only,
and a worker that disappears mid-render loses its claim after 4 hours.

## Timing

Adverts are claimed up to 72 hours before their slot, so a worker that is on
for a few hours a day keeps up. One advert takes about an hour on a 4-core
machine (voice ~30–45 min, three renders ~15 min). If no worker ran in time, an
advert can still render and post up to 12 hours late; after that it is marked
missed and the owner is told.

## Photos

The worker picks each scene's photo from `renderer/public/media/library.json`
by matching the script's photo subject against tags. Add sector photos there
(with their credit in `renderer/public/media/exec/CREDITS.md`) to widen
coverage; scenes with no good match use the graphic background.

## Test locally without FOG Nexus

    python3 worker/worker.py --spec some-job.json
