"""add received_at to attendance

Revision ID: af6a8124befd
Revises:
Create Date: 2026-08-19 11:14:17.077621

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'af6a8124befd'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'attendance',
        sa.Column(
            'received_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
    )


def downgrade() -> None:
    op.drop_column('attendance', 'received_at')
