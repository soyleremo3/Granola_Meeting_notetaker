def test_health_check(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["ai_enabled"] is False


def test_health_check_never_exposes_api_key(client):
    resp = client.get("/health")
    body = resp.text
    from app.config import settings

    if settings.openrouter_api_key:
        assert settings.openrouter_api_key not in body


def test_health_check_reports_no_active_model_when_ai_disabled(client):
    resp = client.get("/health")
    data = resp.json()
    assert data["ai_enabled"] is False
    assert data["openrouter_model"] is None
    assert data["local_fallback_available"] is True


def test_health_check_reports_active_model_when_ai_enabled(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "enable_external_ai", True)
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")

    resp = client.get("/health")
    data = resp.json()
    assert data["ai_enabled"] is True
    assert data["openrouter_model"] == settings.openrouter_model
    assert data["local_fallback_available"] is True
