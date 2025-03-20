"""add processor tables

Revision ID: add_processor_tables
Revises: add_session_status
Create Date: 2024-03-20 00:30:00.000000

"""
from typing import Optional

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_processor_tables'
down_revision: Optional[str] = 'add_session_status'
branch_labels: Optional[str] = None
depends_on: Optional[str] = None

def upgrade() -> None:
    # Add new columns to processors table
    with op.batch_alter_table('processors') as batch_op:
        # Add new columns
        batch_op.add_column(sa.Column('llm_model', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('temperature', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('max_tokens', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('system_prompt', sa.Text(), nullable=True))
        
        # Modify existing columns
        batch_op.alter_column('description', type_=sa.Text(), nullable=True)
        batch_op.alter_column('prompt_template', type_=sa.Text(), nullable=False)
        batch_op.alter_column('post_processing_code', type_=sa.Text(), nullable=True)
        batch_op.alter_column('created_at', type_=sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
        batch_op.alter_column('updated_at', type_=sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)

    # Create questionnaire_processor_mappings table if it doesn't exist
    try:
        op.create_table(
            'questionnaire_processor_mappings',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('questionnaire_id', sa.UUID(), nullable=False),
            sa.Column('processor_id', sa.Integer(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['questionnaire_id'], ['questionnaires.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['processor_id'], ['processors.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('questionnaire_id', 'processor_id', name='uq_questionnaire_processor')
        )
    except Exception:
        pass

    # Create processing_results table if it doesn't exist
    try:
        op.create_table(
            'processing_results',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('questionnaire_response_id', sa.UUID(), nullable=False),
            sa.Column('processor_id', sa.Integer(), nullable=False),
            sa.Column('raw_output', postgresql.JSON(), nullable=False),
            sa.Column('processed_output', postgresql.JSON(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['questionnaire_response_id'], ['questionnaire_responses.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['processor_id'], ['processors.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
    except Exception:
        pass

    # Create annotations table if it doesn't exist
    try:
        op.create_table(
            'annotations',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('processing_result_id', sa.UUID(), nullable=False),
            sa.Column('start_offset', sa.Integer(), nullable=False),
            sa.Column('end_offset', sa.Integer(), nullable=False),
            sa.Column('class_label', sa.String(), nullable=False),
            sa.Column('explanation', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['processing_result_id'], ['processing_results.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
    except Exception:
        pass

def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('annotations')
    op.drop_table('processing_results')
    op.drop_table('questionnaire_processor_mappings')

    # Remove new columns from processors table
    with op.batch_alter_table('processors') as batch_op:
        batch_op.drop_column('llm_model')
        batch_op.drop_column('temperature')
        batch_op.drop_column('max_tokens')
        batch_op.drop_column('system_prompt')
        
        # Restore original column types
        batch_op.alter_column('description', type_=sa.String(), nullable=False)
        batch_op.alter_column('prompt_template', type_=sa.Text(), nullable=True)
        batch_op.alter_column('post_processing_code', type_=sa.Text(), nullable=True)
        batch_op.alter_column('created_at', type_=sa.DateTime(), nullable=False)
        batch_op.alter_column('updated_at', type_=sa.DateTime(), nullable=False) 