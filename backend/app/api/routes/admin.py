from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_platform_admin
from app.db import get_db
from app.models.event import EventRuleSet
from app.models.organization import Organization
from app.models.rule_set_contract_copy import RuleSetContractCopy
from app.models.user import User
from app.schemas.organization import OrganizationRead
from app.schemas.rule_set_contract_copy import RuleSetContractCopyRead, RuleSetContractCopyUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/rule-set-copies", response_model=list[RuleSetContractCopyRead])
def list_rule_set_copies(
    db: Session = Depends(get_db), _admin: User = Depends(get_current_platform_admin)
) -> list[RuleSetContractCopy]:
    return db.query(RuleSetContractCopy).order_by(RuleSetContractCopy.rule_set).all()


@router.patch("/rule-set-copies/{rule_set}", response_model=RuleSetContractCopyRead)
def update_rule_set_copy(
    rule_set: EventRuleSet,
    payload: RuleSetContractCopyUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_platform_admin),
) -> RuleSetContractCopy:
    copy = db.get(RuleSetContractCopy, rule_set)
    if copy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "rule set not found")
    copy.body = payload.body
    db.commit()
    db.refresh(copy)
    return copy


@router.get("/organizations", response_model=list[OrganizationRead])
def list_all_organizations(
    db: Session = Depends(get_db), _admin: User = Depends(get_current_platform_admin)
) -> list[Organization]:
    return db.query(Organization).order_by(Organization.name).all()
