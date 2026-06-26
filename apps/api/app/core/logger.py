import logging
import sys
from pythonjsonlogger import jsonlogger
from contextvars import ContextVar
from typing import Any, Dict

request_id_var: ContextVar[str] = ContextVar("request_id", default="")

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)
        if not log_record.get("timestamp"):
            log_record["timestamp"] = self.formatTime(record, self.datefmt)
        if log_record.get("level"):
            log_record["level"] = log_record["level"].upper()
        else:
            log_record["level"] = record.levelname
            
        # Add correlation ID
        request_id = request_id_var.get()
        if request_id:
            log_record["request_id"] = request_id

def setup_logger(name: str = "scanvul") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        logHandler = logging.StreamHandler(sys.stdout)
        formatter = CustomJsonFormatter('%(timestamp)s %(level)s %(name)s %(message)s')
        logHandler.setFormatter(formatter)
        logger.addHandler(logHandler)
    return logger

logger = setup_logger()
