"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "@/app/styles/landing.module.css";

const aboutImages = [
  "/clinic1.jpg",
  "/clinic2.jpg",
  "/clinic3.jpg",
  "/clinic4.jpg",
  "/clinic5.jpg",
  "/clinic6.jpg",
  "/clinic7.jpg",
  "/clinic8.jpg",
];

export default function AboutCarousel() {
  const [currentImage, setCurrentImage] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ SIMPLE + STABLE AUTO SLIDE (no dependency issues)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentImage((prev) =>
        prev === aboutImages.length - 1 ? 0 : prev + 1
      );
    }, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // ✅ SWIPE (mobile)
  const [startX, setStartX] = useState<number | null>(null);
  const [endX, setEndX] = useState<number | null>(null);

  const minSwipe = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setEndX(null);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setEndX(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    if (startX === null || endX === null) return;

    const diff = startX - endX;

    if (diff > minSwipe) {
      // swipe left
      setCurrentImage((prev) =>
        prev === aboutImages.length - 1 ? 0 : prev + 1
      );
    } else if (diff < -minSwipe) {
      // swipe right
      setCurrentImage((prev) =>
        prev === 0 ? aboutImages.length - 1 : prev - 1
      );
    }

    // reset
    setStartX(null);
    setEndX(null);
  };

  return (
    <div
      className={styles.osAboutCarousel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {aboutImages.map((img, index) => (
        <div
          key={index}
          className={`${styles.osSlide} ${
            index === currentImage ? styles.active : ""
          }`}
        >
          <Image
            src={img}
            alt={`clinic ${index}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
            priority={index === 0}
          />
        </div>
      ))}

      {/* DOT NAVIGATION */}
      <div className={styles.osCarouselDots}>
        {aboutImages.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentImage(index)}
            className={`${styles.dot} ${
              index === currentImage ? styles.dotActive : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}