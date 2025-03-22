"""Add missing fields to questions table

Revision ID: 20240320000002
Revises: 20240320000001
Create Date: 2024-03-20 00:00:02.000000

"""
from typing import Optional
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20240320000002'
down_revision: Optional[str] = '20240320000001'
branch_labels: Optional[str] = None
depends_on: Optional[str] = None

def upgrade() -> None:
    # Add missing columns to questions table
    op.add_column('questions', sa.Column('order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('questions', sa.Column('page_number', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('questions', sa.Column('is_required', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('questions', sa.Column('time_limit_seconds', sa.Integer(), nullable=True))

def downgrade() -> None:
    # Remove added columns from questions table
    op.drop_column('questions', 'time_limit_seconds')
    op.drop_column('questions', 'is_required')
    op.drop_column('questions', 'page_number')
    op.drop_column('questions', 'order') 