from pydantic import SecretStr
import pytest

import app.core.storage as storage
from app.core.config import Settings


class _FakeBucket:
    def __init__(self):
        self.removed = []

    def remove(self, paths):
        self.removed.extend(paths)
        return {"data": paths}


class _FakeStorage:
    def __init__(self, bucket):
        self.bucket = bucket

    def from_(self, _name):
        return self.bucket


class _FakeClient:
    def __init__(self, bucket):
        self.storage = _FakeStorage(bucket)


def _settings(**overrides):
    values = {
        "database_url": "postgresql+psycopg2://user:pass@localhost/db",
        "secret_key": SecretStr("x" * 40),
        "ai_max_retries": 2,
        "ai_orphan_asset_retention_days": 7,
    }
    values.update(overrides)
    return Settings(**values)


def test_external_url_is_preserved_but_not_deleted(monkeypatch):
    external = "https://example.com/patient.jpg"
    assert storage.clean_storage_path(external) == external

    def unexpected_client():
        raise AssertionError("external URLs must not be deleted from Supabase")

    monkeypatch.setattr(storage, "get_supabase_client", unexpected_client)
    assert storage.delete_storage_object(external) is True


def test_delete_storage_object_uses_clean_private_path(monkeypatch):
    bucket = _FakeBucket()
    monkeypatch.setattr(
        storage,
        "get_supabase_client",
        lambda: _FakeClient(bucket),
    )

    path = "skin-analyses/patient-9/appointment-5/image.jpg"
    assert storage.delete_storage_object(path) is True
    assert bucket.removed == [path]


def test_ai_retry_and_retention_settings_are_bounded():
    settings = _settings(ai_max_retries=3, ai_orphan_asset_retention_days=30)
    assert settings.ai_max_retries == 3
    assert settings.ai_orphan_asset_retention_days == 30

    with pytest.raises(ValueError):
        _settings(ai_max_retries=6)

    with pytest.raises(ValueError):
        _settings(ai_orphan_asset_retention_days=0)
