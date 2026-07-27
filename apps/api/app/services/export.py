import json

from app import models
from app.services.analysis import _format_ts


def transcript_to_txt(meeting: models.Meeting, segments: list[models.TranscriptSegment]) -> str:
    lines = [meeting.title, "=" * len(meeting.title), ""]
    for seg in segments:
        lines.append(f"[{_format_ts(seg.start_time)}] {seg.text}")
    return "\n".join(lines)


def notes_to_markdown(
    meeting: models.Meeting,
    analysis: models.MeetingAnalysis | None,
    action_items: list[models.ActionItem],
) -> str:
    lines = [f"# {meeting.title}", ""]
    # Rendered server-side as static text, so the timestamp is labeled UTC explicitly —
    # unlike the web UI, an exported file can't be converted to the reader's local time.
    lines.append(f"_Oluşturulma tarihi: {meeting.created_at:%d.%m.%Y %H:%M} UTC_")
    lines.append("")

    if analysis and analysis.summary:
        lines += ["## Özet", "", analysis.summary, ""]
        lines += _section("Konular", analysis.topics_json)
        lines += _section("Kararlar", analysis.decisions_json)
        lines += _section("Riskler", analysis.risks_json)
        lines += _section("Cevaplanmamış Sorular", analysis.unresolved_questions_json)
        lines += _section("Takip Edilecekler", analysis.follow_ups_json)
        source_note = (
            "AI modeli ile oluşturuldu."
            if analysis.source == "openrouter"
            else "Yerel özet (AI modeli kullanılmadı) ile oluşturuldu."
        )
        lines += [f"_{source_note}_", ""]
    else:
        lines += ["## Özet", "", "Henüz analiz oluşturulmadı.", ""]

    lines += ["## Yapılacaklar", ""]
    if action_items:
        for item in action_items:
            box = "x" if item.is_completed else " "
            meta = []
            if item.assignee:
                meta.append(f"Sorumlu: {item.assignee}")
            if item.due_date:
                meta.append(f"Tarih: {item.due_date}")
            meta.append(f"Öncelik: {item.priority}")
            lines.append(f"- [{box}] {item.description} ({', '.join(meta)})")
    else:
        lines.append("Yapılacak iş bulunamadı.")

    return "\n".join(lines)


def _section(title: str, json_str: str | None) -> list[str]:
    items = json.loads(json_str) if json_str else []
    if not items:
        return []
    lines = [f"## {title}", ""]
    lines += [f"- {item}" for item in items]
    lines.append("")
    return lines
