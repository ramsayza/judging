from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models.rule_set_contract_copy import RuleSetContractCopy
from app.models.user import User
from app.schemas.rule_set_contract_copy import RuleSetContractCopyRead

router = APIRouter(tags=["rule-set-copies"])


@router.get("/rule-set-copies", response_model=list[RuleSetContractCopyRead])
def list_rule_set_copies(
    db: Session = Depends(get_db), _user: User = Depends(get_current_user)
) -> list[RuleSetContractCopy]:
    return db.query(RuleSetContractCopy).order_by(RuleSetContractCopy.rule_set).all()
