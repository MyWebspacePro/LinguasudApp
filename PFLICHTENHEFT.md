# Pflichtenheft — LinguasudApp

**Verwaltungssoftware für die Sprachschule linguasud.com**
Stand: 24.10.2026 · Status: Phase 1 (Projektgerüst) **fertig und live** auf `linguasudapp.aiconso.eu` (Health `db:up`, TLS gültig). **Modul 1 — Login & Rechtesystem: fertig** (5 Rollen, Passwort-Politik 20+, E-Mail-Reset, Brute-Force-Schutz, Audit-Log, Bootstrap-Admin, Benutzerliste/-verwaltung). **Modul 2 — Stammdaten: fertig** (Standorte/Etagen/Räume mit Startdaten, Sprachen, Niveaus, Kursarten, Lektionsdauern, Tarifstufen + Preisliste Kursart×Dauer×Stufe — jederzeit anpassbar, Kostenträger; pflegt nur Admin, Chef lesend; löschen nur wenn unbenutzt, archivieren, Audit). **Modul 3 — Personenverwaltung: fertig** (eine Kartei für alle; Status Interessent/in → aktiv → inaktiv; Anrede zwingend; abweichende Rechnungsadresse; 2 Telefone mit WhatsApp/Signal; CRM-Notizen mit Autor+Datum; Kinder ↔ Eltern/Erziehungsberechtigte als verknüpfte Personen; Lehrpersonen-Kürzel automatisch aus Vor-/Nachname mit Suffix bei Doppelung; Qualifikationen Sprache×Niveau; Konto↔Person über `User.personId` mit E-Mail-Synchronisation; löschen nur wenn unbenutzt, Audit). **Modul 4 — Kurse: fertig** (fortlaufende Kurse ohne Start-/Enddatum, Status geplant/aktiv/pausiert/abgeschlossen/abgesagt; automatischer Kurscode DE-B2-6ER-SMIT01-01 aus Sprache/Niveau/Kursart/Lehrkürzel+Serial; Niveau-Verlauf mit Zeiträumen — Wechsel passt den Code an; Unterbrechungen ausgegraut + überbuchbar; Firmenkurse extern «Kursort extern» ohne Raum; Lehrpersonen melden Wechsel/Unterbrechungen). **Modul 5 — Anmeldungen: fertig** (Billing privat/Firma/öffentliche Einrichtung; Probelektionen ohne Guthaben/Preis, wandeln sich um; Tarif automatisch nach Tageszeit, übersteuerbar; Paketgrösse 14/15, übersteuerbar; Preis aus Preisliste, übersteuerbar mit dokumentierter Abweichung; Lektionsguthaben als Konto mit Journal; Paketende-Automatik nach der 12. von 14 / 13. von 15 Lektion mit Informieren/Erinnern, Fortfahren = Auffüllung + Rechnungsauslösung; Fehlzeiten final durchs Büro). **Modul 6 — Lektionsgenerierung & Raumplaner: fertig** (rollierende Generierung 2 Wochen im Voraus, nächtlicher Job + manueller Button; Planer 14 Tage Mo–Sa 06:30–23:00, Spalten Standort→Etage→Räume, Kürzel im Block + Details beim Hover; Verschieben/Fixieren nur durchs Büro — provisorisch→fixiert, Fixierung mit Abweichung informiert Teilnehmende; keine harte Konfliktblockade, Konflikte farblich; Online-Spalte für Kurse ohne Raum). **Modul 7 — Anwesenheitskontrolle: fertig** (Erfassung im Planer-Panel direkt nach der Lektion — Lehrperson 24 h, danach Büro; anwesend −1 / unentschuldigt −1 / entschuldigt −0, Probe ohne Abbuchung; Abschluss erst bei vollständiger Erfassung → DURCHGEFÜHRT + Guthaben-Journal mit Lektions-Link + Paketende-Automatik informiert automatisch; Büro korrigiert nachträglich mit Journal-Anpassung, Audit; Lehrperson sagt eigene Lektionen selbst ab (Grund, Info, kein Abzug); nächtliche Erinnerung am nächsten Tag; Dashboard-Liste der offenen Anwesenheiten). **Modul 8 — Dienst- & Urlaubsplanung Büro: fertig** (eigene Wochenansicht `/bueroplan` nur für Büro/Admin/Chef, Lehrpersonen ausgenommen; wiederkehrendes Pensum mit beliebig vielen Blöcken pro Tag, Tages-Abweichungen (abweichende Arbeitszeit / dienstfrei), Abwesenheiten Urlaub/Krankheit/sonstige direkt ohne Genehmigungs-Workflow; anpassbares Urlaubs-Jahreskontingent (Standard 20 Tage) mit Zählung und Überschreitungs-Warnung; Audit). **Modul 9 — Rechnungen (PDF): fertig** (Schweizer QR-Rechnung mit QR-IBAN + 27-stelliger Referenznummer, scannbarer QR-Zahlteil mit Schweizer Kreuz — Payload im Live-Test dekodiert; mehrere Positionen, MwSt-Feld, Teilzahlungen mit Restbetrag; Status Entwurf → versendet → (teilbezahlt) → bezahlt → storniert, «überfällig» abgeleitet; Auto-Mahnung Stufe 1 nach 10 / Stufe 2 nach 30 Tagen nach Fälligkeit, manuell jederzeit früher; Rechnung bei fester Anmeldung und Paket-Verlängerung automatisch bei privat/Firma, Behörden im Nachhinein durchs Büro; Empfänger Person/Firma/Behörde/Eltern mit abweichender Rechnungsadresse als Snapshot; QR-Schlüssel über Umgebungsvariablen, Audit). Nächster Schritt: **Modul 10 — Kursbestätigungen (PDF)**.

