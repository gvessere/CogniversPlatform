"""add processor active and prompt fields

Revision ID: add_processor_active_and_prompt
Revises: add_processor_tables
Create Date: 2024-03-20 17:33:35.000000

"""
from typing import Optional

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_processor_active_and_prompt'
down_revision: Optional[str] = 'add_processor_tables'
branch_labels: Optional[str] = None
depends_on: Optional[str] = None

def upgrade() -> None:
    # Add is_active to processors table
    with op.batch_alter_table('processors') as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    
    # Add prompt to processing_results table
    with op.batch_alter_table('processing_results') as batch_op:
        batch_op.add_column(sa.Column('prompt', sa.Text(), nullable=True))

def downgrade() -> None:
    # Remove is_active from processors table
    with op.batch_alter_table('processors') as batch_op:
        batch_op.drop_column('is_active')
    
    # Remove prompt from processing_results table
    with op.batch_alter_table('processing_results') as batch_op:
        batch_op.drop_column('prompt') 