from celery import Celery

from app.core.config import settings


celery_app = Celery(
    "codeguard_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.worker.tasks"],
)

celery_app.conf.task_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.result_serializer = "json"
celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True
celery_app.conf.broker_connection_retry_on_startup = True
