"""add task definitions

Revision ID: 20240320000000
Revises: 9295bbae2614
Create Date: 2024-03-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from typing import Optional

# revision identifiers, used by Alembic.
revision = '20240320000000'
down_revision = '9295bbae2614'
branch_labels: Optional[str] = None
depends_on: Optional[str] = None

def upgrade():
    # Create task_definitions table
    op.create_table(
        'task_definitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('processor_id', sa.Integer(), nullable=False),
        sa.Column('questionnaire_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['processor_id'], ['processors.id'], ),
        sa.ForeignKeyConstraint(['questionnaire_id'], ['questionnaires.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Add task_definition_id to question_processor_mappings
    op.add_column('question_processor_mappings', sa.Column('task_definition_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_question_processor_mappings_task_definition_id', 'question_processor_mappings', 'task_definitions', ['task_definition_id'], ['id'])

    # Create index for faster lookups
    op.create_index('ix_task_definitions_processor_id', 'task_definitions', ['processor_id'])
    op.create_index('ix_task_definitions_questionnaire_id', 'task_definitions', ['questionnaire_id'])

def downgrade():
    # Drop foreign key and column from question_processor_mappings
    op.drop_constraint('fk_question_processor_mappings_task_definition_id', 'question_processor_mappings', type_='foreignkey')
    op.drop_column('question_processor_mappings', 'task_definition_id')

    # Drop indexes
    op.drop_index('ix_task_definitions_processor_id')
    op.drop_index('ix_task_definitions_questionnaire_id')

    # Drop task_definitions table
    op.drop_table('task_definitions') 