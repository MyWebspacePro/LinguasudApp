#!/usr/bin/env python3
"""E2E-Verifikation Modul 15 (Öffentliche Website / CMS) gegen http://localhost:3000.

Voraussetzungen:
- Dev-Server läuft (pnpm dev, Log unter /tmp/linguasud-dev.log), PostgreSQL via Docker (pnpm db:up).
- Testkonto buero@linguasud.test (Passwort siehe PASSWORD).
- Python-Playwright mit Chromium installiert.

Ablauf:
1. Öffentliche Seiten ohne Login: Start, Über uns, Kontakt, AGB, Datenschutz,
   Sprachseite /sprachen/deutsch, EN-Fassung /en/… und DE/EN-Umschaltung, 404.
2. Freie Plätze: m15_-Testkurse via SQL — Kurs mit 1 freiem Platz erscheint,
   voller Kurs (B2) wird nicht angezeigt.
3. Kontaktseite → bestehendes Anfrage-Formular (Modul 13) → Anfragen-Postfach
   (DB-Check Anfrage OFFEN + automatische Aufgabe, Mails im Dev-Log).
4. CMS durchs Büro: Seite anlegen (DE + EN), öffentlich prüfen, deaktivieren
   (→ 404), wieder aktivieren, löschen (→ 404). Alles im Audit-Log.
5. Pop-up: anlegen/aktivieren → sichtbar; Schliessen → Cookie → nicht mehr
   sichtbar; Zeitfenster Vergangenheit → unsichtbar; Zeitfenster jetzt → sichtbar;
   inaktiv → unsichtbar; löschen.
6. Rechte: neue m15_-Lehrperson darf /website nicht aufrufen (→ /dashboard),
   kein Website-Nav-Eintrag.
"""

import os
import subprocess
import sys
from datetime import date, timedelta

from playwright.sync_api import expect, sync_playwright

BASE = "http://localhost:3000"
BUREAU_EMAIL = "buero@linguasud.test"
PASSWORD = "Modul8TestPasswort2026!"
LEHR_EMAIL = "m15-lehr@linguasud.test"
LEHR_PASSWORD = "Modul15Lehrpasswort2026!"
DEV_LOG = "/tmp/linguasud-dev.log"
SEITE_SLUG = "m15-testseite"
SEITE_TITEL_DE = "m15 CMS Testseite"
SEITE_TITEL_EN = "m15 CMS test page"
POPUP_TITEL = "m15_Popup Test"
ANFRAGE_NAME = "m15_Webinteressent Musterfrau"
ANFRAGE_EMAIL = "m15-web@linguasud.test"


