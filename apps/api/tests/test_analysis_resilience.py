"""Part 3: resilient analysis stage — timeouts, bounded retries, chunking, fallback."""

import httpx
import pytest

from app.services import analysis
from app.services.analysis import generate_action_items, generate_meeting_analysis
from app.services.transcription import TranscriptSegmentResult


def _segments(n=1):
    return [
        TranscriptSegmentResult(i, i * 5.0, i * 5.0 + 5.0, f"Bugün {i}. konuyu konuştuk ve karar verildi.")
        for i in range(n)
    ]


def _enable_ai(monkeypatch):
    monkeypatch.setattr(analysis.settings, "enable_external_ai", True)
    monkeypatch.setattr(analysis.settings, "openrouter_api_key", "test-key")
    monkeypatch.setattr(analysis.time, "sleep", lambda _seconds: None)


class _FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class _FakeClient:
    """A fresh instance is created on every `httpx.Client(...)` call (analysis.py opens a new
    client per attempt), so call state is tracked in a dict shared across all instances."""

    def __init__(self, side_effect, state):
        self._side_effect = side_effect
        self._state = state

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def post(self, *args, **kwargs):
        n = self._state["calls"]
        result = self._side_effect(n)
        self._state["calls"] += 1
        if isinstance(result, Exception):
            raise result
        return result


def _install_fake_client(monkeypatch, side_effect):
    state = {"calls": 0}

    def _factory(*args, **kwargs):
        return _FakeClient(side_effect, state)

    monkeypatch.setattr(analysis.httpx, "Client", _factory)
    return state


def _ok_response(content: str) -> _FakeResponse:
    return _FakeResponse(200, {"choices": [{"message": {"content": content}}]})


VALID_SUMMARY_JSON = (
    '{"summary": "Kısa özet.", "topics": ["konu"], "decisions": [], '
    '"risks": [], "unresolved_questions": [], "follow_ups": []}'
)


# --- no API key ---


def test_no_api_key_returns_local_fallback_without_any_http_call(monkeypatch):
    calls = _install_fake_client(monkeypatch, lambda n: pytest.fail("should not call OpenRouter"))
    result, source, model = generate_meeting_analysis(_segments(2))
    assert source == "fallback"
    assert model is None
    assert calls["calls"] == 0


# --- successful OpenRouter response ---


def test_successful_openrouter_response_is_used_directly(monkeypatch):
    _enable_ai(monkeypatch)
    holder = _install_fake_client(monkeypatch, lambda n: _ok_response(VALID_SUMMARY_JSON))

    result, source, model = generate_meeting_analysis(_segments(2))

    assert source == "openrouter"
    assert model == analysis.settings.openrouter_model
    assert result.summary == "Kısa özet."
    assert holder["calls"] == 1


# --- timeout followed by success ---


def test_timeout_then_success_retries_once_and_succeeds(monkeypatch):
    _enable_ai(monkeypatch)

    def _side_effect(n):
        if n == 0:
            return httpx.TimeoutException("timed out")
        return _ok_response(VALID_SUMMARY_JSON)

    holder = _install_fake_client(monkeypatch, _side_effect)

    result, source, _ = generate_meeting_analysis(_segments(2))

    assert source == "openrouter"
    assert holder["calls"] == 2


# --- rate-limit followed by fallback ---


def test_rate_limit_exhausts_retries_then_falls_back(monkeypatch):
    _enable_ai(monkeypatch)
    holder = _install_fake_client(monkeypatch, lambda n: _FakeResponse(429))

    result, source, model = generate_meeting_analysis(_segments(2))

    assert source == "fallback"
    assert model is None
    # initial attempt + MAX_RETRIES retries, never more
    assert holder["calls"] == analysis.MAX_RETRIES + 1


# --- authentication error: no retry ---


def test_authentication_error_fails_fast_without_retry(monkeypatch):
    _enable_ai(monkeypatch)
    holder = _install_fake_client(monkeypatch, lambda n: _FakeResponse(401))

    result, source, _ = generate_meeting_analysis(_segments(2))

    assert source == "fallback"
    assert holder["calls"] == 1


def test_malformed_request_error_fails_fast_without_retry(monkeypatch):
    _enable_ai(monkeypatch)
    holder = _install_fake_client(monkeypatch, lambda n: _FakeResponse(400))

    analysis._call_openrouter("system", "user")

    assert holder["calls"] == 1


# --- malformed JSON response ---


def test_malformed_json_response_falls_back_after_repair_attempt(monkeypatch):
    _enable_ai(monkeypatch)
    holder = _install_fake_client(monkeypatch, lambda n: _ok_response("bu JSON değil, düz metin"))

    result, source, _ = generate_meeting_analysis(_segments(2))

    assert source == "fallback"
    # one call for the initial attempt, one for the repair attempt
    assert holder["calls"] == 2


# --- long transcript chunking ---


def test_long_transcript_is_split_into_multiple_chunks_and_summarized_hierarchically(monkeypatch):
    _enable_ai(monkeypatch)
    long_segments = [
        TranscriptSegmentResult(i, i * 10.0, i * 10.0 + 10.0, "Bu konu hakkında uzun uzun konuştuk. " * 20)
        for i in range(20)
    ]
    chunks = analysis._split_into_chunks(long_segments)
    assert len(chunks) > 1

    def _side_effect(n):
        return _ok_response(VALID_SUMMARY_JSON)

    holder = _install_fake_client(monkeypatch, _side_effect)

    result, source, _ = generate_meeting_analysis(long_segments)

    assert source == "openrouter"
    # one call per chunk summary + one final combining call
    assert holder["calls"] == len(chunks) + 1


def test_action_items_chunking_merges_and_dedupes_across_chunks(monkeypatch):
    _enable_ai(monkeypatch)
    long_segments = [
        TranscriptSegmentResult(i, i * 10.0, i * 10.0 + 10.0, "Ahmet raporu hazırlayacak. " * 20)
        for i in range(20)
    ]
    items_json = '{"items": [{"description": "Raporu hazırla", "assignee": "Ahmet", "priority": "medium"}]}'
    holder = _install_fake_client(monkeypatch, lambda n: _ok_response(items_json))

    result, source, _ = generate_action_items(long_segments)

    assert source == "openrouter"
    assert len(result.items) == 1  # deduped across chunks
    assert holder["calls"] > 1
