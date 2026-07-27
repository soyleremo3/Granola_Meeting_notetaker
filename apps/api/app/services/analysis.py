"""Meeting analysis: OpenRouter LLM with a local extractive fallback.

The fallback never claims to be an LLM-quality summary — callers must surface
`source == "fallback"` to the user so expectations stay honest.
"""

import json
import re

import httpx
from pydantic import ValidationError

from app.config import settings
from app.schemas import ActionItemListLLM, AnalysisLLMResult

SUMMARY_SYSTEM_PROMPT = """Sen bir toplantı analiz asistanısın. Sana Türkçe bir toplantı dökümü verilecek.
Yalnızca dökümde GEÇEN bilgilere dayanarak analiz yap. Bilgi yoksa uydurma, ilgili alanı boş bırak.
Yanıtını SADECE aşağıdaki alanlara sahip geçerli bir JSON nesnesi olarak ver, başka hiçbir metin ekleme:
{
  "summary": "kısa yönetici özeti (2-4 cümle, Türkçe)",
  "topics": ["ana konu 1", "ana konu 2"],
  "decisions": ["alınan karar 1"],
  "risks": ["risk veya belirsizlik 1"],
  "unresolved_questions": ["cevaplanmamış soru 1"],
  "follow_ups": ["takip edilmesi gereken madde 1"]
}
Tüm liste elemanları ve metinler Türkçe olmalı. Dökümde olmayan bilgiyi asla ekleme."""

ACTION_ITEMS_SYSTEM_PROMPT = """Sen bir toplantı dökümünden yapılacaklar listesi çıkaran bir asistansın.
Yalnızca dökümde açıkça belirtilen görevleri çıkar. Atanan kişi veya tarih dökümde açıkça geçmiyorsa null bırak, ASLA uydurma.
Yanıtını SADECE aşağıdaki formatta geçerli bir JSON nesnesi olarak ver:
{
  "items": [
    {
      "description": "yapılacak iş (Türkçe)",
      "assignee": "isim veya null",
      "due_date": "tarih ifadesi veya null",
      "priority": "low" | "medium" | "high",
      "source_timestamp": saniye_cinsinden_sayı_veya_null,
      "confidence": 0.0 ile 1.0 arası sayı
    }
  ]
}"""


def build_transcript_text(segments: list, max_chars: int = 12000) -> str:
    lines = []
    for seg in segments:
        ts = f"[{_format_ts(seg.start_time)}]"
        lines.append(f"{ts} {seg.text}")
    text = "\n".join(lines)
    if len(text) > max_chars:
        text = text[:max_chars] + "\n...(döküm kısaltıldı)"
    return text


def _format_ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.DOTALL)
    if fence_match:
        raw = fence_match.group(1)
    else:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start : end + 1]
    return json.loads(raw)


def _call_openrouter(system_prompt: str, user_content: str) -> str | None:
    if not settings.ai_enabled:
        return None
    try:
        with httpx.Client(timeout=90) as client:
            resp = client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openrouter_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception:
        return None


def generate_meeting_analysis(segments: list) -> tuple[AnalysisLLMResult, str, str | None]:
    transcript_text = build_transcript_text(segments)

    if not transcript_text.strip():
        return AnalysisLLMResult(), "fallback", None

    raw = _call_openrouter(SUMMARY_SYSTEM_PROMPT, transcript_text)
    if raw:
        result = _parse_with_repair(raw, AnalysisLLMResult, SUMMARY_SYSTEM_PROMPT, transcript_text)
        if result is not None:
            return result, "openrouter", settings.openrouter_model

    return _fallback_summary(segments), "fallback", None


def generate_action_items(segments: list) -> tuple[ActionItemListLLM, str, str | None]:
    transcript_text = build_transcript_text(segments)

    if not transcript_text.strip():
        return ActionItemListLLM(), "fallback", None

    raw = _call_openrouter(ACTION_ITEMS_SYSTEM_PROMPT, transcript_text)
    if raw:
        result = _parse_with_repair(raw, ActionItemListLLM, ACTION_ITEMS_SYSTEM_PROMPT, transcript_text)
        if result is not None:
            return result, "openrouter", settings.openrouter_model

    return _fallback_action_items(segments), "fallback", None


def _parse_with_repair(raw: str, model_cls, system_prompt: str, user_content: str):
    for attempt_raw in (raw, None):
        if attempt_raw is None:
            # One repair attempt: ask the model again with a stricter reminder.
            attempt_raw = _call_openrouter(
                system_prompt + "\n\nÖNEMLİ: Yanıtın SADECE geçerli JSON olmalı, başka hiçbir şey yazma.",
                user_content,
            )
            if not attempt_raw:
                return None
        try:
            data = _extract_json(attempt_raw)
            return model_cls.model_validate(data)
        except (json.JSONDecodeError, ValidationError):
            continue
    return None


# --- Local fallback (no external AI) ---

_STOPWORDS = {
    "ve",
    "bir",
    "bu",
    "şu",
    "o",
    "ile",
    "de",
    "da",
    "için",
    "gibi",
    "ama",
    "fakat",
    "çok",
    "daha",
    "en",
    "ki",
    "mi",
    "mı",
    "mu",
    "mü",
    "ne",
    "her",
    "ya",
    "veya",
}

