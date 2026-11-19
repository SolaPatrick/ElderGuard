"""Connects to the database (PostgreSQL, or SQLite) and gives each request its own session."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from .config import DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    # SQLite only: lets FastAPI and the camera threads share the same database file
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL: pool_pre_ping quietly reconnects if PostgreSQL was restarted
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)


def create_tables():
    SQLModel.metadata.create_all(engine)
    # create_all only makes missing tables, so a column added later has to be added to existing databases here.
    new_columns = {
        "alert": {"residents_at_alert": "JSON", "is_test": "BOOLEAN NOT NULL DEFAULT FALSE"},
        "restzone": {"points": "JSON"},          # zones became shapes of dots; older rows keep only their box
    }
    with engine.begin() as connection:
        for table, columns in new_columns.items():
            existing = {c["name"] for c in inspect(connection).get_columns(table)}
            for name, definition in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]