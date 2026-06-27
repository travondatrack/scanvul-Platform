from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


database_url = settings.database_url
if database_url.startswith("mysql://"):
    database_url = database_url.replace("mysql://", "mysql+pymysql://", 1)

# Remove Prisma-specific query params that crash SQLAlchemy
if "?ssl-mode=REQUIRED" in database_url:
    database_url = database_url.replace("?ssl-mode=REQUIRED", "")
elif "&ssl-mode=REQUIRED" in database_url:
    database_url = database_url.replace("&ssl-mode=REQUIRED", "")
if "?sslaccept=accept_invalid_certs" in database_url:
    database_url = database_url.replace("?sslaccept=accept_invalid_certs", "")

connect_args = {}
if "aivencloud" in database_url:
    connect_args = {"ssl": {}}
engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
