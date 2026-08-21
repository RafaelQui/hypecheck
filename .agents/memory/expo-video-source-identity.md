---
name: Expo video source identity
description: Preventing active Expo Video playback from resetting during React renders.
---

Pass a stable URL string to `useVideoPlayer`, or memoize an object source before passing it to the hook.

**Why:** Recreating a `{ uri, contentType }` source object while playback state updates can cause the native player to be recreated and immediately stop the video.

**How to apply:** For review media and other interactive players, prefer a stable string source when possible. If custom source options are necessary, wrap the source object in `useMemo` with the URL as its dependency.