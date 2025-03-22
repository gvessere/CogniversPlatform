"""add task_definition_id to question_processor_mappings

Revision ID: 20240320000003
Revises: 20240320000002
Create Date: 2024-03-20 00:00:03.000000

"""
from alembic import op
import sqlalchemy as sa
from typing import Optional


# revision identifiers, used by Alembic.
revision = '20240320000003'
down_revision = '20240320000002'
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade():
    # Add task_definition_id column
    op.add_column('question_processor_mappings', sa.Column('task_definition_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_question_processor_mappings_task_definition_id',
        'question_processor_mappings',
        'task_definitions',
        ['task_definition_id'],
        ['id']
    )
    
    # Create index for faster lookups
    op.create_index(
        'ix_question_processor_mappings_task_definition_id',
        'question_processor_mappings',
        ['task_definition_id']
    )


def downgrade():
    # Drop index first
    op.drop_index('ix_question_processor_mappings_task_definition_id')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_question_processor_mappings_task_definition_id', 'question_processor_mappings', type_='foreignkey')
    
    # Drop column
    op.drop_column('question_processor_mappings', 'task_definition_id') 