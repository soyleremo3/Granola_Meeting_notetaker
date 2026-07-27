from app.services.analysis import _extract_json, generate_action_items, generate_meeting_analysis
from app.services.transcription import TranscriptSegmentResult


def _segments():
    return [
        TranscriptSegmentResult(0, 0.0, 5.0, "Bugün proje durumunu konuşacağız ve karar verildi ki yeni sürüm çıkacak."),
        TranscriptSegmentResult(1, 5.0, 10.0, "Ahmet raporu hazırlayacak ve cuma günü gönderecek."),
        TranscriptSegmentResult(2, 10.0, 15.0, "Bütçe konusunda hala bir risk var, net değil."),
        TranscriptSegmentResult(3, 15.0, 20.0, "Bu konuyu netleştirmemiz gerekiyor mu?"),
    ]


def test_generate_meeting_analysis_uses_local_fallback_when_ai_disabled():
    result, source, model_name = generate_meeting_analysis(_segments())
    assert source == "fallback"
    assert model_name is None
    assert result.summary


def test_generate_action_items_uses_local_fallback_when_ai_disabled():
    result, source, model_name = generate_action_items(_segments())
    assert source == "fallback"
    assert any("gönder" in item.description.lower() or "hazırla" in item.description.lower() for item in result.items)


def test_generate_meeting_analysis_empty_transcript():
    result, source, _ = generate_meeting_analysis([])
    assert source == "fallback"
    assert result.summary == ""


def test_extract_json_handles_code_fence():
    raw = '```json\n{"summary": "test"}\n```'
    data = _extract_json(raw)
    assert data == {"summary": "test"}


def test_extract_json_handles_surrounding_text():
    raw = 'İşte sonuç: {"summary": "test"} - bitti'
    data = _extract_json(raw)
    assert data == {"summary": "test"}
