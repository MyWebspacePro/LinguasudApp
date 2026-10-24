// Konfiguration der «flachen» Stammdaten-Entitäten (reine Daten, kein Server-
// Import): treibt den generischen FlatEntityManager (Felder, Tabelle, Formulare).

export type FieldType = "text" | "number" | "checkbox" | "select" | "time";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** select: Optionen */
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  min?: number;
  /** Zahl optional (z.B. Kursart.maxParticipants = individuell) */
  optionalNumber?: boolean;
  /** schmalere Spalte in der Tabelle */
  narrow?: boolean;
}

export interface EntityConfig {
  key: FlatEntityKey;
  label: string;
  /** Einzahl für Meldungen, z.B. «Sprache» */
  labelOne: string;
  fields: FieldDef[];
}

export type FlatEntityKey = "sprache" | "niveau" | "kursart" | "dauer" | "kostentraeger";

export const FLAT_ENTITIES: Record<FlatEntityKey, EntityConfig> = {
  sprache: {
    key: "sprache",
    label: "Sprachen",
    labelOne: "Sprache",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "z.B. Portugiesisch" },
      { name: "code", label: "Kürzel", type: "text", required: true, placeholder: "z.B. PT", narrow: true, help: "Für Kurscodes (2–3 Buchstaben)" },
    ],
  },
  niveau: {
    key: "niveau",
    label: "Niveaus",
    labelOne: "Niveau",
    fields: [
      { name: "code", label: "Code", type: "text", required: true, placeholder: "z.B. B1", narrow: true },
      { name: "name", label: "Bezeichnung (optional)", type: "text", placeholder: "z.B. Selbstständig" },
      { name: "sortOrder", label: "Sortierung", type: "number", min: 0, narrow: true },
    ],
  },
  kursart: {
    key: "kursart",
    label: "Kursarten",
    labelOne: "Kursart",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "z.B. 5er" },
      { name: "maxParticipants", label: "Teilnehmer max.", type: "number", min: 1, optionalNumber: true, narrow: true, help: "Leer = individuell (Firmenkurs)" },
      { name: "requiresRoom", label: "Raum nötig", type: "checkbox", narrow: true, help: "Online-Kurse: Raum optional" },
      { name: "sortOrder", label: "Sortierung", type: "number", min: 0, narrow: true },
    ],
  },
  dauer: {
    key: "dauer",
    label: "Lektionsdauern",
    labelOne: "Lektionsdauer",
    fields: [
      { name: "minuten", label: "Minuten", type: "number", required: true, min: 15, narrow: true, help: "z.B. 45, 60, 90" },
    ],
  },
  kostentraeger: {
    key: "kostentraeger",
    label: "Kostenträger",
    labelOne: "Kostenträger",
    fields: [
      {
        name: "art",
        label: "Art",
        type: "select",
        required: true,
        options: [
          { value: "FIRMA", label: "Firma" },
          { value: "OEFFENTLICHE_EINRICHTUNG", label: "Öffentliche Einrichtung" },
        ],
        narrow: true,
      },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "kundennummer", label: "Kundennummer", type: "text", required: true, narrow: true },
      { name: "strasse", label: "Strasse", type: "text", required: true },
      { name: "plz", label: "PLZ", type: "text", required: true, narrow: true },
      { name: "ort", label: "Ort", type: "text", required: true },
    ],
  },
};