**Grundsatz:** Produktivsystem, kein Mock-up. Wir bauen direkt für den Live-Betrieb.

---

## Technik-Grundlagen

| Thema | Entscheidung |
|---|---|
| Architektur | **Next.js Fullstack** (App Router, React, TypeScript) + **Tailwind CSS** — ein Container |
| Datenbank | **PostgreSQL** (eigener Container in Coolify), Start leer (keine Alt-Daten) |
| Deployment | Git push → GitHub (`MyWebspacePro/LinguasudApp`) → **Coolify deployt automatisch** auf den VPS |
| URLs | Verwaltungs-App: `linguasudapp.aiconso.eu` — **eine einzige Produktiv-Umgebung** (Tests laufen lokal, jeder Push auf `main` geht live) |
| E-Mail | **SMTP über IONOS** (Zugang liefert der Kunde) |
| Backups | **Täglich automatisch**, ca. 14 Tage Aufbewahrung |
| PDF | Serverseitige Erzeugung; Rechnungen als **Schweizer QR-Rechnung** |
| Währung / UI-Sprache | CHF / Verwaltung deutsch |
| ORM/Schema | **Prisma 8** (`8.0.0-rc.27` + `@prisma/orm-postgres`, exakt gepinnt; Prisma 6 erhält nur noch bis 19.11.2026 Sicherheitspatches): `prisma/schema.prisma` als Contract-Quelle, Migrationen via `migration plan` + `db migrate`, laufen beim Deployment automatisch |

## Rollenmodell (5 Rollen, Mehrfachrollen möglich)

| Rolle | Darf |
|---|---|
| **Admin** | Als Einzige:r **Rechte/Rollen vergeben** + **Stammdaten pflegen** (Modul 2) |
| **Chef** | Alles sehen/bearbeiten **ausser** Rechtevergabe; **Finanz-Dashboard** (Umsatz, offene Posten, Honorare, Vermietungseinnahmen) |
| **Büro** | Operativ: Personen, Kurse, Anmeldungen, Planer, Anwesenheit korrigieren, Rechnungen erstellen, Vermietung |
| **Lehrperson** | Eigene Kurse/Lektionen (lesen), Anwesenheit erfassen, Lektionen absagen, Unterbrechungen + Niveau-Fortschritt melden, KI-Lektionsgenerator |
| **Kursteilnehmer** | Eigenes Portal: nächste Lektionen + Raum, Benachrichtigung, eigene Rechnungen + Kursbestätigungen ausdrucken |

