import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("queue_worker")

logger.info("MindSafe queue worker starting")

while True:
    logger.info("MindSafe queue worker alive")
    time.sleep(60)
