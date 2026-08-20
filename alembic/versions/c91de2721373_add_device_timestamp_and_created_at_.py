"""add device_timestamp and created_at, drop received_at
Revision ID: c91de2721373
Revises: af6a8124befd
Create Date: 2026-08-19 12:06:21.182687
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c91de2721373'
down_revision: Union[str, Sequence[str], None] = 'af6a8124befd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('attendance', sa.Column('device_timestamp', sa.DateTime(), nullable=True))
    op.add_column(
        'attendance',
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.execute("UPDATE attendance SET device_timestamp = timestamp WHERE device_timestamp IS NULL")
    op.alter_column('attendance', 'device_timestamp', existing_type=sa.DateTime(), nullable=False)
    op.drop_constraint('uq_user_timestamp_date', 'attendance', type_='unique')
    op.create_unique_constraint('uq_user_devicetimestamp_date', 'attendance', ['user_id', 'device_timestamp', 'date'])
    op.drop_column('attendance', 'received_at')


def downgrade() -> None:
    op.add_column(
        'attendance',
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.drop_constraint('uq_user_devicetimestamp_date', 'attendance', type_='unique')
    op.create_unique_constraint('uq_user_timestamp_date', 'attendance', ['user_id', 'timestamp', 'date'])
    op.drop_column('attendance', 'created_at')
    op.drop_column('attendance', 'device_timestamp')
