from app.services.qa import NO_EVIDENCE_ANSWER, answer_question
from app.services.transcription import TranscriptSegmentResult


def _segments():
    return [
        TranscriptSegmentResult(0, 0.0, 5.0, "Bütçe onayı için Ahmet cuma günü rapor gönderecek."),
        TranscriptSegmentResult(1, 5.0, 10.0, "Pazarlama ekibi yeni kampanyayı gelecek ay başlatacak."),
    ]


def test_answer_question_returns_no_evidence_for_unrelated_question():
    answer, timestamps, grounded, source, _ = answer_question(_segments(), "Uzay yolculuğu ne zaman başlayacak?")
    assert answer == NO_EVIDENCE_ANSWER
    assert timestamps == []
    assert grounded is False


def test_answer_question_grounds_on_relevant_segment():
    answer, timestamps, grounded, source, _ = answer_question(_segments(), "Raporu kim gönderecek?")
    assert grounded is True
    assert source == "fallback"
    assert "Ahmet" in answer
    assert timestamps
