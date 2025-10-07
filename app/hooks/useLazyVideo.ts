import { useEffect, useRef, useState } from 'react';

export function useLazyVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            // Once loaded, we can stop observing
            observer.unobserve(video);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading slightly before video enters viewport
        threshold: 0.1,
      }
    );

    observer.observe(video);

    return () => {
      if (video) {
        observer.unobserve(video);
      }
    };
  }, []);

  return { videoRef, shouldLoad };
}
