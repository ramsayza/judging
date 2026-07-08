"""Estimates a judge's return-trip mileage reimbursement between their home
postcode and an event's venue postcode.

Distance is straight-line (haversine), not real road mileage -- there's no
postcode-distance data anywhere in this repo, and geocoding via a live
lookup is the only way to get real coordinates without fabricating
geographic data. `geocode_postcode` is a standalone module-level function
specifically so tests can monkeypatch it instead of hitting the real
network.
"""

import math
from decimal import Decimal

import httpx

EARTH_RADIUS_MILES = 3958.8


class PostcodeLookupError(Exception):
    """Raised when a postcode can't be geocoded (not found, or the lookup
    service is unreachable)."""


def geocode_postcode(postcode: str) -> tuple[float, float]:
    try:
        resp = httpx.get(f"https://api.postcodes.io/postcodes/{postcode.strip()}", timeout=5.0)
    except httpx.HTTPError as exc:
        raise PostcodeLookupError(f"could not reach postcode lookup service: {exc}") from exc

    if resp.status_code == 404:
        raise PostcodeLookupError(f"postcode not found: {postcode}")
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise PostcodeLookupError(f"postcode lookup failed: {exc}") from exc

    result = resp.json()["result"]
    return result["latitude"], result["longitude"]


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_MILES * c


def estimate_reimbursement(
    *, judge_postcode: str, venue_postcode: str, cost_per_mile: Decimal, cap: Decimal | None
) -> dict:
    lat1, lon1 = geocode_postcode(judge_postcode)
    lat2, lon2 = geocode_postcode(venue_postcode)
    miles_one_way = haversine_miles(lat1, lon1, lat2, lon2)
    miles_return = miles_one_way * 2

    raw_amount = Decimal(str(round(miles_return, 4))) * cost_per_mile
    capped = cap is not None and raw_amount > cap
    amount = min(raw_amount, cap) if cap is not None else raw_amount

    return {
        "miles_one_way": round(miles_one_way, 1),
        "miles_return": round(miles_return, 1),
        "rate_per_mile": str(cost_per_mile),
        "cap": str(cap) if cap is not None else None,
        "capped": capped,
        "amount": str(round(amount, 2)),
        "judge_postcode": judge_postcode,
        "venue_postcode": venue_postcode,
    }
