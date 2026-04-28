"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type VerifyStatus = "loading" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasVerifiedRef = useRef(false);

  const token = searchParams.get("token");

  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [message, setMessage] = useState("We’re verifying your email now. Please wait a moment.");

  useEffect(() => {
    if (hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;

    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setMessage("This verification link is incomplete or missing the required token.");
        return;
      }

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://127.0.0.1:8000";

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              "We couldn’t verify your email. The link may already be used or expired."
          );
        }

        setStatus("success");
        setMessage(
          data?.message ||
            "Your email has been verified successfully. You can now log in to your account."
        );
} catch (error: unknown) {
  setStatus("error");
  setMessage(
    error instanceof Error
      ? error.message
      : "Something went wrong while verifying your email. Please try again."
  );
}
    };

    verifyEmail();
  }, [token]);

  const goHome = () => {
    router.push("/");
  };

  return (
    <main className="verifyPage">
      <div className="backgroundGlow backgroundGlowOne" />
      <div className="backgroundGlow backgroundGlowTwo" />

      <section className="verifyCard">
        <div className="brandBlock">
          <div className="brandBadge">OurSkin</div>
          <p className="brandSubtext">Dermatology Center</p>
        </div>

        {status === "loading" && (
          <>
            <div className="spinner" />
            <h1 className="title">Verifying your account</h1>
            <p className="message">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="statusIcon successIcon">✓</div>
            <h1 className="title">Email verified</h1>
            <p className="message">{message}</p>

            <div className="buttonRow">
              <button type="button" className="primaryButton" onClick={goHome}>
                Go to Home
              </button>
            </div>

            <p className="helperText">
              Return to the homepage and log in using your verified account.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="statusIcon errorIcon">!</div>
            <h1 className="title">Verification failed</h1>
            <p className="message">{message}</p>

            <div className="buttonRow">
              <button type="button" className="primaryButton" onClick={goHome}>
                Back to Home
              </button>
            </div>

            <p className="helperText">
              You can request a new verification email from the login or registration flow.
            </p>
          </>
        )}
      </section>

      <style jsx>{`
        .verifyPage {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(255, 214, 228, 0.55), transparent 30%),
            radial-gradient(circle at bottom right, rgba(255, 233, 240, 0.7), transparent 35%),
            linear-gradient(135deg, #fff8fb 0%, #fdf2f6 45%, #f9edf3 100%);
        }

        .backgroundGlow {
          position: absolute;
          border-radius: 999px;
          filter: blur(20px);
          opacity: 0.5;
          pointer-events: none;
        }

        .backgroundGlowOne {
          width: 280px;
          height: 280px;
          top: 8%;
          left: 8%;
          background: rgba(130, 51, 76, 0.08);
        }

        .backgroundGlowTwo {
          width: 340px;
          height: 340px;
          right: 4%;
          bottom: 5%;
          background: rgba(255, 182, 193, 0.18);
        }

        .verifyCard {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 540px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(130, 51, 76, 0.1);
          border-radius: 28px;
          padding: 42px 32px;
          text-align: center;
          box-shadow: 0 22px 60px rgba(130, 51, 76, 0.14);
        }

        .brandBlock {
          margin-bottom: 24px;
        }

        .brandBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 120px;
          padding: 10px 18px;
          border-radius: 999px;
          background: rgba(130, 51, 76, 0.1);
          color: #82334c;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 0.3px;
        }

        .brandSubtext {
          margin: 10px 0 0;
          font-size: 0.95rem;
          color: #8c6775;
        }

        .title {
          margin: 0 0 14px;
          font-size: 2rem;
          font-weight: 800;
          color: #2c1a22;
          letter-spacing: -0.02em;
        }

        .message {
          margin: 0 auto;
          max-width: 420px;
          font-size: 1rem;
          line-height: 1.75;
          color: #6d5760;
        }

        .helperText {
          margin: 18px 0 0;
          font-size: 0.92rem;
          line-height: 1.7;
          color: #917783;
        }

        .buttonRow {
          margin-top: 28px;
        }

        .primaryButton {
          border: none;
          outline: none;
          cursor: pointer;
          background: linear-gradient(135deg, #82334c 0%, #9b3e5b 100%);
          color: #ffffff;
          padding: 14px 24px;
          border-radius: 14px;
          font-size: 0.98rem;
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(130, 51, 76, 0.22);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            opacity 0.18s ease;
        }

        .primaryButton:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(130, 51, 76, 0.28);
        }

        .primaryButton:active {
          transform: translateY(0);
          opacity: 0.96;
        }

        .statusIcon {
          width: 82px;
          height: 82px;
          margin: 0 auto 20px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 800;
        }

        .successIcon {
          background: #eaf9f0;
          color: #1f9d57;
          box-shadow: inset 0 0 0 1px rgba(31, 157, 87, 0.12);
        }

        .errorIcon {
          background: #fdeeee;
          color: #d93025;
          box-shadow: inset 0 0 0 1px rgba(217, 48, 37, 0.12);
        }

        .spinner {
          width: 64px;
          height: 64px;
          margin: 0 auto 22px;
          border-radius: 999px;
          border: 5px solid #f4d9e3;
          border-top: 5px solid #82334c;
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .verifyCard {
            padding: 34px 22px;
            border-radius: 22px;
          }

          .title {
            font-size: 1.7rem;
          }

          .message {
            font-size: 0.96rem;
          }

          .statusIcon {
            width: 74px;
            height: 74px;
            font-size: 1.8rem;
          }
        }
      `}</style>
    </main>
  );
}

function VerifyEmailFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "linear-gradient(135deg, #fff8fb 0%, #fdf2f6 45%, #f9edf3 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          background: "rgba(255, 255, 255, 0.92)",
          border: "1px solid rgba(130, 51, 76, 0.1)",
          borderRadius: "28px",
          padding: "42px 32px",
          textAlign: "center",
          boxShadow: "0 22px 60px rgba(130, 51, 76, 0.14)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 22px",
            borderRadius: "999px",
            border: "5px solid #f4d9e3",
            borderTop: "5px solid #82334c",
          }}
        />
        <h1
          style={{
            margin: "0 0 14px",
            fontSize: "2rem",
            fontWeight: 800,
            color: "#2c1a22",
          }}
        >
          Loading verification page
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            lineHeight: 1.75,
            color: "#6d5760",
          }}
        >
          Please wait while we prepare your verification status.
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}