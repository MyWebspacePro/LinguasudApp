#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1df251fb9578853b1bfad6189e5905fdae4ac3c48f4b4997690dfcd76e648dda/contract';
import startContract from '../../snapshots/1df251fb9578853b1bfad6189e5905fdae4ac3c48f4b4997690dfcd76e648dda/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6b8e5132d4c84f890be420bb4963130e2b1229fbf24bca64db7ffe0d56225ab5/contract';
import endContract from '../../snapshots/6b8e5132d4c84f890be420bb4963130e2b1229fbf24bca64db7ffe0d56225ab5/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'AnmeldungStatus',
        members: ['PROBE', 'AKTIV', 'BEENDET'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'BillingTyp',
        members: ['PRIVAT', 'FIRMA', 'OEFFENTLICHE_EINRICHTUNG'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'JournalArt',
        members: [
          'AUFLADUNG',
          'VERBRAUCH',
          'FEHLZEIT_UNENTSCHULDIGT',
          'FEHLZEIT_ENTSCHULDIGT',
          'KORREKTUR',
        ],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'KursStatus',
        members: ['GEPLANT', 'AKTIV', 'PAUSIERT', 'ABGESCHLOSSEN', 'ABGESAGT'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'LektionStatus',
        members: ['PROVISORISCH', 'FIXIERT', 'ABGESAGT'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'PaketEntscheid',
        members: ['OFFEN', 'VERLAENGERT', 'BEENDET'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Anmeldung',
        columns: [
          col('billingTyp', '"BillingTyp"', {
            notNull: true,
            default: lit('PRIVAT'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'BillingTyp' } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kostentraegerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('kursId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notizen', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paketEndeGemeldetAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('paketEntscheid', '"PaketEntscheid"', {
            notNull: true,
            default: lit('OFFEN'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'PaketEntscheid' } },
          }),
          col('paketGroesse', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('paketGroesseUebersteuert', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('paketStartAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('preisAbweichungGrund', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('preisChf', 'numeric(8,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 8, scale: 2 } },
          }),
          col('preisUebersteuert', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('rechnungsempfaengerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"AnmeldungStatus"', {
            notNull: true,
            default: lit('PROBE'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'AnmeldungStatus' } },
          }),
          col('tarifUebersteuert', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('tarifstufeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'GuthabenJournal',
        columns: [
          col('actorName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('anmeldungId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('art', '"JournalArt"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'JournalArt' } },
          }),
          col('bemerkung', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('datum', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('delta', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lektionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Kurs',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('dauerMinuten', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('extern', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('externOrt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kostentraegerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('kursartId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lehrpersonId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('maxParticipants', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('niveauId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notizen', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('spracheId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('standardRaumId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startZeit', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"KursStatus"', {
            notNull: true,
            default: lit('GEPLANT'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'KursStatus' } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('wochentag', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'KursNiveauVerlauf',
        columns: [
          col('bis', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('gemeldetVonLehrperson', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('niveauId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('von', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'KursUnterbrechung',
        columns: [
          col('bis', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('gemeldetVonLehrperson', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('grund', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('von', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Lektion',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('dauerMinuten', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('fixiertAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lehrpersonId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notiz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('quelle', 'text', {
            notNull: true,
            default: lit('GENERIERT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('raumId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('status', '"LektionStatus"', {
            notNull: true,
            default: lit('PROVISORISCH'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'LektionStatus' } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anmeldung',
        index: 'Anmeldung_kursId_status_idx',
        columns: ['kursId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anmeldung',
        index: 'Anmeldung_personId_idx',
        columns: ['personId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anmeldung',
        index: 'Anmeldung_status_paketEntscheid_idx',
        columns: ['status', 'paketEntscheid'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'GuthabenJournal',
        index: 'GuthabenJournal_anmeldungId_datum_idx',
        columns: ['anmeldungId', 'datum'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Kurs',
        index: 'Kurs_code_key',
        columns: ['code'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Kurs',
        index: 'Kurs_lehrpersonId_idx',
        columns: ['lehrpersonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Kurs',
        index: 'Kurs_spracheId_niveauId_idx',
        columns: ['spracheId', 'niveauId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Kurs',
        index: 'Kurs_status_idx',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'KursNiveauVerlauf',
        index: 'KursNiveauVerlauf_kursId_von_idx',
        columns: ['kursId', 'von'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'KursUnterbrechung',
        index: 'KursUnterbrechung_kursId_von_idx',
        columns: ['kursId', 'von'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Lektion',
        index: 'Lektion_kursId_startAt_idx',
        columns: ['kursId', 'startAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Lektion',
        index: 'Lektion_startAt_idx',
        columns: ['startAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anmeldung',
        foreignKey: {
          name: 'Anmeldung_kursId_fkey',
          columns: ['kursId'],
          references: { schema: 'public', table: 'Kurs', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anmeldung',
        foreignKey: {
          name: 'Anmeldung_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anmeldung',
        foreignKey: {
          name: 'Anmeldung_kostentraegerId_fkey',
          columns: ['kostentraegerId'],
          references: { schema: 'public', table: 'Kostentraeger', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anmeldung',
        foreignKey: {
          name: 'Anmeldung_rechnungsempfaengerId_fkey',
          columns: ['rechnungsempfaengerId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anmeldung',
        foreignKey: {
          name: 'Anmeldung_tarifstufeId_fkey',
          columns: ['tarifstufeId'],
          references: { schema: 'public', table: 'Tarifstufe', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'GuthabenJournal',
        foreignKey: {
          name: 'GuthabenJournal_anmeldungId_fkey',
          columns: ['anmeldungId'],
          references: { schema: 'public', table: 'Anmeldung', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'GuthabenJournal',
        foreignKey: {
          name: 'GuthabenJournal_lektionId_fkey',
          columns: ['lektionId'],
          references: { schema: 'public', table: 'Lektion', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'GuthabenJournal',
        foreignKey: {
          name: 'GuthabenJournal_actorUserId_fkey',
          columns: ['actorUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kurs',
        foreignKey: {
          name: 'Kurs_spracheId_fkey',
          columns: ['spracheId'],
          references: { schema: 'public', table: 'Sprache', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kurs',
        foreignKey: {
          name: 'Kurs_niveauId_fkey',
          columns: ['niveauId'],
          references: { schema: 'public', table: 'Niveau', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kurs',
        foreignKey: {
          name: 'Kurs_kursartId_fkey',
          columns: ['kursartId'],
          references: { schema: 'public', table: 'Kursart', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kurs',
        foreignKey: {
          name: 'Kurs_lehrpersonId_fkey',
          columns: ['lehrpersonId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kurs',
        foreignKey: {
          name: 'Kurs_standardRaumId_fkey',
          columns: ['standardRaumId'],
          references: { schema: 'public', table: 'Raum', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kurs',
        foreignKey: {
          name: 'Kurs_kostentraegerId_fkey',
          columns: ['kostentraegerId'],
          references: { schema: 'public', table: 'Kostentraeger', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'KursNiveauVerlauf',
        foreignKey: {
          name: 'KursNiveauVerlauf_kursId_fkey',
          columns: ['kursId'],
          references: { schema: 'public', table: 'Kurs', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'KursNiveauVerlauf',
        foreignKey: {
          name: 'KursNiveauVerlauf_niveauId_fkey',
          columns: ['niveauId'],
          references: { schema: 'public', table: 'Niveau', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'KursUnterbrechung',
        foreignKey: {
          name: 'KursUnterbrechung_kursId_fkey',
          columns: ['kursId'],
          references: { schema: 'public', table: 'Kurs', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Lektion',
        foreignKey: {
          name: 'Lektion_kursId_fkey',
          columns: ['kursId'],
          references: { schema: 'public', table: 'Kurs', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Lektion',
        foreignKey: {
          name: 'Lektion_lehrpersonId_fkey',
          columns: ['lehrpersonId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Lektion',
        foreignKey: {
          name: 'Lektion_raumId_fkey',
          columns: ['raumId'],
          references: { schema: 'public', table: 'Raum', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
