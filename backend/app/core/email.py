import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
BACKEND_VERIFY_URL = os.getenv(
    "BACKEND_VERIFY_URL",
    "http://127.0.0.1:8000/auth/verify-email"
)
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://127.0.0.1:3000"
)


def send_email(to_email: str, subject: str, html_content: str):
    if not EMAIL_USER or not EMAIL_PASS:
        raise ValueError("EMAIL_USER or EMAIL_PASS is not set in .env")

    msg = MIMEText(html_content, "html")
    msg["Subject"] = subject
    msg["From"] = EMAIL_USER
    msg["To"] = to_email

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_USER, EMAIL_PASS)
        server.send_message(msg)


def send_verification_email(email: str, token: str):
    verify_link = f"{BACKEND_VERIFY_URL}?token={token}"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to OurSkin</h2>
        <p>Thank you for registering.</p>
        <p>Please confirm your email by clicking the button below:</p>
        <p>
            <a href="{verify_link}"
               style="display:inline-block;padding:10px 16px;background:#82334c;color:#ffffff;text-decoration:none;border-radius:6px;">
               Verify Email
            </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>{verify_link}</p>
    </div>
    """

    send_email(email, "Verify your OurSkin account", html_content)


def send_password_reset_email(email: str, token: str):
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset Your OurSkin Password</h2>
        <p>We received a request to reset your password.</p>
        <p>Click the button below to create a new password:</p>
        <p>
            <a href="{reset_link}"
               style="display:inline-block;padding:10px 16px;background:#82334c;color:#ffffff;text-decoration:none;border-radius:6px;">
               Reset Password
            </a>
        </p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>{reset_link}</p>
    </div>
    """

    send_email(email, "Reset your OurSkin password", html_content)