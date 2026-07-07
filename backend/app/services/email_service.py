"""Email templates + sending.

No SMTP provider is wired up yet, so `send_email` just logs the rendered
message. Swap the body of `send_email` for a real provider (SES, Postmark,
etc.) when one is chosen -- callers only depend on `EmailMessage` /
`send_email`, not on how delivery happens.
"""

import logging
from dataclasses import dataclass
from datetime import date

from app.config import settings

logger = logging.getLogger("app.email")


@dataclass
class EmailMessage:
    to: str
    subject: str
    text_body: str


def render_judge_invitation_email(
    *,
    to_email: str,
    judge_name: str,
    organization_name: str,
    event_name: str,
    event_start_date: date,
    event_end_date: date,
    org_slug: str,
    contract_id: str,
) -> EmailMessage:
    """Template for the email sent to a judge when they're invited to an event."""
    accept_url = f"{settings.frontend_base_url}/org/{org_slug}/contracts/{contract_id}"

    subject = f"You're invited to judge {event_name}"
    text_body = (
        f"Hi {judge_name},\n\n"
        f"{organization_name} has invited you to judge at {event_name} "
        f"({event_start_date.isoformat()} to {event_end_date.isoformat()}).\n\n"
        f"View the invitation and respond here:\n{accept_url}\n\n"
        f"If you weren't expecting this, you can ignore this email.\n"
    )
    return EmailMessage(to=to_email, subject=subject, text_body=text_body)


def send_email(message: EmailMessage) -> None:
    logger.info("Sending email to=%s subject=%r\n%s", message.to, message.subject, message.text_body)


def send_judge_invitation_email(
    *,
    to_email: str,
    judge_name: str,
    organization_name: str,
    event_name: str,
    event_start_date: date,
    event_end_date: date,
    org_slug: str,
    contract_id: str,
) -> None:
    message = render_judge_invitation_email(
        to_email=to_email,
        judge_name=judge_name,
        organization_name=organization_name,
        event_name=event_name,
        event_start_date=event_start_date,
        event_end_date=event_end_date,
        org_slug=org_slug,
        contract_id=contract_id,
    )
    send_email(message)
