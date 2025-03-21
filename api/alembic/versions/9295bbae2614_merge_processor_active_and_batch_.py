"""merge processor active and batch processing

Revision ID: 9295bbae2614
Revises: add_processor_active_and_prompt, e7eefe71f17f
Create Date: 2024-03-20 17:47:35.336616

"""
from typing import Sequence, Union, Tuple

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9295bbae2614'
down_revision: Union[str, None, Tuple[str, ...]] = ('add_processor_active_and_prompt', 'e7eefe71f17f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass 