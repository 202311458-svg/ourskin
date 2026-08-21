from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, event
from sqlalchemy.sql import func
from app.db import Base


class AppointmentLog(Base):
    __tablename__ = "appointment_logs"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    action = Column(String, nullable=False)
    performed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    performed_by_name = Column(String, nullable=False)
    performed_by_role = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


@event.listens_for(AppointmentLog, "after_insert")
def mirror_appointment_log_to_central_audit(_mapper, connection, target: AppointmentLog):
    """Keep the legacy appointment-history table while centralizing auditing.

    The mirror uses the same SQLAlchemy connection as the originating insert,
    so the central audit event commits or rolls back with the appointment
    transaction. Existing `/appointments/{id}/logs` consumers continue to read
    the legacy table unchanged.
    """

    # Local import avoids a model import cycle while still using the canonical
    # audit table definition.
    from app.models.audit_log import AuditLog

    connection.execute(
        AuditLog.__table__.insert().values(
            action=f"APPOINTMENT_{target.action.upper().replace(' ', '_')}",
            description=(
                f"Appointment #{target.appointment_id}: {target.action}"
                + (f" ({target.reason})" if target.reason else "")
            ),
            performed_by=target.performed_by_name or "System",
            actor_id=target.performed_by_id,
            actor_role=target.performed_by_role,
            target_type="appointment",
            target_record_id=str(target.appointment_id),
            metadata_json={
                "legacy_appointment_log_id": target.id,
                "reason": target.reason,
            },
        )
    )