_TASK_CUES = re.compile(
    r"\b(yapılacak|yapmalı|yapmam|yapman|yapması|hazırla\w*|gönder\w*|tamamla\w*|kontrol et\w*|"
    r"planla\w*|iletişime geç\w*|toplantı ayarla\w*|takip et\w*|gözden geçir\w*|güncelle\w*|bitirmeli\w*|"
    r"teslim|deadline|son tarih|todo|to-do)",
    re.IGNORECASE,
)

# A capitalized first word is treated as a possible assignee name, unless it's one of these
# common Turkish sentence-starters that are capitalized only because they open a sentence.
_NON_NAME_SENTENCE_STARTERS = {
    "ayrıca",
    "ancak",
    "fakat",
    "ama",
    "son",
    "ilk",
    "eğer",
    "çünkü",
    "yani",
    "şimdi",
    "peki",
    "tamam",
    "genel",
    "bugün",
    "yarın",
    "bunun",
    "bunu",
    "böylece",
    "sonra",
    "önce",
    "şu",
    "bu",
    "biz",
    "ben",
    "sen",
    "onlar",
    "herkes",
    "kimse",
    # Common meeting-vocabulary nouns that are capitalized only as sentence-starters —
    # excluded so they aren't mistaken for a person's name.
    "rapor",
    "toplantı",
    "proje",
    "bütçe",
    "ekip",
    "takım",
    "sistem",
    "ürün",
    "müşteri",
    "sunum",
    "görev",
    "plan",
    "departman",
    "sözleşme",
    "teklif",
    "test",
    "tasarım",
    "doküman",
    "belge",
    "veri",
    "sonuç",
    "durum",
}

_ASSIGNEE_PATTERN = re.compile(r"^([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)\b")

_DUE_DATE_PATTERN = re.compile(
    r"\b(bugün|yarın|öbür gün|pazartesi(?:ye|si)?|salı(?:ya)?|çarşamba(?:ya)?|perşembe(?:ye)?|"
    r"cuma(?:ya)?|cumartesi(?:ye)?|pazar(?:a)?|bu hafta|gelecek hafta|önümüzdeki hafta|"
    r"bu ay|gelecek ay|önümüzdeki ay)\b",
    re.IGNORECASE,
)


def _extract_assignee(text: str) -> str | None:
    """Best-effort local heuristic: a capitalized leading word that isn't a stopword or a
    common sentence-starter is treated as an explicit name. Never guesses when absent."""
    match = _ASSIGNEE_PATTERN.match(text.strip())
    if not match:
        return None
    candidate = match.group(1)
    lowered = candidate.lower()
    if lowered in _STOPWORDS or lowered in _NON_NAME_SENTENCE_STARTERS or len(candidate) < 2:
        return None
    return candidate


def _extract_due_date(text: str) -> str | None:
    match = _DUE_DATE_PATTERN.search(text)
    return match.group(1).capitalize() if match else None


def _fallback_summary(segments: list) -> AnalysisLLMResult:
    full_text = " ".join(s.text for s in segments)
    sentences = re.split(r"(?<=[.!?])\s+", full_text.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 15]

    if not sentences:
        return AnalysisLLMResult(summary="Dökümde yeterli metin bulunamadı.")

    scored = _score_sentences(sentences)
    top_sentences = [s for s, _ in scored[:4]]
    top_sentences.sort(key=sentences.index)
    summary = " ".join(top_sentences)

    topic_candidates = [s for s, _ in scored[:6]]
    topics = [_shorten(s) for s in topic_candidates[:5]]

    decision_pattern = re.compile(r"\b(karar verildi|karara vardık|onaylandı|kabul edildi)\b", re.IGNORECASE)
    decisions = [_shorten(s) for s in sentences if decision_pattern.search(s)][:5]

    risk_pattern = re.compile(r"\b(risk|sorun|problem|endişe|gecikme|belirsiz)\b", re.IGNORECASE)
    risks = [_shorten(s) for s in sentences if risk_pattern.search(s)][:5]

    question_sentences = [s for s in sentences if s.strip().endswith("?")]
    unresolved = [_shorten(s) for s in question_sentences][:5]

    return AnalysisLLMResult(
        summary=summary,
        topics=topics,
        decisions=decisions,
        risks=risks,
        unresolved_questions=unresolved,
        follow_ups=[],
    )


def _score_sentences(sentences: list[str]) -> list[tuple[str, float]]:
    from collections import Counter

    word_freq: Counter = Counter()
    for s in sentences:
        for w in re.findall(r"[a-zçğıöşü0-9]+", s.lower()):
            if w not in _STOPWORDS and len(w) > 2:
                word_freq[w] += 1

    scored = []
    for s in sentences:
        words = [w for w in re.findall(r"[a-zçğıöşü0-9]+", s.lower()) if w not in _STOPWORDS]
        score = sum(word_freq[w] for w in words) / (len(words) + 1)
        scored.append((s, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def _shorten(text: str, max_len: int = 180) -> str:
    text = text.strip()
    return text if len(text) <= max_len else text[: max_len - 1].rstrip() + "…"


def _fallback_action_items(segments: list) -> ActionItemListLLM:
    from app.schemas import ActionItemLLM

    items = []
    for seg in segments:
        if _TASK_CUES.search(seg.text):
            items.append(
                ActionItemLLM(
                    description=_shorten(seg.text, 300),
                    assignee=_extract_assignee(seg.text),
                    due_date=_extract_due_date(seg.text),
                    priority="medium",
                    source_timestamp=seg.start_time,
                    confidence=0.35,
                )
            )
    return ActionItemListLLM(items=items[:20])
