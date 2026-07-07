"""Email templates + sending.

No SMTP provider is wired up yet, so `send_email` just logs the rendered
message. Swap the body of `send_email` for a real provider (SES, Postmark,
etc.) when one is chosen -- callers only depend on `EmailMessage` /
`send_email`, not on how delivery happens.

Templates use named `str.format`-style placeholders (e.g. "{judge_name}")
rather than f-strings so that an org's customized template -- untrusted,
organizer-authored text -- can be rendered safely. `render_template` never
executes attribute/index access; `validate_template` rejects anything that
isn't a plain whitelisted placeholder name before it's ever stored.
"""

import logging
import string
from dataclasses import dataclass
from datetime import date

from app.config import settings

logger = logging.getLogger("app.email")

DEFAULT_INVITATION_SUBJECT_TEMPLATE = "You're invited to judge {event_name}"
DEFAULT_INVITATION_BODY_TEMPLATE = (
    "Hi {judge_name},\n\n"
    "{organization_name} has invited you to judge at {event_name} "
    "({event_start_date} to {event_end_date}).\n\n"
    "View the invitation and respond here:\n{accept_url}\n\n"
    "If you weren't expecting this, you can ignore this email.\n"
)

ALLOWED_PLACEHOLDERS = {
    "judge_name",
    "organization_name",
    "event_name",
    "event_start_date",
    "event_end_date",
    "accept_url",
}


class _EscapingDict(dict):
    """Leaves any placeholder that wasn't supplied as a literal `{key}` in the
    output instead of raising -- a defensive fallback for `render_template`;
    `validate_template` is what actually keeps unknown placeholders out."""

    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def extract_placeholder_names(template: str) -> set[str]:
    names: set[str] = set()
    for _, field_name, _, _ in string.Formatter().parse(template):
        if field_name is None:
            continue
        # Only plain names like {event_name} are allowed. This rejects
        # attribute/index access (e.g. "{0.__class__.__mro__}" or "{x[0]}"),
        # which aren't valid identifiers, closing off any path to arbitrary
        # attribute lookups via str.format.
        if not field_name.isidentifier():
            raise ValueError(f"invalid placeholder: {{{field_name}}}")
        names.add(field_name)
    return names


def validate_template(template: str) -> None:
    unknown = extract_placeholder_names(template) - ALLOWED_PLACEHOLDERS
    if unknown:
        raise ValueError(f"unknown placeholder(s): {', '.join(sorted(unknown))}")


def render_template(template: str, values: dict[str, str]) -> str:
    return template.format_map(_EscapingDict(values))


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
    contract_id: str,
    subject_template: str | None = None,
    body_template: str | None = None,
) -> EmailMessage:
    """Template for the email sent to a judge when they're invited to an event.

    `subject_template`/`body_template` are an org's stored override (already
    validated at write time by `validate_template`); when absent, the
    hardcoded defaults are used.
    """
    # Judges aren't expected to navigate org-scoped URLs -- the link points at
    # the global judge contracts view, not `/org/{slug}/...`.
    accept_url = f"{settings.frontend_base_url}/contracts/{contract_id}"
    values = {
        "judge_name": judge_name,
        "organization_name": organization_name,
        "event_name": event_name,
        "event_start_date": event_start_date.isoformat(),
        "event_end_date": event_end_date.isoformat(),
        "accept_url": accept_url,
    }

    subject = render_template(subject_template or DEFAULT_INVITATION_SUBJECT_TEMPLATE, values)
    text_body = render_template(body_template or DEFAULT_INVITATION_BODY_TEMPLATE, values)
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
    contract_id: str,
    subject_template: str | None = None,
    body_template: str | None = None,
) -> None:
    message = render_judge_invitation_email(
        to_email=to_email,
        judge_name=judge_name,
        organization_name=organization_name,
        event_name=event_name,
        event_start_date=event_start_date,
        event_end_date=event_end_date,
        contract_id=contract_id,
        subject_template=subject_template,
        body_template=body_template,
    )
    send_email(message)
