from sqlalchemy import Column, Integer, String, Date, Time
from app.db import Base

class AppointmentModel(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String, nullable=False)
    patient_email = Column(String, nullable=False)
    doctor_name = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    time = Column(Time, nullable=False)
    services = Column(String, nullable=False)  
    status = Column(String, default="Pending")  
    cancel_reason = Column(String, nullable=True)