def _create_meeting(client, title="Test Toplantısı"):
    resp = client.post("/api/meetings", json={"title": title, "source_type": "upload", "language": "tr"})
    assert resp.status_code == 201
    return resp.json()


def test_create_and_get_meeting(client):
    meeting = _create_meeting(client)
    assert meeting["title"] == "Test Toplantısı"
    assert meeting["status"] == "uploaded"


def test_meeting_timestamps_are_timezone_aware_utc(client):
    # A naive (offset-less) timestamp is misread as local time by the frontend's
    # `new Date(iso)`, skewing every displayed "x saat önce" by the browser's UTC offset.
    meeting = _create_meeting(client)
    assert meeting["created_at"].endswith("+00:00") or meeting["created_at"].endswith("Z")
    assert meeting["updated_at"].endswith("+00:00") or meeting["updated_at"].endswith("Z")

    resp = client.get(f"/api/meetings/{meeting['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == meeting["id"]


def test_get_missing_meeting_returns_404(client):
    resp = client.get("/api/meetings/does-not-exist")
    assert resp.status_code == 404


def test_list_meetings(client):
    _create_meeting(client, "Toplantı A")
    _create_meeting(client, "Toplantı B")

    resp = client.get("/api/meetings")
    assert resp.status_code == 200
    titles = {m["title"] for m in resp.json()}
    assert {"Toplantı A", "Toplantı B"}.issubset(titles)


def test_update_meeting_title(client):
    meeting = _create_meeting(client)
    resp = client.patch(f"/api/meetings/{meeting['id']}", json={"title": "Yeni Başlık"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Yeni Başlık"


def test_update_meeting_title_empty_rejected(client):
    meeting = _create_meeting(client)
    resp = client.patch(f"/api/meetings/{meeting['id']}", json={"title": "   "})
    assert resp.status_code == 400


def test_delete_meeting(client):
    meeting = _create_meeting(client)
    resp = client.delete(f"/api/meetings/{meeting['id']}")
    assert resp.status_code == 204

    resp = client.get(f"/api/meetings/{meeting['id']}")
    assert resp.status_code == 404


def test_upload_rejects_unsupported_extension(client):
    meeting = _create_meeting(client)
    resp = client.post(
        f"/api/meetings/{meeting['id']}/media",
        files={"file": ("gizli.exe", b"fake binary content", "application/octet-stream")},
    )
    assert resp.status_code == 400
    assert "Desteklenmeyen dosya" in resp.json()["detail"]


def test_upload_rejects_empty_file(client):
    meeting = _create_meeting(client)
    resp = client.post(
        f"/api/meetings/{meeting['id']}/media",
        files={"file": ("ses.wav", b"", "audio/wav")},
    )
    assert resp.status_code == 400


def test_upload_accepts_supported_extension(client):
    meeting = _create_meeting(client)
    resp = client.post(
        f"/api/meetings/{meeting['id']}/media",
        files={"file": ("ses.wav", b"RIFF....WAVEfmt fake audio bytes", "audio/wav")},
    )
    assert resp.status_code == 200
    assert resp.json()["has_audio"] is True


def test_action_item_crud(client):
    meeting = _create_meeting(client)

    resp = client.post(
        f"/api/meetings/{meeting['id']}/action-items",
        json={"description": "Sunumu hazırla", "priority": "high"},
    )
    assert resp.status_code == 201
    item = resp.json()
    assert item["source"] == "manual"
    assert item["is_completed"] is False

    resp = client.patch(
        f"/api/meetings/{meeting['id']}/action-items/{item['id']}",
        json={"is_completed": True},
    )
    assert resp.status_code == 200
    assert resp.json()["is_completed"] is True

    resp = client.delete(f"/api/meetings/{meeting['id']}/action-items/{item['id']}")
    assert resp.status_code == 204

    resp = client.get(f"/api/meetings/{meeting['id']}/action-items")
    assert resp.json() == []


def test_process_without_media_rejected(client):
    meeting = _create_meeting(client)
    resp = client.post(f"/api/meetings/{meeting['id']}/process")
    assert resp.status_code == 400


def test_regenerate_analysis_while_already_processing_returns_409(client):
    from app import models
    from app.database import SessionLocal

    meeting = _create_meeting(client)
    db = SessionLocal()
    try:
        row = db.query(models.Meeting).filter(models.Meeting.id == meeting["id"]).first()
        row.status = "processing"
        db.commit()
    finally:
        db.close()

    resp = client.post(f"/api/meetings/{meeting['id']}/analyze")
    assert resp.status_code == 409
    assert "zaten işleniyor" in resp.json()["detail"]