def psql(sql: str) -> str:
    """Führt SQL im lokalen Docker-Postgres aus (nur für Verifikation)."""
    result = subprocess.run(
        [
            "docker", "exec", "linguasudapp-db-1", "psql",
            "-U", "linguasud", "-d", "linguasud", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql-Fehler: {result.stderr.strip()}")
    return result.stdout.strip()


def node_hash(password: str) -> str:
    """bcrypt-Hash über das Projekt-node_modules (bcryptjs)."""
    result = subprocess.run(
        ["node", "-e", f"console.log(require('bcryptjs').hashSync({password!r}, 10))"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    )
    if result.returncode != 0:
        raise RuntimeError(f"bcryptjs-Fehler: {result.stderr.strip()}")
    return result.stdout.strip()


def cleanup_previous_test_data() -> None:
    """Räumt frühere m15_-Läufe auf, damit der Test wiederholbar ist."""
    psql(
        """
        DELETE FROM "GuthabenJournal" WHERE "anmeldungId" LIKE 'm15\\_%';
        DELETE FROM "Anmeldung" WHERE id LIKE 'm15\\_%';
        DELETE FROM "Aufgabe" WHERE "anfrageId" IN (
            SELECT id FROM "Anfrage" WHERE email = 'm15-web@linguasud.test'
        );
        DELETE FROM "AuditLog" WHERE "entityId" IN (
            SELECT id FROM "Anfrage" WHERE email = 'm15-web@linguasud.test'
        ) OR "entityId" IN (
            SELECT id FROM "WebsiteSeite" WHERE slug = 'm15-testseite'
        ) OR "entityId" IN (
            SELECT id FROM "WebsitePopup" WHERE titel LIKE 'm15\\_%'
        ) OR "entityId" = 'm15_user_lehr';
        DELETE FROM "Anfrage" WHERE email = 'm15-web@linguasud.test';
        DELETE FROM "PublicFormVersuch" WHERE email = 'm15-web@linguasud.test' OR ip IN ('127.0.0.1', '::1');
        DELETE FROM "WebsiteSeite" WHERE slug = 'm15-testseite';
        DELETE FROM "WebsitePopup" WHERE titel LIKE 'm15\\_%';
        DELETE FROM "Kurs" WHERE code LIKE 'M15-TEST-%';
        DELETE FROM "Person" WHERE id LIKE 'm15\\_%' OR "vorname" LIKE 'm15\\_%' OR "nachname" LIKE 'm15\\_%';
        DELETE FROM "Session" WHERE "userId" = 'm15_user_lehr';
        DELETE FROM "User" WHERE id = 'm15_user_lehr';
        """
    )


def main() -> int:
    cleanup_previous_test_data()

    # Stammdaten-IDs aus der DB lesen (nicht hart codieren).
    sprache_de = psql("SELECT id FROM \"Sprache\" WHERE name = 'Deutsch' AND active;")
    niveau_b1 = psql("SELECT id FROM \"Niveau\" WHERE code = 'B1';")
    niveau_b2 = psql("SELECT id FROM \"Niveau\" WHERE code = 'B2';")
    kursart_6er = psql("SELECT id FROM \"Kursart\" WHERE name = '6er';")
    tarifstufe = psql("SELECT id FROM \"Tarifstufe\" WHERE active LIMIT 1;")
    assert sprache_de and niveau_b1 and niveau_b2 and kursart_6er and tarifstufe
    print(f"Stammdaten: Deutsch={sprache_de}, 6er={kursart_6er}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(base_url=BASE)
        page = context.new_page()

        # ——— 1. Öffentliche Seiten ohne Login ———
        page.goto("/", wait_until="networkidle")
        expect(page.get_by_role("heading", name="Sprachschule linguasud")).to_be_visible(timeout=15000)
        for pfad, titel in [
            ("/ueber-uns", "Über uns"),
            ("/kontakt", "Kontakt"),
            ("/agb", "AGB"),
            ("/datenschutz", "Datenschutz"),
        ]:
            page.goto(pfad, wait_until="networkidle")
            expect(page.get_by_role("heading", name=titel, exact=True)).to_be_visible(timeout=15000)
        page.goto("/sprachen/deutsch", wait_until="networkidle")
        expect(page.get_by_role("heading", name="Deutsch", exact=True)).to_be_visible()
        page.goto("/sprachen/portugiesisch", wait_until="networkidle")
        expect(page.get_by_role("heading", name="Portugiesisch", exact=True)).to_be_visible()
        print("✓ Öffentliche Seiten (Start, Über uns, Kontakt, AGB, Datenschutz, Sprachseiten) erreichbar")

        # hreflang + DE/EN-Umschaltung
        page.goto("/ueber-uns", wait_until="networkidle")
        assert page.locator('link[rel="alternate"][hreflang="en"][href$="/en/ueber-uns"]').count() == 1, "hreflang en fehlt"
        page.get_by_role("link", name="EN", exact=True).click()
        page.wait_for_url("**/en/ueber-uns", timeout=15000)
        expect(page.get_by_role("heading", name="About us", exact=True)).to_be_visible()
        page.get_by_role("link", name="DE", exact=True).click()
        page.wait_for_url("**/ueber-uns", timeout=15000)
        print("✓ DE/EN-Umschaltung und hreflang-Alternates")

        # 404 für unbekannte Pfade
        antwort = page.goto("/gibts-nicht", wait_until="networkidle")
        assert antwort is not None and antwort.status == 404, "Unbekannter Pfad muss 404 liefern"
        print("✓ Unbekannter Pfad → 404")

        # ——— 2. Freie Plätze (Live-Daten, volle Kurse ausgeblendet) ———
        # Kurs mit 1 freiem Platz (5 von 6 belegt, B1) und voller Kurs (6 von 6, B2).
        psql(
            f"""
            INSERT INTO "Person" (id, status, anrede, vorname, nachname, "updatedAt") VALUES
            ('m15_p1', 'AKTIV', 'FRAU', 'm15_Person1', 'Testerin', now()),
            ('m15_p2', 'AKTIV', 'HERR', 'm15_Person2', 'Tester', now()),
            ('m15_p3', 'AKTIV', 'FRAU', 'm15_Person3', 'Testerin', now()),
            ('m15_p4', 'AKTIV', 'HERR', 'm15_Person4', 'Tester', now()),
            ('m15_p5', 'AKTIV', 'FRAU', 'm15_Person5', 'Testerin', now()),
            ('m15_p6', 'AKTIV', 'HERR', 'm15_Person6', 'Tester', now());
            INSERT INTO "Kurs" (id, code, status, "spracheId", "niveauId", "kursartId", wochentag, "startZeit", "dauerMinuten", extern, "updatedAt")
            VALUES
            ('m15_kurs_offen', 'M15-TEST-B1', 'AKTIV', '{sprache_de}', '{niveau_b1}', '{kursart_6er}', 2, '17:30', 60, false, now()),
            ('m15_kurs_voll', 'M15-TEST-B2', 'AKTIV', '{sprache_de}', '{niveau_b2}', '{kursart_6er}', 3, '18:00', 60, false, now());
            INSERT INTO "Anmeldung" (id, "kursId", "personId", status, "billingTyp", "tarifstufeId", "paketGroesse", "preisChf", "updatedAt")
            SELECT 'm15_ao_' || p.id, 'm15_kurs_offen', p.id, 'AKTIV', 'PRIVAT', '{tarifstufe}', 14, 100.00, now()
            FROM "Person" p WHERE p.id IN ('m15_p1', 'm15_p2', 'm15_p3', 'm15_p4', 'm15_p5');
            INSERT INTO "Anmeldung" (id, "kursId", "personId", status, "billingTyp", "tarifstufeId", "paketGroesse", "preisChf", "updatedAt")
            SELECT 'm15_av_' || p.id, 'm15_kurs_voll', p.id, 'AKTIV', 'PRIVAT', '{tarifstufe}', 14, 100.00, now()
            FROM "Person" p WHERE p.id IN ('m15_p1', 'm15_p2', 'm15_p3', 'm15_p4', 'm15_p5', 'm15_p6');
            """
        )
        page.goto("/sprachen/deutsch", wait_until="networkidle")
        expect(page.get_by_text("Niveau B1 · 6er").first).to_be_visible(timeout=15000)
        expect(page.get_by_text("1 freier Platz").first).to_be_visible()
        # Voller Kurs (6 von 6 belegt, B2) darf nirgends erscheinen.
        assert page.get_by_text("Niveau B2").count() == 0, "Voller Kurs (B2) darf nicht angezeigt werden"
        print("✓ Freie Plätze live: offener Kurs sichtbar, voller Kurs ausgeblendet")

        # ——— 3. Kontaktseite → bestehendes Anfrage-Formular → Postfach ———
        page.goto("/kontakt", wait_until="networkidle")
        page.get_by_role("link", name="Anfrage stellen").first.click()
        page.wait_for_url("**/anfrage**", timeout=15000)
        page.fill("#oa-name", ANFRAGE_NAME)
        page.fill("#oa-email", ANFRAGE_EMAIL)
        page.fill("#oa-telefon", "+41 79 123 45 67")
        page.fill("#oa-nachricht", "m15_ Testanfrage von der öffentlichen Website.")
        log_start = os.path.getsize(DEV_LOG) if os.path.exists(DEV_LOG) else 0
        page.get_by_role("button", name="Anfrage absenden").click()
        page.wait_for_url("**/anfrage/erfolg**", timeout=20000)
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.get_by_role("heading", name="Besten Dank für Ihre Anfrage")).to_be_visible(timeout=15000)

        page.wait_for_timeout(2000)
        with open(DEV_LOG, encoding="utf-8", errors="replace") as f:
            f.seek(log_start)
            log = f.read()
        assert "Ihre Anfrage bei der Sprachschule linguasud" in log, "Bestätigungs-Mail fehlt im Dev-Log"
        assert f"Neue Anfrage von {ANFRAGE_NAME}" in log, "Büro-Benachrichtigung fehlt im Dev-Log"
        status = ""
        for _ in range(10):
            status = psql(f"SELECT status FROM \"Anfrage\" WHERE email = '{ANFRAGE_EMAIL}';")
            if status:
                break
            page.wait_for_timeout(1000)
        assert status == "OFFEN", f"Anfrage muss im Postfach OFFEN sein, ist {status!r}"
        aufgabe_n = psql(
            f"""
            SELECT COUNT(*) FROM "Aufgabe"
            WHERE "anfrageId" IN (SELECT id FROM "Anfrage" WHERE email = '{ANFRAGE_EMAIL}')
              AND "dedupKey" LIKE 'anfrage:%';
            """
        )
        assert aufgabe_n == "1", f"Genau 1 automatische Aufgabe erwartet, gefunden {aufgabe_n}"
        print("✓ Kontaktformular → Anfragen-Postfach (OFFEN + Aufgabe), Mails im Dev-Log")

        # ——— 4. CMS durchs Büro: Seite anlegen, prüfen, deaktivieren, löschen ———
        page.goto("/login", wait_until="networkidle")
        page.fill("#login-email", BUREAU_EMAIL)
        page.fill("#login-password", PASSWORD)
        page.get_by_role("button", name="Anmelden").click()
        page.wait_for_url("**/dashboard**", timeout=20000)
        page.get_by_role("link", name="Website").click()
        page.wait_for_url("**/website**", timeout=15000)
        expect(page.get_by_text("Website (CMS)", exact=False)).to_be_visible()
        print("✓ Login Büro, Website-CMS in der Navigation")

        page.goto("/website/seite/neu", wait_until="networkidle")
        page.fill("#ws-slug", SEITE_SLUG)
        page.fill("#ws-titel-de", SEITE_TITEL_DE)
        page.fill("#ws-untertitel-de", "m15_ Untertitel Deutsch")
        page.fill("#ws-inhalt-de", "Erster Absatz Deutsch.\n\n## Bereich\n\n- Punkt eins\n- Punkt zwei")
        page.fill("#ws-titel-en", SEITE_TITEL_EN)
        page.fill("#ws-untertitel-en", "m15_ subtitle English")
        page.fill("#ws-inhalt-en", "First paragraph English.\n\n## Section\n\n- Point one\n- Point two")
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("angelegt.", exact=False)).to_be_visible(timeout=15000)
        seite_id = psql(f"SELECT id FROM \"WebsiteSeite\" WHERE slug = '{SEITE_SLUG}';")
        assert seite_id, "Seite muss in der DB existieren"
        audit_n = psql(f"SELECT COUNT(*) FROM \"AuditLog\" WHERE action = 'website.seite.speichern' AND \"entityId\" = '{seite_id}';")
        assert audit_n == "1", "Audit-Eintrag website.seite.speichern fehlt"
        print("✓ CMS-Seite angelegt (DE + EN), Audit-Log geführt")

        page.goto(f"/{SEITE_SLUG}", wait_until="networkidle")
        expect(page.get_by_role("heading", name=SEITE_TITEL_DE, exact=True)).to_be_visible()
        expect(page.get_by_text("Punkt eins")).to_be_visible()
        page.goto(f"/en/{SEITE_SLUG}", wait_until="networkidle")
        expect(page.get_by_role("heading", name=SEITE_TITEL_EN, exact=True)).to_be_visible()
        expect(page.get_by_text("Point one")).to_be_visible()
        print("✓ CMS-Seite öffentlich (DE + EN, Inhalt gerendert)")

        # Deaktivieren → 404; reaktivieren → sichtbar; löschen → 404.
        page.goto("/website", wait_until="networkidle")
        page.goto(f"/website/seite/{seite_id}", wait_until="networkidle")
        page.uncheck('input[name="active"]')
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("Seite gespeichert.", exact=False)).to_be_visible(timeout=15000)
        antwort = page.goto(f"/{SEITE_SLUG}", wait_until="networkidle")
        assert antwort is not None and antwort.status == 404, "Inaktive Seite muss 404 liefern"
        page.goto(f"/website/seite/{seite_id}", wait_until="networkidle")
        page.check('input[name="active"]')
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("Seite gespeichert.", exact=False)).to_be_visible(timeout=15000)
        page.goto(f"/{SEITE_SLUG}", wait_until="networkidle")
        expect(page.get_by_role("heading", name=SEITE_TITEL_DE, exact=True)).to_be_visible()
        page.goto(f"/website/seite/{seite_id}", wait_until="networkidle")
        page.get_by_role("button", name="Seite löschen").click()
        page.wait_for_url("**/website**", timeout=15000)
        page.wait_for_timeout(1500)
        antwort = page.goto(f"/{SEITE_SLUG}", wait_until="networkidle")
        assert antwort is not None and antwort.status == 404, "Gelöschte Seite muss 404 liefern"
        print("✓ Seite aktiv/inaktiv (404) und löschen funktioniert")

        # ——— 5. Pop-up: Zeitfenster serverseitig, Schliessen per Cookie ———
        gestern = (date.today() - timedelta(days=1)).isoformat()
        morgen = (date.today() + timedelta(days=1)).isoformat()

        page.goto("/website/popup/neu", wait_until="networkidle")
        page.fill("#wp-titel", POPUP_TITEL)
        page.fill("#wp-text", "m15_ Test-Pop-up: Willkommen!")
        page.fill("#wp-btn-label", "Zum Test")
        page.fill("#wp-btn-url", "/einstufungstest")
        page.check('input[name="aktiv"]')
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("Pop-up angelegt.", exact=False)).to_be_visible(timeout=15000)
        popup_id = psql(f"SELECT id FROM \"WebsitePopup\" WHERE titel = '{POPUP_TITEL}';")
        assert popup_id, "Pop-up muss in der DB existieren"

        # a) Zeitfenster vollständig in der Vergangenheit → nicht ausgeliefert.
        page.goto(f"/website/popup/{popup_id}", wait_until="networkidle")
        page.fill("#wp-von", f"{gestern}T08:00")
        page.fill("#wp-bis", f"{gestern}T18:00")
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("Pop-up gespeichert.", exact=False)).to_be_visible(timeout=15000)
        page.goto("/ueber-uns", wait_until="networkidle")
        assert page.get_by_role("dialog", name=POPUP_TITEL).count() == 0, "Abgelaufenes Zeitfenster darf nicht anzeigen"

        # b) Zeitfenster umfasst jetzt → sichtbar (SSR, kein Flackern).
        page.goto(f"/website/popup/{popup_id}", wait_until="networkidle")
        page.fill("#wp-von", f"{gestern}T00:00")
        page.fill("#wp-bis", f"{morgen}T23:59")
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("Pop-up gespeichert.", exact=False)).to_be_visible(timeout=15000)
        page.goto("/ueber-uns", wait_until="networkidle")
        expect(page.get_by_role("dialog", name=POPUP_TITEL)).to_be_visible(timeout=15000)

        # c) Inaktiv → nie ausgeliefert.
        page.goto(f"/website/popup/{popup_id}", wait_until="networkidle")
        page.uncheck('input[name="aktiv"]')
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("Pop-up gespeichert.", exact=False)).to_be_visible(timeout=15000)
        page.goto("/ueber-uns", wait_until="networkidle")
        assert page.get_by_role("dialog", name=POPUP_TITEL).count() == 0, "Inaktives Pop-up darf nie erscheinen"

        # d) Aktiv + Schliessen → Tages-Cookie, Pop-up kommt nicht wieder.
        page.goto(f"/website/popup/{popup_id}", wait_until="networkidle")
        page.check('input[name="aktiv"]')
        page.get_by_role("button", name="Speichern").click()
        expect(page.get_by_text("Pop-up gespeichert.", exact=False)).to_be_visible(timeout=15000)
        page.goto("/ueber-uns", wait_until="networkidle")
        expect(page.get_by_role("dialog", name=POPUP_TITEL)).to_be_visible(timeout=15000)
        page.get_by_role("button", name="Schliessen").click()
        page.wait_for_timeout(1500)
        page.reload(wait_until="networkidle")
        assert page.get_by_role("dialog", name=POPUP_TITEL).count() == 0, "Geschlossenes Pop-up darf nicht wiederkommen (Cookie)"
        print("✓ Pop-up: Zeitfenster serverseitig (Vergangenheit/Jetzt), inaktiv, Schliessen mit Cookie")

        page.goto(f"/website/popup/{popup_id}", wait_until="networkidle")
        page.get_by_role("button", name="Löschen").click()
        page.wait_for_url("**/website**", timeout=15000)
        assert not psql(f"SELECT id FROM \"WebsitePopup\" WHERE id = '{popup_id}';"), "Pop-up muss gelöscht sein"
        print("✓ Pop-up gelöscht")

        # ——— 6. Rechte: Lehrperson darf das CMS nicht pflegen ———
        psql(
            f"""
            INSERT INTO "User" (id, email, "firstName", "lastName", roles, "passwordHash", "isActive", "mustChangePassword", "updatedAt")
            VALUES ('m15_user_lehr', '{LEHR_EMAIL}', 'm15_Lehr', 'Kraft', ARRAY['LEHRPERSON'::"Role"], '{node_hash(LEHR_PASSWORD)}', true, false, now());
            """
        )
        page.goto("/anfrage/erfolg", wait_until="networkidle")  # frische Navigation
        page.goto("/login", wait_until="networkidle")
        # Erst Büro abmelden (aktuelle Session ist noch Büro).
        if page.get_by_role("button", name="Abmelden").count() > 0:
            page.get_by_role("button", name="Abmelden").click()
            page.wait_for_url("**/", timeout=15000)
            page.goto("/login", wait_until="networkidle")
        page.fill("#login-email", LEHR_EMAIL)
        page.fill("#login-password", LEHR_PASSWORD)
        page.get_by_role("button", name="Anmelden").click()
        page.wait_for_url("**/dashboard**", timeout=20000)
        page.goto("/website", wait_until="networkidle")
        page.wait_for_url("**/dashboard**", timeout=15000)
        assert page.get_by_role("link", name="Website", exact=True).count() == 0, "Lehrperson darf keinen Website-Nav-Eintrag sehen"
        print("✓ Rechte: Lehrperson wird von /website zur Übersicht umgeleitet, kein Nav-Eintrag")

        # Aufräumen: Testdaten entfernen, damit die DB sauber bleibt (Audit-Log behalten).
        cleanup_previous_test_data()
        print("✓ m15_-Testdaten aufgeräumt")

        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
