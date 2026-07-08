"""add event_classes.class_number/size/ring_position, replace
scheduled_time (DateTime) with class_date (Date)

Revision ID: 0010_class_number_size
Revises: 0009_widen_contract_copy
Create Date: 2026-07-08 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0010_class_number_size"
down_revision: Union[str, None] = "0009_widen_contract_copy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("event_classes", sa.Column("class_number", sa.Integer(), nullable=True))
    op.add_column("event_classes", sa.Column("size", sa.String(length=50), nullable=True))
    op.add_column("event_classes", sa.Column("ring_position", sa.Integer(), nullable=True))
    op.add_column("event_classes", sa.Column("class_date", sa.Date(), nullable=True))
    op.drop_column("event_classes", "scheduled_time")


def downgrade() -> None:
    op.add_column("event_classes", sa.Column("scheduled_time", sa.DateTime(), nullable=True))
    op.drop_column("event_classes", "class_date")
    op.drop_column("event_classes", "ring_position")
    op.drop_column("event_classes", "size")
    op.drop_column("event_classes", "class_number")
