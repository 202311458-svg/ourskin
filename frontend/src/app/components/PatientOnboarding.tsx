"use client";

import { CSSProperties, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/app/styles/patient.module.css";

type Step = {
    title: string;
    description: string;
    targetId?: string;
};

const ONBOARDING_KEY = "patientOnboardingCompleted";

export default function PatientOnboarding({
    isOpen,
    onClose,
    steps,
}: {
    isOpen: boolean;
    onClose: () => void;
    steps: Step[];
}) {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
    const [cardStyle, setCardStyle] = useState<CSSProperties>({});

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const updateRect = () => {
            const step = steps[stepIndex];
            if (!step || !step.targetId) {
                setTargetRect(null);
                setTooltipStyle({});
                return;
            }

            const element = document.getElementById(step.targetId);
            if (!element) {
                setTargetRect(null);
                setTooltipStyle({});
                return;
            }

            element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);
        };

        // initial calc
        updateRect();

        // update on viewport changes and navbar toggle
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, { passive: true });
        window.addEventListener("navbarToggle", updateRect as EventListener);

        return () => {
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect as EventListener);
            window.removeEventListener("navbarToggle", updateRect as EventListener);
        };
    }, [isOpen, stepIndex, steps]);

    useEffect(() => {
        if (!targetRect) {
            return;
        }

        const tooltipWidth = 380;
        const margin = 20;
        const left = Math.min(
            Math.max(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, margin),
            window.innerWidth - tooltipWidth - margin
        );
        const top = Math.max(targetRect.top - 180, margin);

        setTooltipStyle({ left, top, width: tooltipWidth });

        const cardWidth = 360;
        let cardLeft = targetRect.right + 20;
        if (cardLeft + cardWidth > window.innerWidth - 20) {
            cardLeft = Math.max(20, targetRect.left - cardWidth - 20);
        }

        setCardStyle({
            position: "fixed",
            top: Math.max(targetRect.top - 20, 24),
            left: cardLeft,
            width: cardWidth,
        });
    }, [targetRect]);

    useEffect(() => {
        if (!isOpen) {
            setStepIndex(0);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        document.body.classList.add("patientOnboardingActive");

        return () => {
            document.body.classList.remove("patientOnboardingActive");
        };
    }, [isOpen]);

    // create portal root
    const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const el = document.createElement("div");
        el.setAttribute("id", "patient-onboarding-portal");
        // ensure portal root sits above all UI (fixed full-screen, very high z-index)
        el.style.setProperty("position", "fixed", "important");
        el.style.setProperty("inset", "0", "important");
        el.style.setProperty("top", "0", "important");
        el.style.setProperty("left", "0", "important");
        el.style.setProperty("width", "100%", "important");
        el.style.setProperty("height", "100%", "important");
        el.style.setProperty("pointer-events", "none", "important");
        el.style.setProperty("z-index", "2147483647", "important");
        el.style.setProperty("overflow", "visible", "important");
        const parent = document.documentElement || document.body;
        parent.appendChild(el);
        setPortalEl(el);
        return () => {
            if (el.parentNode) el.parentNode.removeChild(el);
            setPortalEl(null);
        };
    }, []);

    if (!isOpen) {
        return null;
    }

    const step = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            localStorage.setItem(ONBOARDING_KEY, "true");
            onClose();
            return;
        }
        setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    };

    const handleBack = () => {
        setStepIndex((current) => Math.max(current - 1, 0));
    };

    const handleSkip = () => {
        localStorage.setItem(ONBOARDING_KEY, "true");
        onClose();
    };

    // tooltip text removed per user request (no 'this button' comment)

    const portalContent = (
        <>
            {targetRect && (
                <>
                    {(() => {
                        // Position highlight to overlay the target button. Fixed coordinates use viewport-relative rect values.
                        const initialLeftViewport = targetRect.left - 8;
                        const computedWidth = targetRect.width + 16;
                        const margin = 8;
                        const maxLeftViewport = Math.max(margin, window.innerWidth - computedWidth - 20);
                        const clampedLeftViewport = Math.min(Math.max(initialLeftViewport, margin), maxLeftViewport);
                        const left = clampedLeftViewport;

                        const top = targetRect.top - 8;
                        const width = Math.min(computedWidth, Math.max(48, window.innerWidth - clampedLeftViewport - 20));

                        return (
                            <div
                                className={styles.onboardingHighlight}
                                style={{
                                    position: "fixed",
                                    zIndex: 2147483648,
                                    top,
                                    left,
                                    width,
                                    height: targetRect.height + 16,
                                }}
                            />
                        );
                    })()}
                </>
            )}
        </>
    );

    return (
        <div className={styles.onboardingOverlay} role="dialog" aria-modal="true">
            {portalEl && createPortal(portalContent, portalEl)}

            <div className={styles.onboardingCard} style={cardStyle}>
                <div className={styles.onboardingHeader}>
                    <div>
                        <p className={styles.eyebrow}>Patient Tutorial</p>
                        <h2>{step.title}</h2>
                    </div>
                    <button
                        type="button"
                        className={styles.onboardingClose}
                        onClick={handleSkip}
                        aria-label="Close tutorial"
                    >
                        ×
                    </button>
                </div>

                <p className={styles.onboardingDescription}>{step.description}</p>

                <div className={styles.onboardingProgress}>
                    {steps.map((_, index) => (
                        <span
                            key={index}
                            className={`${styles.onboardingDot} ${index <= stepIndex ? styles.onboardingDotActive : ""
                                }`}
                        />
                    ))}
                </div>

                <div className={styles.onboardingActions}>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleBack}
                        disabled={stepIndex === 0}
                    >
                        Back
                    </button>

                    <div className={styles.onboardingActionGroup}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleSkip}
                        >
                            Skip Tutorial
                        </button>
                        <button
                            type="button"
                            className={`${styles.primaryButton} ${styles.onboardingPrimary}`}
                            onClick={handleNext}
                        >
                            {isLastStep ? "Finish" : "Next"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
