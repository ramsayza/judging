"""Validates a judge's submitted answers against an event's organizer-defined
requirement fields (`RequirementField`) at contract-accept time.

Responses are captured exactly once, during `accept` -- there is no update
path afterwards for anyone, judge or organizer, so validation here is the
only gate these answers ever pass through.
"""

from app.schemas.event import RequirementField, RequirementFieldType


def validate_responses(fields: list[RequirementField], responses: dict) -> dict:
    by_key = {field.key: field for field in fields}
    unknown = set(responses) - set(by_key)
    if unknown:
        raise ValueError(f"unknown field(s): {', '.join(sorted(unknown))}")

    normalized: dict = {}
    for field in fields:
        value = responses.get(field.key)
        if field.required and (value is None or value == "" or value == []):
            raise ValueError(f"missing required field: {field.label}")
        if value is None:
            continue

        if field.field_type == RequirementFieldType.select:
            if value not in (field.options or []):
                raise ValueError(f"'{field.label}': invalid option {value!r}")
        elif field.field_type == RequirementFieldType.multiselect:
            options = field.options or []
            if not isinstance(value, list) or any(v not in options for v in value):
                raise ValueError(f"'{field.label}': invalid option(s) in {value!r}")
        elif field.field_type == RequirementFieldType.number:
            try:
                float(value)
            except (TypeError, ValueError):
                raise ValueError(f"'{field.label}': must be a number")

        normalized[field.key] = value

    return normalized
