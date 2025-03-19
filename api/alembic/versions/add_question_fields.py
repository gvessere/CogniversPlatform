"""add question fields

Revision ID: add_question_fields
Create Date: 2024-03-19 00:00:00.000000

"""
from typing import Optional, List

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_question_fields'
down_revision: Optional[str] = None
branch_labels: Optional[List[str]] = None
depends_on: Optional[List[str]] = None


def upgrade() -> None:
    # Check if columns exist before adding them
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('question_responses')]
    
    # Add question_type and question_configuration columns if they don't exist
    if 'question_type' not in columns:
        op.add_column('question_responses', sa.Column('question_type', sa.String(), nullable=True))
    if 'question_configuration' not in columns:
        op.add_column('question_responses', sa.Column('question_configuration', postgresql.JSON(), nullable=True))
    
    # Update existing rows with data from questions table
    op.execute("""
        UPDATE question_responses qr
        SET question_type = q.type,
            question_configuration = q.configuration
        FROM questions q
        WHERE qr.question_id = q.id
    """)
    
    # Make columns non-nullable after populating data
    op.alter_column('question_responses', 'question_type',
                    existing_type=sa.String(),
                    nullable=False)
    op.alter_column('question_responses', 'question_configuration',
                    existing_type=postgresql.JSON(),
                    nullable=False)


def downgrade() -> None:
    # Remove the columns
    op.drop_column('question_responses', 'question_type')
    op.drop_column('question_responses', 'question_configuration') 