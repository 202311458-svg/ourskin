import os
import httpx
from dotenv import load_dotenv

load_dotenv()

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "OurSkin")

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

BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email"


def send_email(to_email: str, subject: str, html_content: str):
    """
    Sends transactional email using Brevo API.

    Important:
    This function keeps the same name and arguments as your old Gmail SMTP function,
    which means your existing auth and appointment routes should not break.
    """

    if not BREVO_API_KEY:
        raise ValueError("BREVO_API_KEY is not set in .env or Render environment variables.")

    if not BREVO_SENDER_EMAIL:
        raise ValueError("BREVO_SENDER_EMAIL is not set in .env or Render environment variables.")

    payload = {
        "sender": {
            "name": BREVO_SENDER_NAME,
            "email": BREVO_SENDER_EMAIL,
        },
        "to": [
            {
                "email": to_email,
            }
        ],
        "subject": subject,
        "htmlContent": html_content,
    }

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    try:
        response = httpx.post(
            BREVO_SEND_EMAIL_URL,
            json=payload,
            headers=headers,
            timeout=20,
        )

        if response.status_code >= 400:
            raise RuntimeError(
                f"Brevo email failed. Status: {response.status_code}. Response: {response.text}"
            )

        return response.json()

    except httpx.RequestError as error:
        raise RuntimeError(f"Brevo request failed: {str(error)}")


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
                     style="display:inline-block; background:{BRAND_COLOR}; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:15px; font-weight:700;">
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


def build_appointment_approval_template(
    patient_name: str,
    service: str,
    doctor_name: str,
    schedule_date: str,
    schedule_time: str,
    consultation_mode: str,
    instruction: str,
):
    portal_link = f"{FRONTEND_URL.rstrip('/')}/pages/patient/history"

    safe_patient_name = patient_name or "Patient"
    safe_service = service or "Appointment"
    safe_doctor_name = doctor_name or "To be assigned by staff"
    safe_schedule_date = schedule_date or "To be scheduled"
    safe_schedule_time = schedule_time or "To be scheduled"
    safe_consultation_mode = consultation_mode or "In-Person"
    safe_instruction = instruction or "Please arrive on time and check your patient portal for the latest appointment details."

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your appointment has been approved</title>
    </head>
    <body style="margin:0; padding:0; background:{BG_COLOR}; font-family:Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:{BG_COLOR}; padding:40px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
              style="max-width:620px; background:{CARD_COLOR}; border:1px solid {BORDER_COLOR}; border-radius:20px; overflow:hidden;">

              <tr>
                <td style="background:{BRAND_COLOR}; padding:18px 24px; text-align:center;">
                  <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:0.4px;">
                    {APP_NAME}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:34px 32px 14px 32px;">
                  <h1 style="margin:0 0 12px 0; font-size:28px; line-height:1.25; color:{TEXT_COLOR}; text-align:center;">
                    Your appointment has been approved
                  </h1>

                  <p style="margin:0; font-size:16px; line-height:1.7; color:{MUTED_COLOR}; text-align:center;">
                    Hello {safe_patient_name}, your appointment request has been confirmed by the OurSkin team.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:16px 32px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="background:#fff8fb; border:1px solid {BORDER_COLOR}; border-radius:16px; padding:18px;">
                    <tr>
                      <td style="padding:8px 0; color:{MUTED_COLOR}; font-size:14px; width:38%;">Service</td>
                      <td style="padding:8px 0; color:{TEXT_COLOR}; font-size:14px; font-weight:700;">{safe_service}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0; color:{MUTED_COLOR}; font-size:14px;">Doctor</td>
                      <td style="padding:8px 0; color:{TEXT_COLOR}; font-size:14px; font-weight:700;">{safe_doctor_name}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0; color:{MUTED_COLOR}; font-size:14px;">Date</td>
                      <td style="padding:8px 0; color:{TEXT_COLOR}; font-size:14px; font-weight:700;">{safe_schedule_date}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0; color:{MUTED_COLOR}; font-size:14px;">Time</td>
                      <td style="padding:8px 0; color:{TEXT_COLOR}; font-size:14px; font-weight:700;">{safe_schedule_time}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0; color:{MUTED_COLOR}; font-size:14px;">Mode</td>
                      <td style="padding:8px 0; color:{TEXT_COLOR}; font-size:14px; font-weight:700;">{safe_consultation_mode}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:10px 32px 8px 32px;">
                  <h2 style="margin:0 0 10px 0; font-size:18px; color:{TEXT_COLOR};">
                    Patient Instructions
                  </h2>

                  <p style="margin:0; font-size:15px; line-height:1.8; color:{MUTED_COLOR}; white-space:pre-line;">
                    {safe_instruction}
                  </p>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 32px 20px 32px;">
                  <a href="{portal_link}"
                     style="display:inline-block; background:{BRAND_COLOR}; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:15px; font-weight:700;">
                    View Appointment
                  </a>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 24px 28px 24px; text-align:center; border-top:1px solid {BORDER_COLOR};">
                  <p style="margin:0; font-size:12px; line-height:1.6; color:#8f7a82;">
                    This approval notification was sent by OurSkin Dermatology Clinic. Please check your patient portal for the latest appointment details.
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


