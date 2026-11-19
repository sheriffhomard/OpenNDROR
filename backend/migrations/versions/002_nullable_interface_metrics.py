"""Make network_interfaces hardware metrics nullable when uncollected

Revision ID: 002_nullable_interface_metrics
Revises: 001_initial_schema
Create Date: 2026-11-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '002_nullable_interface_metrics'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('network_interfaces', schema=None) as batch_op:
        batch_op.alter_column('mac_address', existing_type=sa.String(length=17), nullable=True)
        batch_op.alter_column('mtu', existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column('speed_mbps', existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column('rx_dropped', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('network_interfaces', schema=None) as batch_op:
        batch_op.alter_column('rx_dropped', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('speed_mbps', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('mtu', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('mac_address', existing_type=sa.String(length=17), nullable=False)
