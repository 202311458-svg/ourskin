from app.db import Base, engine
from app.models import user, audit_log 

Base.metadata.create_all(bind=engine)

print("DB initialized")