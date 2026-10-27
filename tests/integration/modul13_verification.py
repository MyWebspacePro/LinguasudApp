#!/usr/bin/env python3
"""E2E-Verifikation Modul 13 (Aufgaben & Anfragen) gegen http://localhost:3000.

Voraussetzungen:
- Dev-Server läuft (pnpm dev), PostgreSQL via Docker (pnpm db:up).
- Testkonten buero@linguasud.test / admin@linguasud.test (Passwort siehe PASSWORD).
- Python-Playwright mit Chromium installiert.

Ablauf:
1. Öffentlich: Einstufungstest Deutsch (alle Antworten richtig -> B1),
   Ergebnis-Seite, «Anfrage stellen» -> Formular vorbefüllt, Anfrage mit
   m13_-Testdaten absenden, Erfolgsseite.
2. Dev-Log: Bestätigungs- und Büro-Mail prüfen (kein SMTP -> Dev-Log).
3. Verwaltung: Login Büro, Anfrage finden, neue m13_-INTERESSENT-Person
   anlegen und zuordnen, Status «zugeordnet» prüfen.
4. Aufgaben: automatische Aufgabe finden, erledigen, wieder öffnen,
   danach offen lassen (Dashboard-Karte), Dedup prüfen (genau 1 Aufgabe).
5. Dashboard: Karte «Aufgaben & Anfragen» sichtbar.
6. DB: Anfrage/Person/Aufgabe/Audit prüfen.
"""

import os
import subprocess
import sys

from playwright.sync_api import expect, sync_playwright

BASE = "http://localhost:3000"
BUREAU_EMAIL = "buero@linguasud.test"
PASSWORD = "Modul8TestPasswort2026!"
DEV_LOG = "/tmp/linguasud-dev.log"
NAME = "m13_Testinteressent Mustermann"
EMAIL = "m13-test@linguasud.test"
TELEFON = "+41 79 123 45 67"
NACHRICHT = "m13_ Testanfrage: Ich möchte einen Deutschkurs auf Niveau B1 besuchen."
VORNAME = "m13_Vorname"
NACHNAME = "m13_Nachname"


