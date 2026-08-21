"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./PatientOnboarding.module.css";

type Step = {
  title: string;
  description: string;
  targetId?: string;
};

type PatientOnboardingProps = {
  isOpen: boolean;
  onClose: () => void;
  steps: Step[];
};

const ONBOARDING_KEY = "patientOnboardingCompleted";

function PatientOnboarding({ isOpen, onClose, steps }: PatientOnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  const currentStep = steps[stepIndex];

  const cardStyle = useMemo<CSSProperties>(() => {
    if (!targetRect || typeof window === "undefined") {
      return {};
    }

    const cardWidth = 360;
    let cardLeft = targetRect.right + 20;

    if (cardLeft + cardWidth > window.innerWidth - 20) {
      cardLeft = Math.max(20, targetRect.left - cardWidth - 20);
    }

    return {
      position: "fixed",
      top: Math.max(targetRect.top - 20, 24),
      left: cardLeft,
      width: cardWidth,
    };
  }, [targetRect]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let frameId = 0;

    const updateRect = () => {
      window.cancelAnimationFrame(frameId);

      frameId = window.requestAnimationFrame(() => {
        const step = steps[stepIndex];

        if (!step?.targetId) {
          setTargetRect(null);
          return;
        }

        const element = document.getElementById(step.targetId);

        if (!element) {
          setTargetRect(null);
          return;
        }

        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });

        setTargetRect(element.getBoundingClientRect());
      });
    };

    updateRect();

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("navbarToggle", updateRect as EventListener);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect as EventListener);
      window.removeEventListener("navbarToggle", updateRect as EventListener);
    };
  }, [isOpen, stepIndex, steps]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setTargetRect(null);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
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

  useEffect(() => {
    const el = document.createElement("div");

    el.setAttribute("id", "patient-onboarding-portal");
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

    const timer = window.setTimeout(() => {
      setPortalEl(el);
    }, 0);

    return () => {
      window.clearTimeout(timer);

      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  if (!isOpen || !currentStep) {
    return null;
  }

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

  const portalContent = (
    <>
      {targetRect && (
        <div
          className={styles.onboardingHighlight}
          style={{
            position: "fixed",
            zIndex: 2147483648,
            top: targetRect.top - 8,
            left: Math.max(targetRect.left - 8, 8),
            width: Math.min(
              targetRect.width + 16,
              Math.max(48, window.innerWidth - Math.max(targetRect.left - 8, 8) - 20)
            ),
            height: targetRect.height + 16,
          }}
        />
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
            <h2>{currentStep.title}</h2>
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

        <p className={styles.onboardingDescription}>
          {currentStep.description}
        </p>

        <div className={styles.onboardingProgress}>
          {steps.map((_, index) => (
            <span
              key={index}
              className={`${styles.onboardingDot} ${
                index <= stepIndex ? styles.onboardingDotActive : ""
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

export default PatientOnboarding;