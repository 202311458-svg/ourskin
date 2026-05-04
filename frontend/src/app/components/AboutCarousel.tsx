"use client";

import { useEffect, useState } from "react";
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

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImage((prev) =>
                prev === aboutImages.length - 1 ? 0 : prev + 1
            );
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    const [startX, setStartX] = useState<number | null>(null);
    const [endX, setEndX] = useState<number | null>(null);

    const minSwipe = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setEndX(e.touches[0].clientX);
    };

    const onTouchEnd = () => {
        if (startX === null || endX === null) return;

        const diff = startX - endX;

        if (diff > minSwipe) {
            setCurrentImage((prev) =>
                prev === aboutImages.length - 1 ? 0 : prev + 1
            );
        }

        if (diff < -minSwipe) {
            setCurrentImage((prev) =>
                prev === 0 ? aboutImages.length - 1 : prev - 1
            );
        }
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
                    className={`${styles.osSlide} ${index === currentImage ? styles.active : ""
                        }`}
                >
                    <Image
                        src={img}
                        alt={`clinic ${index}`}
                        fill
                        style={{ objectFit: "cover" }}
                    />
                </div>
            ))}

            <div className={styles.osCarouselDots}>
                {aboutImages.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentImage(index)}
                        className={`${styles.dot} ${index === currentImage ? styles.dotActive : ""
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}