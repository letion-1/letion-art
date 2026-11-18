"use client";

import { useEffect, useRef, useState } from "react";

const videos = [
  "/video/teaser-01.mp4",
  "/video/teaser-02.mp4",
];

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideo, setCurrentVideo] = useState(0);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.src = videos[currentVideo];
    video.load();

    const playVideo = async () => {
      try {
        await video.play();
      } catch {
        // Browser may block autoplay until interaction.
      }
    };

    playVideo();
  }, [currentVideo]);

  const handleEnded = () => {
    setCurrentVideo((current) => (current + 1) % videos.length);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="metadata"
        poster="/about/about-hero.jpg"
        onEnded={handleEnded}
        className="h-full w-full object-cover"
      />

      {/* Dark veil for readable typography */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Slight cinematic fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
    </div>
  );
}