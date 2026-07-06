import { useRef, useEffect, useState } from "react";

/**
 * TransitionPlayer
 *
 * Plays a pre-loaded transition video (forward or backward) and calls
 * onComplete when the video ends.
 *
 * For "backward" playMode, the server has pre-generated a reversed video file
 * (reverseVideoUrl). The correct URL is already passed via `videoUrl` from useTour.
 *
 * The `onPlaying` callback fires the moment the video begins rendering its first
 * frame — this is when hotspots are confirmed hidden.
 *
 * @param {{
 *   videoUrl: string,
 *   onComplete: function,
 *   onPlaying?: function
 * }} props
 */
export default function TransitionPlayer({ videoUrl, onComplete, onPlaying }) {
  const videoRef = useRef(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    let mounted = true;

    video.src = videoUrl;
    video.load();

    const handlePlaying = () => {
      if (!mounted) return;
      setOpacity(1);
      onPlaying?.();
    };

    const handleEnded = () => {
      if (!mounted) return;
      // Fade out before calling onComplete
      setOpacity(0);
      // setTimeout(() => {
      if (mounted) onComplete();
      // }, 300);
    };

    const handleError = () => {
      if (!mounted) return;
      console.error("Transition video failed to load:", videoUrl);
      onComplete(); // Gracefully skip broken transition
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    // Auto-play; ignore AbortError caused by cleanup unmount (React StrictMode)
    video.play().catch((err) => {
      if (!mounted) return;
      if (err.name !== "AbortError") {
        console.error("Transition video play rejected:", err);
        onComplete();
      }
    });

    return () => {
      mounted = false;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.pause();
      video.src = "";
    };
  }, [videoUrl, onComplete, onPlaying]);

  return (
    <div
      className="absolute inset-0 z-50 bg-black"
      style={{
        opacity,
        transition: "opacity 300ms ease",
      }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="auto"
      />
    </div>
  );
}
