from app.models.contract import Contract, ContractStatus
from app.models.event_class import EventClass


class AllocationError(Exception):
    """Raised when an allocation would violate a business rule (wrong event,
    contract not in an allocatable state)."""


ALLOCATABLE_STATUSES = frozenset({ContractStatus.accepted, ContractStatus.appointed})


def validate_can_allocate(contract: Contract, event_class: EventClass) -> None:
    if contract.status not in ALLOCATABLE_STATUSES:
        raise AllocationError(
            f"cannot allocate a class to a contract in status '{contract.status.value}'"
        )
    if event_class.event_id != contract.event_id:
        raise AllocationError("class does not belong to the contract's event")


def validate_can_deallocate(contract: Contract) -> None:
    if contract.status == ContractStatus.complete:
        raise AllocationError("cannot modify allocations for a completed contract")
