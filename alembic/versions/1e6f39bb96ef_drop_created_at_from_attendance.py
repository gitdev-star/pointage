"""drop created_at from attendance

Revision ID: 1e6f39bb96ef
Revises: c91de2721373
Create Date: 2026-08-20 05:47:17.652955

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1e6f39bb96ef'
down_revision: Union[str, Sequence[str], None] = 'c91de2721373'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('attendance', 'created_at')


def downgrade() -> None:
    op.add_column(
        'attendance',
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
