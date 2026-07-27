"""Seed or clear demo data. Run with: python -m app.seed [seed|clear]"""

import json
import sys
from datetime import UTC, datetime, timedelta

from app import models
from app.database import SessionLocal, init_db

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

DEMO_SEGMENTS = [
    (0.0, 6.0, "Merhaba arkadaşlar, bugünkü haftalık ürün toplantımıza hoş geldiniz."),
    (6.0, 14.0, "Geçen hafta konuştuğumuz mobil uygulama performans sorununu konuşarak başlayalım."),
    (
        14.0,
        24.0,
        "Performans testlerinde ana sayfa açılış süresinin üç saniyeye kadar çıktığını gördük, bu bir risk oluşturuyor.",
    ),
    (24.0, 33.0, "Bu sorunu çözmek için resim boyutlarını küçültmemiz ve önbellekleme eklememiz gerekiyor."),
    (33.0, 40.0, "Ahmet bu görevi bu hafta cuma gününe kadar tamamlamayı kabul etti."),
    (40.0, 48.0, "Karar verildi: yeni sürümde önbellekleme sistemi zorunlu olarak devreye alınacak."),
    (48.0, 58.0, "Ayrıca kullanıcı geri bildirimlerinde bildirim ayarlarının karmaşık olduğu belirtilmiş."),
    (58.0, 66.0, "Bildirim ayarları ekranını basitleştirmek için Elif bir tasarım taslağı hazırlayacak."),
    (66.0, 74.0, "Elif taslağı gelecek salı gününe kadar paylaşacak, tarih üzerinde anlaştık."),
    (
        74.0,
        82.0,
        "Bir risk olarak, üçüncü parti bildirim servisinin fiyatlandırması hakkında hâlâ belirsizlik var.",
    ),
    (
        82.0,
        90.0,
        "Bu konuda satın alma ekibiyle görüşüp görüşmediğimiz henüz netleşmedi, bunu araştırmamız lazım.",
    ),
    (90.0, 98.0, "Son olarak, önümüzdeki sprint planlamasını gelecek pazartesi yapacağız."),
    (98.0, 104.0, "Herkese katılımı için teşekkür ederim, toplantıyı burada bitiriyoruz."),
]

DEMO_SUMMARY = (
    "Ekip, mobil uygulamanın ana sayfa açılış performansını ve bildirim ayarlarının "
    "kullanılabilirliğini görüştü. Performans için önbellekleme kararı alındı, bildirim "
    "ayarları için yeni bir tasarım taslağı hazırlanacak."
)


def seed_demo_data() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(models.Meeting).filter(models.Meeting.is_demo.is_(True)).first()
        if existing:
            print("Demo verisi zaten mevcut. Önce 'clear' komutunu çalıştırın.")
            return

        meeting = models.Meeting(
            title="Haftalık Ürün Toplantısı (Demo)",
            source_type="upload",
            language="tr",
            status="ready",
            is_demo=True,
            duration_seconds=104.0,
            created_at=datetime.now(UTC) - timedelta(days=1),
        )
        db.add(meeting)
        db.flush()

        for idx, (start, end, text) in enumerate(DEMO_SEGMENTS):
            db.add(
                models.TranscriptSegment(
                    meeting_id=meeting.id, index=idx, start_time=start, end_time=end, text=text
                )
            )

        db.add(
            models.MeetingAnalysis(
                meeting_id=meeting.id,
                summary=DEMO_SUMMARY,
                topics_json=json.dumps(
                    [
                        "Mobil uygulama performansı",
                        "Bildirim ayarları kullanılabilirliği",
                        "Sprint planlaması",
                    ],
                    ensure_ascii=False,
                ),
                decisions_json=json.dumps(
                    ["Yeni sürümde önbellekleme sistemi zorunlu olarak devreye alınacak."], ensure_ascii=False
                ),
                risks_json=json.dumps(
                    ["Üçüncü parti bildirim servisinin fiyatlandırması hâlâ belirsiz."], ensure_ascii=False
                ),
                unresolved_questions_json=json.dumps(
                    ["Satın alma ekibiyle bildirim servisi fiyatlandırması görüşüldü mü?"], ensure_ascii=False
                ),
                follow_ups_json=json.dumps(
                    ["Gelecek pazartesi sprint planlaması yapılacak."], ensure_ascii=False
                ),
                source="fallback",
            )
        )

        db.add_all(
            [
                models.ActionItem(
                    meeting_id=meeting.id,
                    description="Ana sayfa resim boyutlarını küçültüp önbellekleme ekle.",
                    assignee="Ahmet",
                    due_date="Cuma",
                    priority="high",
                    source_timestamp=33.0,
                    confidence=0.9,
                    source="ai",
                ),
                models.ActionItem(
                    meeting_id=meeting.id,
                    description="Bildirim ayarları ekranı için tasarım taslağı hazırla.",
                    assignee="Elif",
                    due_date="Salı",
                    priority="medium",
                    source_timestamp=66.0,
                    confidence=0.85,
                    source="ai",
                ),
                models.ActionItem(
                    meeting_id=meeting.id,
                    description="Bildirim servisi fiyatlandırmasını satın alma ekibiyle netleştir.",
                    assignee=None,
                    due_date=None,
                    priority="medium",
                    source_timestamp=90.0,
                    confidence=0.6,
                    source="ai",
                ),
            ]
        )

        db.commit()
        print(f"Demo toplantısı oluşturuldu: {meeting.id}")
    finally:
        db.close()


def clear_demo_data() -> None:
    init_db()
    db = SessionLocal()
    try:
        demo_meetings = db.query(models.Meeting).filter(models.Meeting.is_demo.is_(True)).all()
        if not demo_meetings:
            print("Silinecek demo verisi bulunamadı.")
            return
        for m in demo_meetings:
            db.delete(m)
        db.commit()
        print(f"{len(demo_meetings)} demo toplantısı silindi.")
    finally:
        db.close()


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if action == "seed":
        seed_demo_data()
    elif action == "clear":
        clear_demo_data()
    else:
        print("Kullanım: python -m app.seed [seed|clear]")
