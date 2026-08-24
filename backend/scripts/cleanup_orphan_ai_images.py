"""Delete old database-known AI image assets with no analysis run.

Run this as a scheduled maintenance command after configuring the same runtime
environment used by the backend. It only deletes storage objects after they have
remained unreferenced beyond the configured retention window.
"""

from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.storage import delete_storage_object
from app.db import SessionLocal
from app.models.ai_analysis_run import AIAnalysisRun
from app.models.ai_image_asset import AIImageAsset


def cleanup_orphan_ai_images() -> tuple[int, int]:
    cutoff = datetime.now(timezone.utc) - timedelta(
        days=settings.ai_orphan_asset_retention_days
    )
    db = SessionLocal()
    deleted = 0
    failed = 0

    try:
        assets = (
            db.query(AIImageAsset)
            .outerjoin(
                AIAnalysisRun,
                AIAnalysisRun.image_asset_id == AIImageAsset.id,
            )
            .filter(
                AIAnalysisRun.id.is_(None),
                AIImageAsset.created_at < cutoff,
            )
            .all()
        )

        for asset in assets:
            if delete_storage_object(asset.storage_path):
                db.delete(asset)
                deleted += 1
            else:
                failed += 1

        db.commit()
        return deleted, failed
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    removed, failures = cleanup_orphan_ai_images()
    print(
        f"AI orphan cleanup complete: removed={removed}, "
        f"storage_failures={failures}"
    )
