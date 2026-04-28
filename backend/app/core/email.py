import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://127.0.0.1:3000"
)

APP_NAME = "OurSkin"
BRAND_COLOR = "#82334c"
BG_COLOR = "#f8f1f4"
TEXT_COLOR = "#2f1c24"
MUTED_COLOR = "#6f5b63"
CARD_COLOR = "#ffffff"
BORDER_COLOR = "#eed9e1"


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


def build_email_template(
    title: str,
    intro: str,
    button_text: str,
    button_link: str,
    footer_note: str,
):
    return f"""


    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
    </head>
    <body style="margin:0; padding:0; background:{BG_COLOR}; font-family:Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:{BG_COLOR}; padding:40px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
              style="max-width:560px; background:{CARD_COLOR}; border:1px solid {BORDER_COLOR}; border-radius:20px; overflow:hidden;">
              
              <tr>
                <td style="background:{BRAND_COLOR}; padding:18px 24px; text-align:center;">
                  <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:0.4px;">
                    {APP_NAME}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:36px 32px 20px 32px; text-align:center;">
                  <h1 style="margin:0 0 14px 0; font-size:28px; line-height:1.25; color:{TEXT_COLOR};">
                    {title}
                  </h1>
                  <p style="margin:0; font-size:16px; line-height:1.7; color:{MUTED_COLOR};">
                    {intro}
                  </p>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:10px 32px 18px 32px;">
                  <a href="{button_link}"
                     style="
                        display:inline-block;
                        background:{BRAND_COLOR};
                        color:#ffffff;
                        text-decoration:none;
                        padding:14px 28px;
                        border-radius:10px;
                        font-size:15px;
                        font-weight:700;
                     ">
                    {button_text}
                  </a>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 12px 32px; text-align:center;">
                  <p style="margin:0; font-size:14px; line-height:1.7; color:{MUTED_COLOR};">
                    If the button does not work, copy and paste this link into your browser:
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 24px 32px; text-align:center;">
                  <a href="{button_link}"
                     style="font-size:13px; line-height:1.7; color:{BRAND_COLOR}; word-break:break-all; text-decoration:underline;">
                    {button_link}
                  </a>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 24px 28px 24px; text-align:center; border-top:1px solid {BORDER_COLOR};">
                  <p style="margin:0; font-size:12px; line-height:1.6; color:#8f7a82;">
                    {footer_note}
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


def send_verification_email(email: str, token: str):
    verify_link = f"{FRONTEND_URL.rstrip('/')}/verify-email?token={token}"

    html_content = build_email_template(
        title="Verify your email address",
        intro=(
            "Welcome to OurSkin. Please confirm your email address to activate "
            "your account and continue securely."
        ),
        button_text="Verify Email",
        button_link=verify_link,
        footer_note="This verification email was sent by OurSkin Dermatology Clinic."
    )

    send_email(email, "Verify your OurSkin account", html_content)


def send_password_reset_email(email: str, token: str):
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    html_content = build_email_template(
        title="Reset your password",
        intro=(
            "We received a request to reset your OurSkin password. "
            "Use the button below to create a new one. This link will expire in 1 hour."
        ),
        button_text="Reset Password",
        button_link=reset_link,
        footer_note=(
            "If you did not request a password reset, you can safely ignore this email."
        )
    )

    send_email(email, "Reset your OurSkin password", html_content)