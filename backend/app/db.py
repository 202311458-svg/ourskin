import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

def test_db():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        result = conn.execute(text("select 1"))
        return result.scalar()