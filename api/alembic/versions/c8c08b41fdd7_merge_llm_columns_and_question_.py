"""merge llm columns and question processor mapping

Revision ID: c8c08b41fdd7
Revises: add_llm_columns, add_question_processor_mapping
Create Date: 2024-03-21 16:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from typing import Optional

# revision identifiers, used by Alembic.
revision = 'c8c08b41fdd7'
down_revision: Optional[tuple[str, str]] = ('add_llm_columns', 'add_question_processor_mapping')
branch_labels: Optional[str] = None
depends_on: Optional[str] = None

def upgrade() -> None:
    """Upgrade schema."""
    pass

def downgrade() -> None:
    """Downgrade schema."""
    pass
