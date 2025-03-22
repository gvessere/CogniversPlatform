"""Add is_active column to questions table

Revision ID: 20240320000001
Revises: 20240320000000
Create Date: 2024-03-20 00:00:01.000000

"""
from typing import Optional
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20240320000001'
down_revision: Optional[str] = '20240320000000'
branch_labels: Optional[str] = None
depends_on: Optional[str] = None

def upgrade() -> None:
    # Add is_active column to questions table with default value True
    op.add_column('questions', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))

def downgrade() -> None:
    # Remove is_active column from questions table
    op.drop_column('questions', 'is_active') 