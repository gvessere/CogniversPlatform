"""add session status

Revision ID: add_session_status
Revises: add_question_fields
Create Date: 2024-03-19 21:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_session_status'
down_revision: Union[str, None] = 'add_question_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status column with default value 'active'
    op.add_column('sessions', sa.Column('status', sa.String(), nullable=False, server_default='active'))


def downgrade() -> None:
    # Remove status column
    op.drop_column('sessions', 'status') 