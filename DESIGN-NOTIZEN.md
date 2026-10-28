# Design-Notizen — LinguasudApp

Gesammeltes Feedback für die **Design-Runde nach Modul 2** (Stammdaten).
Basis ist das Bordeaux-Design-System in `src/app/globals.css`
(`--color-brand-*`, `.card`, `.btn-*`, `.input`, …) — zentrale Änderungen
wirken auf alle Seiten.

## Bereits umgesetzt (24.10.2026)

- **Volle Breite**: Verwaltungsbereich ohne `max-w`-Begrenzung; Header,
  Sidebar und Inhalt nutzen das ganze Fenster.
- **Sidebar farblich abgegrenzt** (keine Trennlinie): bordeaux-getöntes
  Panel (`bg-brand-100`), aktiver Nav-Eintrag als weisse Fläche mit
  Schatten («Pill»-Stil), Rollen-Chips unten.
- **Schriftkontraste erhöht**: Nebentexte `slate-500 → slate-600`,
  Hinweise `slate-400 → slate-500`; Placeholder und Tabellenköpfe
  nachgezogen.
- **Moderne Radien**: Karten/Inputs/Buttons/Alerts `rounded-lg`.
- **Sidebar dunkel (27.10.2026)**: Panel `bg-brand-100 → bg-brand-800`
  (dunkles Magenta/Bordeaux) mit heller Schrift (`brand-100`/`brand-50`);
  aktiver Nav-Eintrag bleibt weisse Fläche («Pill»), Mobile-Nav als
  dunkles gerundetes Panel.

## Für die grosse Design-Runde (nach Modul 2)

- **Wunsch: frisch und modern, leicht und gut lesbar** — Gesamteindruck
  soll nicht altbacken/wirklich dröge wirken. Nicht 1:1 von
  LinguasudSoftware übernehmen; eigenes Design entwickeln.
- Inspiration Richtungen (zur Diskussion):
  - mehr Weisraum/Luft in Karten und Tabellen bei voller Breite
  - feinere Typografie-Hierarchie (grössere Seitentitel, ruhigere Labels)
  - sanfte Schatten/Tiefenstaffelung statt vieler Umrandungen
  - Bordeaux gezielter einsetzen (Akte, aktive Zustände) — Flächen ruhig lassen
  - Login-Seite als Visitenkarte (Illustration/Foto-Andeutung, Split-Layout?)
- Kontraste konsequent auf WCAG AA halten (kleine Texte ≥ 4.5:1).

## Offene Fragen an den Kunden (bei der Design-Runde klären)

- Logo-Datei (ersetzt die «L»-Kachel) — steht auch im Pflichtenheft als
  offener Punkt.
- Soll die Sidebar auf Mobile/Tablet als ausfahrbares Menü laufen?
- Dichte: kompakt (aktuell) oder luftiger?
