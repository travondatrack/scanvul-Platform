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

celery_app.conf.task_soft_time_limit = 600
celery_app.conf.task_time_limit = 630

from celery.signals import setup_logging
import logging

@setup_logging.connect
def config_loggers(*args, **kwargs):
    from app.core.logger import setup_logger
    # Override celery's root logger
    setup_logger()