**Sicherheit:** Passwort min. **20 Zeichen** (Groß/Klein/Zahlen/Sonderzeichen) · Zurücksetzen **per E-Mail-Link** (selbstständig) · keine Selbstregistrierung (Konten nur Büro/Admin) · Session-Cookies httpOnly · Brute-Force-Schutz · **Audit-Log** für alle wichtigen Änderungen.

**Globale Stammdaten-Regel (Admin-Bereich):** alles anlegen · aktivieren/deaktivieren · löschen (nur wenn unbenutzt) · archivieren.

---

## Modul 1 — Login & Rechtesystem
Siehe Rollenmodell oben. Teilnehmer-Portal-Inhalte: nächste Lektionen mit Raum, Info bei neuen Terminen, eigene Rechnungen/Kursbestätigungen.

## Modul 2 — Stammdaten
- **Standorte/Räume (Startdaten):** Vorstadt 18 Schaffhausen (1. Stock 3 / 2. Stock 5 / 4. Stock 3 Räume) · Stadthausgasse 16 Schaffhausen (3) · Bahnhofplatz 9 Winterthur (3). Räume mit **Namen** (Oxford, Brisbane, Sydney, Paris …) und **Sitzplatzzahl**; Hierarchie Standort → Etage → Raum auch im Planer.
- Anlegbar: **Sprachen**, **Niveaus**, **Kursarten** (Einzel, 2er, 3er, 4er, 6er, Online, Firmenkurs — beliebig erweiterbar), **Lektionsdauern** (45/60/90 Min …), alles mit Preisen.
- **Tarife/Preisliste:** je Kursart × Dauer × Tarifstufe. **Hochtarif = 14 Lektionen/Paket** (über Mittag/Abend), **Niedertarif = 15 Lektionen/Paket** (Vormittag/Nachmittag). Standard-Ableitung nach Tageszeit, Büro kann übersteuern. Paketgröße/Preis pro Anmeldung übersteuerbar (Sonderfälle). Jährlich anpassbar ohne Code.
- **Kostenträger:** Firmen + öffentliche Einrichtungen mit Rechnungsadresse + Kundennummer.
- Gruppen normal max. 6 Teilnehmende, Ausnahme 7 (Warnung + Übersteuerung). **Firmenkurse individuelle Teilnehmerzahl.**
- **Online-Kurse:** eigene Kursart, Raum **optional** (mal Schulungsraum, mal von zu Hause), **kein** Video-Link-Feld.
- **Keine globale Ferienliste** — Unterbrechungen regeln Lehrpersonen/Teilnehmende selbst (→ Modul 4).

## Modul 3 — Personenverwaltung
- **Eine Kartei** für alle; Status: **Interessent/in → aktiv → inaktiv** (Interessent wird bei Anmeldung weiterverwendet).
- Felder: **Anrede/Geschlecht** (Herr/Frau/divers — zwingend), Name, E-Mail (= Login), Postadresse, **abweichende Rechnungsadresse**, **2 Telefonnummern** + „nutzt WhatsApp"/„nutzt Signal", **CRM-Notizen** mit Autor + Datum. Geburtsdatum: nicht erforderlich.
- **Kinder: Eltern/Erziehungsberechtigte als verknüpfte Personen** (können Rechnungsempfänger sein).
- **Kurs-Historie** pro Person: alle Kurse parallel/hintereinander, auch mehrsprachig, chronologisch.
- **Lehrpersonen:** Kürzel **automatisch aus Vor- + Nachname**, eindeutig (Suffix bei Doppelung); **Qualifikationen** (unterrichtet mehrere Sprachen × Niveau).

