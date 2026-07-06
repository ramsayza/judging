from dataclasses import dataclass

from app.models.contract import ContractStatus


class ContractTransitionError(Exception):
    """Raised when a requested action is not valid for a contract's current status,
    or the acting user is not permitted to perform it. Routes translate this to a
    409 Conflict (invalid transition) — permission is enforced separately via the
    judge-ownership check below and via require_role at the route layer."""


@dataclass(frozen=True)
class ActionSpec:
    from_statuses: frozenset[ContractStatus]
    to_status: ContractStatus
    actor: str  # "judge" (must be the invited judge) or "organizer" (organizer/admin)


# The single source of truth for the contract lifecycle: invitation -> accepted ->
# appointed -> complete, with declined/cancelled as terminal side branches.
ACTIONS: dict[str, ActionSpec] = {
    "accept": ActionSpec(frozenset({ContractStatus.invitation}), ContractStatus.accepted, "judge"),
    "decline": ActionSpec(frozenset({ContractStatus.invitation}), ContractStatus.declined, "judge"),
    "appoint": ActionSpec(frozenset({ContractStatus.accepted}), ContractStatus.appointed, "organizer"),
    "complete": ActionSpec(frozenset({ContractStatus.appointed}), ContractStatus.complete, "organizer"),
    "cancel": ActionSpec(
        frozenset({ContractStatus.invitation, ContractStatus.accepted, ContractStatus.appointed}),
        ContractStatus.cancelled,
        "organizer",
    ),
}

TERMINAL_STATUSES = frozenset({ContractStatus.declined, ContractStatus.cancelled, ContractStatus.complete})


def validate_transition(current_status: ContractStatus, judge_user_id: str, action: str, actor_user_id: str) -> ActionSpec:
    spec = ACTIONS[action]
    if current_status not in spec.from_statuses:
        raise ContractTransitionError(
            f"cannot '{action}' a contract in status '{current_status.value}'"
        )
    if spec.actor == "judge" and judge_user_id != actor_user_id:
        raise ContractTransitionError("only the invited judge can accept or decline their own contract")
    return spec
