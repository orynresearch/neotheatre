"""
Neotheatre Conversion Job Worker
Polls the conversion_jobs table every 5 seconds, atomically claims jobs using
SELECT ... FOR UPDATE SKIP LOCKED (or transactional atomic claim in SQLite),
runs the AudioConverter pipeline, and updates job status to completed / failed.
"""

import os
import sys
import time
import socket
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from converter import AudioConverter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("neotheatre.worker")


class JobQueueWorker:
    def __init__(self, db_url: Optional[str] = None):
        self.worker_id = f"{socket.gethostname()}:{os.getpid()}"
        self.db_url = db_url or os.getenv("DATABASE_URL", "sqlite:///storage/neotheatre.db")
        self.converter = AudioConverter()
        self.is_sqlite = self.db_url.startswith("sqlite")
        self._init_db_connection()
        logger.info(f"Worker initialized with ID: {self.worker_id} on {self.db_url}")

    def _init_db_connection(self):
        if self.is_sqlite:
            import sqlite3
            db_path = self.db_url.replace("sqlite:///", "").replace("sqlite://", "")
            if not os.path.isabs(db_path):
                project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
                db_path = os.path.join(project_root, db_path)
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
            self.sqlite_db_path = db_path
            self._ensure_sqlite_tables()
        else:
            try:
                import psycopg2
                import psycopg2.extras
                self.pg_conn = psycopg2.connect(self.db_url)
                self.pg_conn.autocommit = False
            except ImportError:
                logger.warning("psycopg2 not found, falling back to SQLite driver for local queue.")
                self.is_sqlite = True
                self.sqlite_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "neotheatre.db"))
                self._ensure_sqlite_tables()

    def _ensure_sqlite_tables(self):
        import sqlite3
        conn = sqlite3.connect(self.sqlite_db_path)
        schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "database", "schema.sql"))
        if os.path.exists(schema_path):
            with open(schema_path, "r") as f:
                sql = f.read()
                # Clean up PG specific syntax for sqlite compatibility
                sql_clean = sql.replace("UUID PRIMARY KEY DEFAULT gen_random_uuid()", "TEXT PRIMARY KEY")
                sql_clean = sql_clean.replace("TIMESTAMP DEFAULT CURRENT_TIMESTAMP", "DATETIME DEFAULT CURRENT_TIMESTAMP")
                sql_clean = sql_clean.replace("TIMESTAMP DEFAULT NOW()", "DATETIME DEFAULT CURRENT_TIMESTAMP")
                sql_clean = sql_clean.replace("DECIMAL(6, 2)", "REAL")
                sql_clean = sql_clean.replace("TEXT[]", "TEXT")
                sql_clean = sql_clean.replace("INET", "TEXT")
                conn.executescript(sql_clean)
                conn.commit()
        conn.close()

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Atomically query and claim the oldest queued conversion job.
        Status flow: queued -> claimed
        """
        if self.is_sqlite:
            import sqlite3
            conn = sqlite3.connect(self.sqlite_db_path, timeout=10.0)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            try:
                cursor.execute("BEGIN IMMEDIATE")
                cursor.execute(
                    """
                    SELECT * FROM conversion_jobs 
                    WHERE status = 'queued' 
                    ORDER BY created_at ASC 
                    LIMIT 1
                    """
                )
                row = cursor.fetchone()
                if not row:
                    conn.rollback()
                    conn.close()
                    return None

                job = dict(row)
                cursor.execute(
                    """
                    UPDATE conversion_jobs
                    SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now')
                    WHERE id = ? AND status = 'queued'
                    """,
                    (self.worker_id, job["id"])
                )
                conn.commit()
                conn.close()
                return job
            except Exception as e:
                conn.rollback()
                conn.close()
                logger.error(f"Error claiming job in SQLite: {e}")
                return None
        else:
            import psycopg2.extras
            try:
                with self.pg_conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute(
                        """
                        SELECT * FROM conversion_jobs
                        WHERE status = 'queued'
                        ORDER BY created_at ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                        """
                    )
                    row = cur.fetchone()
                    if not row:
                        self.pg_conn.rollback()
                        return None

                    job = dict(row)
                    cur.execute(
                        """
                        UPDATE conversion_jobs
                        SET status = 'claimed', claimed_by = %s, claimed_at = NOW()
                        WHERE id = %s
                        """,
                        (self.worker_id, job["id"])
                    )
                    self.pg_conn.commit()
                    return job
            except Exception as e:
                self.pg_conn.rollback()
                logger.error(f"Error claiming job in Postgres: {e}")
                return None

    def update_job_status(
        self,
        job_id: str,
        status: str,
        output_formats: Optional[List[str]] = None,
        error_message: Optional[str] = None
    ):
        output_formats_str = json.dumps(output_formats or [])
        if self.is_sqlite:
            import sqlite3
            conn = sqlite3.connect(self.sqlite_db_path, timeout=10.0)
            cursor = conn.cursor()
            if status == "processing":
                cursor.execute(
                    "UPDATE conversion_jobs SET status = ?, started_at = datetime('now') WHERE id = ?",
                    (status, job_id)
                )
            elif status in ("completed", "failed"):
                cursor.execute(
                    """
                    UPDATE conversion_jobs 
                    SET status = ?, output_formats = ?, error_message = ?, completed_at = datetime('now')
                    WHERE id = ?
                    """,
                    (status, output_formats_str, error_message, job_id)
                )
            conn.commit()
            conn.close()
        else:
            try:
                with self.pg_conn.cursor() as cur:
                    if status == "processing":
                        cur.execute(
                            "UPDATE conversion_jobs SET status = %s, started_at = NOW() WHERE id = %s",
                            (status, job_id)
                        )
                    elif status in ("completed", "failed"):
                        cur.execute(
                            """
                            UPDATE conversion_jobs
                            SET status = %s, output_formats = %s, error_message = %s, completed_at = NOW()
                            WHERE id = %s
                            """,
                            (status, output_formats_str, error_message, job_id)
                        )
                    self.pg_conn.commit()
            except Exception as e:
                self.pg_conn.rollback()
                logger.error(f"Failed to update job status in Postgres: {e}")

    def process_job(self, job: Dict[str, Any]):
        job_id = job["id"]
        release_id = job["release_id"]
        track_id = job.get("track_id") or "main"
        source_path = job["source_file_path"]
        source_format = job.get("source_format", "wav")

        logger.info(f"Worker {self.worker_id} starting job {job_id} for release {release_id} track {track_id}")
        self.update_job_status(job_id, "processing")

        try:
            results = self.converter.convert_track(
                source_path=source_path,
                release_id=release_id,
                track_id=track_id,
                source_format=source_format
            )
            formats = list(results.keys())
            self.update_job_status(job_id, "completed", output_formats=formats)
            logger.info(f"Job {job_id} completed successfully. Generated formats: {formats}")

        except Exception as e:
            logger.error(f"Job {job_id} failed with error: {e}", exc_info=True)
            self.update_job_status(job_id, "failed", error_message=str(e))

    def run(self, poll_interval_seconds: float = 5.0, single_run: bool = False):
        logger.info(f"Neotheatre Worker polling for queued jobs every {poll_interval_seconds}s...")
        while True:
            try:
                job = self.claim_next_job()
                if job:
                    self.process_job(job)
                else:
                    if single_run:
                        break
                    time.sleep(poll_interval_seconds)
            except KeyboardInterrupt:
                logger.info("Worker stopped by user.")
                break
            except Exception as e:
                logger.error(f"Worker loop encountered exception: {e}")
                time.sleep(poll_interval_seconds)


if __name__ == "__main__":
    single = "--single" in sys.argv
    worker = JobQueueWorker()
    worker.run(poll_interval_seconds=5.0, single_run=single)