def build_appointment_decline_template(
    patient_name: str,
    service: str,
    reason: str,
):
    portal_link = f"{FRONTEND_URL.rstrip('/')}/pages/patient/history"

    safe_patient_name = patient_name or "Patient"
    safe_service = service or "Appointment"
    safe_reason = reason or "Please check your patient portal for more details."

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Appointment request update</title>
    </head>
    <body style="margin:0; padding:0; background:{BG_COLOR}; font-family:Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:{BG_COLOR}; padding:40px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
              style="max-width:620px; background:{CARD_COLOR}; border:1px solid {BORDER_COLOR}; border-radius:20px; overflow:hidden;">

              <tr>
                <td style="background:{BRAND_COLOR}; padding:18px 24px; text-align:center;">
                  <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:0.4px;">
                    {APP_NAME}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:34px 32px 14px 32px;">
                  <h1 style="margin:0 0 12px 0; font-size:28px; line-height:1.25; color:{TEXT_COLOR}; text-align:center;">
                    Appointment request update
                  </h1>

                  <p style="margin:0; font-size:16px; line-height:1.7; color:{MUTED_COLOR}; text-align:center;">
                    Hello {safe_patient_name}, we have an update regarding your appointment request.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:16px 32px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                    style="background:#fff8fb; border:1px solid {BORDER_COLOR}; border-radius:16px; padding:18px;">
                    <tr>
                      <td style="padding:8px 0; color:{MUTED_COLOR}; font-size:14px; width:38%;">Service</td>
                      <td style="padding:8px 0; color:{TEXT_COLOR}; font-size:14px; font-weight:700;">{safe_service}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0; color:{MUTED_COLOR}; font-size:14px;">Update</td>
                      <td style="padding:8px 0; color:{TEXT_COLOR}; font-size:14px; font-weight:700;">Request not approved at this time</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:10px 32px 8px 32px;">
                  <h2 style="margin:0 0 10px 0; font-size:18px; color:{TEXT_COLOR};">
                    Message from OurSkin
                  </h2>

                  <p style="margin:0; font-size:15px; line-height:1.8; color:{MUTED_COLOR}; white-space:pre-line;">
                    {safe_reason}
                  </p>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 32px 20px 32px;">
                  <a href="{portal_link}"
                     style="display:inline-block; background:{BRAND_COLOR}; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:15px; font-weight:700;">
                    View Appointment History
                  </a>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 24px 28px 24px; text-align:center; border-top:1px solid {BORDER_COLOR};">
                  <p style="margin:0; font-size:12px; line-height:1.6; color:#8f7a82;">
                    This notification was sent by OurSkin Dermatology Clinic. Please check your patient portal for the latest appointment details.
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


def send_appointment_approval_email(
    email: str,
    patient_name: str,
    service: str,
    doctor_name: str,
    schedule_date: str,
    schedule_time: str,
    consultation_mode: str,
    instruction: str,
):
    html_content = build_appointment_approval_template(
        patient_name=patient_name,
        service=service,
        doctor_name=doctor_name,
        schedule_date=schedule_date,
        schedule_time=schedule_time,
        consultation_mode=consultation_mode,
        instruction=instruction,
    )

    send_email(
        email,
        "Your OurSkin appointment has been approved",
        html_content,
    )


def send_appointment_decline_email(
    email: str,
    patient_name: str,
    service: str,
    reason: str,
):
    html_content = build_appointment_decline_template(
        patient_name=patient_name,
        service=service,
        reason=reason,
    )

    send_email(
        email,
        "Update on your OurSkin appointment request",
        html_content,
    )


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
    reset_link = f"{FRONTEND_URL.rstrip('/')}/reset-password?token={token}"

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