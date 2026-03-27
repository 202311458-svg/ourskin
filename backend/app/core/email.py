import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
BACKEND_VERIFY_URL = os.getenv("BACKEND_VERIFY_URL", "http://127.0.0.1:8000/auth/verify-email")


def send_verification_email(email: str, token: str):
    if not EMAIL_USER or not EMAIL_PASS:
        raise ValueError("EMAIL_USER or EMAIL_PASS is not set in .env")

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

    msg = MIMEText(html_content, "html")
    msg["Subject"] = "Verify your OurSkin account"
    msg["From"] = EMAIL_USER
    msg["To"] = email

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_USER, EMAIL_PASS)
        server.send_message(msg)