def psql(sql: str) -> str:
    """Führt SQL im lokalen Docker-Postgres aus (nur für Verifikation)."""
    result = subprocess.run(
        [
            "docker",
            "exec",
            "linguasudapp-db-1",
            "psql",
            "-U",
            "linguasud",
            "-d",
            "linguasud",
            "-t",
            "-A",
            "-c",
            sql,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql-Fehler: {result.stderr.strip()}")
    return result.stdout.strip()


def cleanup_previous_test_data() -> None:
    """Räumt frühere m13_-Läufe auf, damit der Test wiederholbar ist."""
    psql(
        """
        DELETE FROM "Aufgabe" WHERE "anfrageId" IN (
            SELECT id FROM "Anfrage" WHERE email = 'm13-test@linguasud.test'
        );
        DELETE FROM "AuditLog" WHERE "entityId" IN (
            SELECT id FROM "Anfrage" WHERE email = 'm13-test@linguasud.test'
        ) OR "entityId" IN (
            SELECT id FROM "Person" WHERE "vorname" LIKE 'm13\\_%' OR "nachname" LIKE 'm13\\_%'
        );
        DELETE FROM "Anfrage" WHERE email = 'm13-test@linguasud.test';
        DELETE FROM "Person" WHERE "vorname" LIKE 'm13\\_%' OR "nachname" LIKE 'm13\\_%';
        DELETE FROM "PublicFormVersuch"
        WHERE email = 'm13-test@linguasud.test' OR ip IN ('127.0.0.1', '::1');
        """
    )


def main() -> int:
    cleanup_previous_test_data()

    # Fragen + Sprache aus der DB lesen (IDs sind DB-generiert).
    sprache_id = psql("SELECT id FROM \"Sprache\" WHERE name = 'Deutsch' AND active;")
    rows = psql(
        """
        SELECT f.id || '|' || f.richtig
        FROM "Einstufungsfrage" f
        JOIN "Sprache" s ON s.id = f."spracheId"
        JOIN "Niveau" n ON n.id = f."niveauId"
        WHERE s.name = 'Deutsch' AND f.active
        ORDER BY n."sortOrder", f."sortOrder";
        """
    )
    fragen = [line.split("|") for line in rows.splitlines() if line.strip()]
    assert fragen, "Keine aktiven Deutsch-Fragen gefunden"
    print(f"Sprache Deutsch: {sprache_id}, {len(fragen)} Fragen")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(base_url=BASE)
        page = context.new_page()

        # ——— 1. Öffentlicher Einstufungstest ———
        page.goto(f"/einstufungstest/{sprache_id}", wait_until="networkidle")
        expect(page.get_by_text("Niveau A1", exact=False).first).to_be_visible(timeout=15000)
        for frage_id, richtig in fragen:
            page.check(f'input[name="f_{frage_id}"][value="{richtig}"]')
        page.get_by_role("button", name="Test abschliessen").click()
        page.wait_for_url("**/einstufungstest/ergebnis**", timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.get_by_text("Niveau B1", exact=True).first).to_be_visible(timeout=15000)
        print("✓ Einstufungstest ausgewertet: Empfehlung B1")

        # ——— 2. Weiterleitung ins Anfrage-Formular (vorbefüllt) ———
        page.get_by_role("link", name="Anfrage stellen").click()
        page.wait_for_url("**/anfrage**", timeout=15000)
        expect(page.get_by_text("Empfehlung aus Ihrem Einstufungstest: Niveau B1", exact=False)).to_be_visible()
        page.fill("#oa-name", NAME)
        page.fill("#oa-email", EMAIL)
        page.fill("#oa-telefon", TELEFON)
        page.fill("#oa-nachricht", NACHRICHT)
        log_start = os.path.getsize(DEV_LOG) if os.path.exists(DEV_LOG) else 0
        page.get_by_role("button", name="Anfrage absenden").click()
        page.wait_for_url("**/anfrage/erfolg**", timeout=20000)
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.get_by_role("heading", name="Besten Dank für Ihre Anfrage")).to_be_visible(timeout=15000)
        print("✓ Öffentliche Anfrage abgesendet, Erfolgsseite erreicht")

        # ——— 3. Dev-Log-Mails prüfen (kein SMTP) ———
        page.wait_for_timeout(2000)
        with open(DEV_LOG, encoding="utf-8", errors="replace") as f:
            f.seek(log_start)
            log = f.read()
        assert "Ihre Anfrage bei der Sprachschule linguasud" in log, "Bestätigungs-Mail fehlt im Dev-Log"
        assert f"Neue Anfrage von {NAME}" in log, "Büro-Benachrichtigung fehlt im Dev-Log"
        print("✓ Bestätigungs- und Büro-Mail im Dev-Log gefunden")

        # ——— 4. Verwaltung: Login Büro ———
        page.goto("/login", wait_until="networkidle")
        page.fill("#login-email", BUREAU_EMAIL)
        page.fill("#login-password", PASSWORD)
        page.get_by_role("button", name="Anmelden").click()
        page.wait_for_url("**/dashboard**", timeout=20000)
        expect(page.get_by_text("Aufgaben & Anfragen", exact=False).first).to_be_visible(timeout=15000)
        print("✓ Login Büro erfolgreich, Dashboard-Karte sichtbar")

        # ——— 5. Anfrage finden und Person zuordnen ———
        page.goto("/anfragen", wait_until="networkidle")
        page.get_by_role("link", name=NAME).click()
        page.wait_for_url("**/anfragen/**", timeout=15000)
        expect(page.get_by_text("Gewünschtes Niveau:", exact=False).first).to_be_visible()
        page.select_option('select[name="anrede"]', "FRAU")
        page.fill('input[name="vorname"]', VORNAME)
        page.fill('input[name="nachname"]', NACHNAME)
        page.get_by_role("button", name="Anlegen & zuordnen").click()
        expect(page.get_by_text("zugeordnet", exact=True).first).to_be_visible(timeout=20000)
        print("✓ Anfrage einer neuen m13_-INTERESSENT-Person zugeordnet")

        # ——— 6. Automatische Aufgabe erledigen / wieder öffnen ———
        # Nach der Zuordnung ist die Automatik-Aufgabe bereits erledigt — im Erledigt-Filter suchen.
        page.goto("/aufgaben?status=erledigt", wait_until="networkidle")
        expect(page.get_by_text(f"Neue Anfrage von {NAME}", exact=False).first).to_be_visible(timeout=15000)
        page.get_by_role("link", name=f"Neue Anfrage von {NAME}").click()
        page.wait_for_url("**/aufgaben/**", timeout=15000)
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.get_by_text("Fälligkeit:", exact=False).first).to_be_visible(timeout=15000)
        # Die Zuordnung erledigt die Automatik-Aufgabe automatisch: erst wieder
        # öffnen, dann erledigen, dann offen lassen (Dashboard-Karte).
        expect(page.get_by_role("button", name="Wieder öffnen", exact=True)).to_be_visible(timeout=20000)
        page.get_by_role("button", name="Wieder öffnen", exact=True).click()
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.get_by_role("button", name="Erledigt", exact=True)).to_be_visible(timeout=20000)
        page.get_by_role("button", name="Erledigt", exact=True).click()
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.get_by_role("button", name="Wieder öffnen", exact=True)).to_be_visible(timeout=20000)
        page.get_by_role("button", name="Wieder öffnen", exact=True).click()
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.get_by_role("button", name="Erledigt", exact=True)).to_be_visible(timeout=20000)
        print("✓ Aufgabe wieder geöffnet, erledigt und erneut geöffnet (bleibt offen für Dashboard)")

        # ——— 7. Dashboard-Karte erneut prüfen ———
        page.goto("/dashboard", wait_until="networkidle")
        expect(page.get_by_text("Aufgaben & Anfragen", exact=False).first).to_be_visible(timeout=15000)
        print("✓ Dashboard-Karte «Aufgaben & Anfragen» bestätigt")

        context.close()
        browser.close()

    # ——— 8. DB-Verifikation ———
    anfrage = psql(
        """
        SELECT a.id || '|' || a.status || '|' || COALESCE(a."personId", '') || '|' ||
               COALESCE(a."bestaetigtVia", '') || '|' || COALESCE(n.code, '')
        FROM "Anfrage" a
        LEFT JOIN "Niveau" n ON n.id = a."empfohlenesNiveauId"
        WHERE a.email = 'm13-test@linguasud.test'
        ORDER BY a."createdAt" DESC LIMIT 1;
        """
    )
    anfrage_id, status, person_id, bestaetigt_via, empfohlen = anfrage.split("|")
    assert status == "ZUGEORDNET", f"Anfrage-Status unerwartet: {status}"
    assert person_id, "Anfrage ist keiner Person zugeordnet"
    assert bestaetigt_via == "devlog", f"bestaetigtVia unerwartet: {bestaetigt_via}"
    assert empfohlen == "B1", f"Empfohlenes Niveau unerwartet: {empfohlen}"
    print(f"✓ DB Anfrage: Status ZUGEORDNET, bestaetigtVia devlog, Empfehlung B1 ({anfrage_id})")

    person = psql(
        f"""
        SELECT "anrede" || '|' || "vorname" || '|' || "nachname" || '|' || "status"
        FROM "Person" WHERE id = '{person_id}';
        """
    )
    anrede, vorname, nachname, person_status = person.split("|")
    assert anrede == "FRAU" and vorname == VORNAME and nachname == NACHNAME, f"Person unerwartet: {person}"
    assert person_status == "INTERESSENT", f"Person-Status unerwartet: {person_status}"
    print(f"✓ DB Person: {anrede} {vorname} {nachname}, Status INTERESSENT")

    aufgaben = psql(
        f"""
        SELECT a.id || '|' || a."status" || '|' || COALESCE(a."quelle", '') || '|' || COALESCE(a."dedupKey", '')
        FROM "Aufgabe" a WHERE a."anfrageId" = '{anfrage_id}';
        """
    )
    aufgabe_rows = [line for line in aufgaben.splitlines() if line.strip()]
    assert len(aufgabe_rows) == 1, f"Dedup verletzt: {len(aufgabe_rows)} Aufgaben für die Anfrage"
    aufgabe_id, auf_status, quelle, dedup_key = aufgabe_rows[0].split("|")
    assert auf_status == "OFFEN", f"Aufgabe-Status unerwartet: {auf_status}"
    assert quelle == "anfrage" and dedup_key == f"anfrage:{anfrage_id}", f"Aufgabe-Metadaten unerwartet: {aufgabe_rows[0]}"
    print("✓ DB Aufgabe: genau 1 Aufgabe (dedupKey anfrage:<id>), Status offen")

    audits = psql(
        f"""
        SELECT string_agg(DISTINCT "action", ', ' ORDER BY "action")
        FROM "AuditLog"
        WHERE "entityId" IN ('{anfrage_id}', '{person_id}', '{aufgabe_id}');
        """
    )
    for erwartet in (
        "anfrage.eingegangen",
        "anfrage.neue_person",
        "person.create",
        "aufgabe.automatisch_angelegt",
        "aufgabe.erledigt",
        "aufgabe.wieder_geoeffnet",
    ):
        assert erwartet in audits, f"Audit-Action fehlt: {erwartet} (vorhanden: {audits})"
    print(f"✓ DB Audit: {audits}")

    print("\nALLE VERIFIKATIONEN ERFOLGREICH")
    return 0


if __name__ == "__main__":
    sys.exit(main())
