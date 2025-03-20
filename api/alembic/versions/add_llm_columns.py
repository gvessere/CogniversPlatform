"""add llm columns

Revision ID: add_llm_columns
Revises: add_processor_tables
Create Date: 2024-03-18 23:31:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from typing import Optional, List, Union

# revision identifiers, used by Alembic.
revision = 'add_llm_columns'
down_revision = 'add_processor_tables'
branch_labels: Optional[Union[str, List[str]]] = None
depends_on: Optional[Union[str, List[str]]] = None

def upgrade() -> None:
    # Add LLM-related columns to processors table
    op.add_column('processors', sa.Column('llm_model', sa.String(), nullable=True))
    op.add_column('processors', sa.Column('llm_temperature', sa.Float(), nullable=True))
    op.add_column('processors', sa.Column('llm_max_tokens', sa.Integer(), nullable=True))
    op.add_column('processors', sa.Column('llm_stop_sequences', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('processors', sa.Column('llm_system_prompt', sa.Text(), nullable=True))

def downgrade() -> None:
    # Remove LLM-related columns from processors table
    op.drop_column('processors', 'llm_system_prompt')
    op.drop_column('processors', 'llm_stop_sequences')
    op.drop_column('processors', 'llm_max_tokens')
    op.drop_column('processors', 'llm_temperature')
    op.drop_column('processors', 'llm_model') 