## Modul 4 — Kurse
- **Fortlaufend, keine fixen Start-/Enddaten.** Teilnehmende buchen immer 14/15-Lektionen-Pakete und verlängern; einzelne gehen raus, andere machen weiter; Kurs endet manuell oder bei Auflösung. Status: geplant · aktiv · pausiert · abgeschlossen · abgesagt.
- **Eindeutiger automatischer Kurscode** (z.B. `DE-B2-6ER-SMIT01-01`); im Planer nur Kürzel sichtbar, **Details beim Hover** (Sprache, Niveau, Kursart, Lehrperson, Code).
- **Niveau-Verlauf:** Kurs durchläuft Niveaus (Zeiträume pro Niveau); Lehrperson meldet Niveau-Wechsel → löst Kursbestätigung aus (Modul 10) und passt den Kurscode an.
- **Unterbrechungen:** Lehrperson meldet mit ihrem Konto ans Büro → Kurs im Planer **ausgegraut** sichtbar, Slot für andere Kurse **überbuchbar**.
- **Firmenunterricht, zwei Formen:** (a) Mitarbeitende in regulären Kursen, Rechnung an die Firma · (b) individuell abgemachter Unterricht, auch **vor Ort im Unternehmen** (Kursort „extern", erscheint nicht im Raumplaner).

## Modul 5 — Anmeldungen
- **Drei Billing-Typen:** **privat** (selbstzahlend, Rechnung im Voraus pro Paket) · **Firma** (Rechnung an Firma, im Voraus pro Paket) · **öffentliche Einrichtung** (Rechnung **erst im Nachhinein**).
- **Probelektionen:** Status „Probe", noch keine regulären Teilnehmenden, erscheinen in der Anwesenheitsliste, kein Guthaben/kein Preis; wandeln sich bei fester Anmeldung um.
- **Paket & Preis:** Tarif automatisch nach Tageszeit (übersteuerbar), Paketlektionen Standard 14/15 (übersteuerbar), Preis aus Preisliste (übersteuerbar, Abweichung dokumentiert). **Lektionsguthaben** als Konto mit Journal.
- **Paketende-Automatik:** nach der **12. von 14 / 13. von 15 Lektion** Teilnehmenden automatisch informieren („Fortfahren oder beenden?"). Fortfahren → **Rechnung geht automatisch raus** + Guthaben-Auffüllung (privat/Firma; bei Behörden nur Verlängerung). Keine Antwort → Erinnerung + Aufgabe ans Büro.
- **Fehlzeiten:** unentschuldigt −1 Lektion, entschuldigt −0. Lehrperson meldet, **Büro entscheidet final**.

## Modul 6 — Lektionsgenerierung & Raumplaner
- **Rollierende automatische Generierung 2 Wochen im Voraus** (nächtlicher Job).
- Planer: **14 Tage, Montag–Samstag, 06:30–23:00 Uhr** (kein Kurs startet nach 21:00, späte 2h-Kurse bleiben sichtbar). Mindestens **1 Woche ohne horizontales Scrollen**.
- Spalten oben: **Standort → Etage → Räume**. Belegung mit Kürzel, Rest beim Hover.
- **Nur das Büro verschiebt Lektionen/verteilt Räume**; Lehrpersonen nur lesend + melden.
- Verschieben: **provisorisch → vom Büro fixieren**; bei Fixierung mit Raum-/Zeitänderung werden Teilnehmende informiert.
- **Keine harte Konfliktblockade** — Büro hat immer das letzte Wort (Konflikte höchstens farblich angedeutet).
- Pausierte Kurse ausgegraut + überbuchbar · integriertes Anwesenheits-Panel · Vermietungsblöcke sichtbar.

## Modul 7 — Anwesenheitskontrolle
- Erfassung **direkt nach der Lektion**; Lehrperson hat **24 h**, danach nur noch Büro.
- **Automatische Erinnerung am nächsten Tag** an die Lehrperson, wenn offen; Büro sieht Liste aller offenen Anwesenheiten.
- **Lehrperson darf Lektionen selbst absagen** (mit Grund) → **Teilnehmende werden automatisch informiert**; kein Guthaben-Abzug.
- Lektion **abschliessen** erst bei vollständiger Erfassung → bucht Guthaben: anwesend −1, unentschuldigt −1, entschuldigt −0.
- Büro entscheidet entschuldigt/unentschuldigt und korrigiert nachträglich (Audit-Log). Probeteilnehmende ohne Abbuchung.

## Modul 8 — Dienst- & Urlaubsplanung Büro (nur Büropersonal)
- **Individuelle wiederkehrende Wochenpläne** (= Pensum): beliebig viele Zeitblöcke pro Tag (z.B. 45 Min vor + nach Unterricht; „2 Vormittage + 3 Nachmittage"), mehrere Personen parallel; Abweichungen eintragbar.
- **Urlaub direkt eintragen** (kein Genehmigungs-Workflow); **20 Tage Jahreskontingent** pro Person (zählbar, anpassbar); alle im Stundenlohn. Abwesenheitsarten: Urlaub, Krankheit, sonstige.
- **Eigene Büro-Ansicht** — bewusst nicht im Raumplaner. Lehrpersonen ausgenommen (organisieren sich selbst).

## Modul 9 — Rechnungen (PDF)
- **Schweizer QR-Rechnung** (QR-IBAN + Referenznummer, scannbarer QR-Zahlteil).
- **Mehrere Positionen** pro Rechnung (Paket, Lehrmittel, Registration …), Summe, MwSt-Feld falls relevant.
- **Zahlungsfrist + Auto-Mahnung** (Stufe 1 freundliche Erinnerung, Stufe 2 Mahnung per E-Mail).
- **Teilzahlungen** erfassen; Rechnung zeigt Restbetrag. Status: Entwurf → versendet → (teilbezahlt) → bezahlt → überfällig → storniert.
- Automatik: Rechnung bei Paket-Verlängerung automatisch (privat/Firma); Behörden-Rechnungen im Nachhinein.
- Empfänger: Person, Firma, Behörde oder Eltern; abweichende Rechnungsadresse berücksichtigt.

## Modul 10 — Kursbestätigungen (PDF)
- **Auslöser: Niveau-Wechsel.** Meldet die Lehrperson „jetzt neues Niveau", erzeugt das System automatisch die Bestätigung **für den abgeschlossenen Niveau-Abschnitt** (Zeitraum + in dem Abschnitt besuchte Lektionen) für alle aktiven Teilnehmenden → bereit im Portal zum Selbstdrucken.
- **Inhalt:** Anrede + Name, Sprache + bestätigtes Niveau, Kursart, Zeitraum, besuchte Lektionen, Datum, Logo + Unterschriftszeile.
- Nur Deutsch · keine Leistungsbewertung · Büro kann jederzeit manuell erzeugen.

## Modul 11 — Honorarabrechnung
- Nur **durchgeführte** (abgeschlossene) Lektionen zählen; Absenzen von Teilnehmern (Lektion fand statt) zählen normal.
- **Honorar-Matrix: Lehrperson × Kursart × Lektionsdauer**, mit **globalem Default-Satz** als Vorbelegung (falls alle denselben Stundensatz haben, genügt ein Wert, Dauer wird hochgerechnet).
- **Monats-Workflow:** Büro wählt Monat → Lektionsliste × Sätze pro Lehrperson → Total → „als bezahlt markieren".
- **PDF-Beleg pro Lehrperson** (Datum, Kurs, Dauer, Satz, Total). Auswertungen im Finanz-Dashboard des Chefs.

## Modul 12 — Raumvermietung
- Vermietungen **über die App abgerechnet** (Preis, QR-Rechnung, Einnahmen im Finanz-Dashboard).
- **Einmalige** Vermietungen + **Serien** (z.B. jeden Dienstag 18–20 Uhr, 1.1.–31.12.).
- **Eigene Mieterkartei** (Name, Kontakt, Rechnungsadresse).
- Belegungsblöcke im Planer deutlich gekennzeichnet (andere Farbe, Hover).

## Modul 13 — Aufgaben & Anfragen
- **Online-Einstufungstest** auf der Website (Multiple Choice, automatische Niveau-Empfehlung).
- Anfrage-Eingang: **automatische Bestätigungs-E-Mail** an Anfragende + Aufgabe + Benachrichtigung ans Büro.
- **Schlichtes Aufgaben-System:** Titel, Beschreibung, Zugewiesene:r, Fälligkeit, Status, Verknüpfung mit Person/Kurs/Anfrage.
- Automatische Aufgaben u.a. bei: neuer Anfrage, Paket-Ende ohne Antwort, offenen Anwesenheiten.
- Interessenten werden nach Identitätsprüfung einer Person zugeordnet.

## Modul 14 — KI-Lektionsgenerator
- **Feature vollständig sichtbar, KI-Anbindung inaktiv** — Aktivierung später über **OpenRouter** (API-Key + Modellwahl in Admin-Einstellungen, billiges Modell genügt).
- **Zwei Modi:** strukturiert (Lernziele, Ablaufplan mit Phasen + Zeiten, ausformulierte Materialien, Hausaufgabe) und frei (eigener Prompt).
- **Bibliothek:** speichern, durchsuchen, PDF-Druck, optional mit Kolleginnen/Kollegen teilen. Nutzbar durch Lehrpersonen.

## Modul 15 — Öffentliche Website
- **Vollständig aus der App verwaltbar** (CMS durch Büro/Chef, ohne Programmieren).
- **UI-Sprachen: Deutsch + Englisch.**
- Seiten: **Start** · **Über uns** · **Kontakt** (Formular + Einstufungstest → Anfragen-Postfach) · **eigene SEO-Unterseite pro unterrichteter Sprache** (Deutsch, Englisch, Italienisch, Französisch, Spanisch, „Weitere Sprachen") mit zugehörigen Kursen und freien Plätzen · Rechtsseiten (AGB/Datenschutz).
- **Pop-up-Funktionalität** (CMS-pflegbar: Text, Bild, aktiv/inaktiv, zeitsteuerbar).
- **Live-Anzeige freier Plätze** in Gruppenkursen (volle Kurse werden nicht angezeigt).
- **Domain offen:** linguasud.com oder aiconso.eu-Subdomain — Entscheidung bis Deployment, technisch beides möglich.

## Modul 16 — Deployment
- GitHub → Coolify **automatisch** bei Push (Webhook).
- **Eine Produktiv-Umgebung** auf `linguasudapp.aiconso.eu` (Tests laufen lokal; was auf `main` gepusht wird, ist live).
- SMTP (IONOS) · **tägliche DB-Backups** (ca. 14 Tage) · Migrationen laufen automatisch · Healthcheck.

---

## Offene Punkte / benötigte Angaben vom Kunden
1. **Logo-Datei** (PDFs + Website)
2. **Bankverbindung: QR-IBAN + Gläubigeradresse** (für QR-Rechnung)
3. **IONOS-SMTP-Zugang** (Host, Port, Benutzer, Passwort — als Umgebungsvariablen in Coolify)
4. **Domain-Entscheidung** für die öffentliche Website
5. Später: **OpenRouter-API-Key** (KI-Generator)
6. **Raumnamen + Sitzplätze** der echten Räume (erfassen wir gemeinsam im Setup)
7. **Konkrete Tarif-Preise** (erfassen wir gemeinsam im Setup)

## Umsetzungsreihenfolge (Vorschlag)
1. **Projektgerüst:** Next.js + TypeScript + Tailwind + Prisma/PostgreSQL + Dockerfile + Coolify-Konfiguration + Test-Setup
2. Modul 1 — Login & Rechte (+ Audit-Log, E-Mail-Versand-Grundlage)
3. Modul 2 — Stammdaten + Startdaten Standorte/Räume
4. Modul 3 — Personenverwaltung
5. Modul 4 + 5 + 6 — Kurse, Anmeldungen, Lektionsgenerierung, Planer (Kern-Domäne)
6. Modul 7 — Anwesenheit
7. Modul 8 — Büro-Dienst-/Urlaubsplanung
8. Modul 9 + 10 — Rechnungen (QR) + Kursbestätigungen
9. Modul 11 — Honorare
10. Modul 12 — Vermietung
11. Modul 13 — Aufgaben & Anfragen
12. Modul 14 — KI-Generator (UI fertig, Anbindung inaktiv)
13. Modul 15 — Öffentliche Website + CMS + Popup
14. Modul 16 — Deployment-Feinschliff, Backups, Produktivgang
