# Guide video

The sharing destination is https://torbay-drainage-guide-liam.heardwf.chatgpt.site/how-to-use/.

The main page plays the clean 450-second walkthrough. Its 97-cue English WebVTT track starts OFF and can be switched on in the native player. The optional captioned download is the same visual edit with captions permanently visible for meetings. Both copies retain the accepted audio.

## Source and assets

Editable production files are controlled in `../video/revision-4` from the Site folder. All 12 measured chapter starts and the exact narration transcript are retained in `assets/video/how-to-use.json`; the media revision changes when the picture is replaced to prevent an old cached copy being played.

- `how-to-use.mp4`: primary 1920×1080/30 fps H.264/AAC movie, 13,500 picture frames, 450 seconds.
- `how-to-use-captioned.mp4`: matching optional meeting download.
- `how-to-use.vtt`: original English captions, unchanged.
- `how-to-use.jpg`: poster from the current encoded movie.
- `how-to-use.json`: guide edition 5.1, original recording date 2 October 2026, chapters/transcript and current main page URL.

The visual rebuild uses current desktop captures and one fictional assessment. Capture and source evidence are in the controlled production folder. Preserve originals and publish only the main guide page for this release.

## Build and checks

Run `node tools/build-assisted.mjs` from this Site checkout. The build copies the assets into `dist/client/assets/video` and generates the video page. Set `TORBAY_VIDEO_SOURCE` to the absolute `video/revision-4` folder and run `python -B tools/test-guide-video.py` for static integration checks.

After replacing media, verify full decode, original AAC/PCM identity, picture frame count/duration, captions, normal-speed playback, chapter seeks and the published player. Keep each individual MP4 below 25 MiB. The browser uses local Blob playback to support chapter seeking where the host does not honour Range requests. No external player is required.

Publication follows the specifically authorised main-guide Sites workflow. The standalone video website is outside this release.
