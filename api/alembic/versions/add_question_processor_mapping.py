"""add question processor mapping

Revision ID: add_question_processor_mapping
Revises: add_processor_tables
Create Date: 2024-03-21 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from typing import Optional

# revision identifiers, used by Alembic.
revision = 'add_question_processor_mapping'
down_revision = 'add_processor_tables'
branch_labels: Optional[str] = None
depends_on: Optional[str] = None

def upgrade() -> None:
    # Create question_processor_mappings table
    op.create_table(
        'question_processor_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('processor_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['processor_id'], ['processors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('question_id', 'processor_id', name='uq_question_processor')
    )

    # Add trigger to update updated_at
    op.execute("""
        CREATE TRIGGER update_question_processor_mappings_updated_at
            BEFORE UPDATE ON question_processor_mappings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    """)

    # Add index for faster lookups
    op.create_index('ix_question_processor_mappings_question_id', 'question_processor_mappings', ['question_id'])
    op.create_index('ix_question_processor_mappings_processor_id', 'question_processor_mappings', ['processor_id'])

def downgrade() -> None:
    # Drop trigger
    op.execute("""
        DROP TRIGGER IF EXISTS update_question_processor_mappings_updated_at ON question_processor_mappings;
    """)

    # Drop indexes
    op.drop_index('ix_question_processor_mappings_question_id')
    op.drop_index('ix_question_processor_mappings_processor_id')

    # Drop table
    op.drop_table('question_processor_mappings') 