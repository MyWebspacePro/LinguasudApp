#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/10cd32cbcf39c462c93242877cb595645363916a4759257d4049964301779c75/contract';
import startContract from '../../snapshots/10cd32cbcf39c462c93242877cb595645363916a4759257d4049964301779c75/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d2ab4950663dcb4308970b1c083febebb64474d9f1cde5ce4c139304e416e05a/contract';
import endContract from '../../snapshots/d2ab4950663dcb4308970b1c083febebb64474d9f1cde5ce4c139304e416e05a/contract.json' with { type: 'json' };
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
        typeName: 'KiModus',
        members: ['STRUKTUR', 'FREI'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'WebsiteLocale',
        members: ['DE', 'EN'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'WebsiteSeiteTyp',
        members: ['START', 'SPRACHE', 'SEITE'],
      }),
      this.createTable({
        schema: 'public',
        table: 'KiLektion',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('dauerMs', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('ergebnis', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('erstelltVonName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('erstelltVonUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('geteilt', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursartId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('modell', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('modus', '"KiModus"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'KiModus' } },
          }),
          col('niveauId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('parameter', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('prompt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('spracheId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('thema', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('titel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenInput', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('tokenOutput', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'WebsitePopup',
        columns: [
          col('aktiv', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('bildUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('buttonLabel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('buttonUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('gueltigBis', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('gueltigVon', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('titel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'WebsiteSeite',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('archivedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('imFuss', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('inNavigation', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('navSortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('spracheId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('typ', '"WebsiteSeiteTyp"', {
            notNull: true,
            default: lit('SEITE'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'WebsiteSeiteTyp' } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'WebsiteSeiteUebersetzung',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inhalt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('locale', '"WebsiteLocale"', {
            notNull: true,
            default: lit('DE'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'WebsiteLocale' } },
          }),
          col('seiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('seoBeschreibung', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('seoTitel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('titel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('untertitel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'KiLektion',
        index: 'KiLektion_createdAt_idx',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'KiLektion',
        index: 'KiLektion_erstelltVonUserId_createdAt_idx',
        columns: ['erstelltVonUserId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'KiLektion',
        index: 'KiLektion_geteilt_createdAt_idx',
        columns: ['geteilt', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsitePopup',
        index: 'WebsitePopup_aktiv_idx',
        columns: ['aktiv'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteSeite',
        index: 'WebsiteSeite_inNavigation_navSortOrder_idx',
        columns: ['inNavigation', 'navSortOrder'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteSeite',
        index: 'WebsiteSeite_slug_key',
        columns: ['slug'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteSeite',
        index: 'WebsiteSeite_spracheId_key',
        columns: ['spracheId'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteSeite',
        index: 'WebsiteSeite_typ_active_idx',
        columns: ['typ', 'active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteSeiteUebersetzung',
        index: 'WebsiteSeiteUebersetzung_seiteId_locale_key',
        columns: ['seiteId', 'locale'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'KiLektion',
        foreignKey: {
          name: 'KiLektion_erstelltVonUserId_fkey',
          columns: ['erstelltVonUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'KiLektion',
        foreignKey: {
          name: 'KiLektion_spracheId_fkey',
          columns: ['spracheId'],
          references: { schema: 'public', table: 'Sprache', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'KiLektion',
        foreignKey: {
          name: 'KiLektion_niveauId_fkey',
          columns: ['niveauId'],
          references: { schema: 'public', table: 'Niveau', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'KiLektion',
        foreignKey: {
          name: 'KiLektion_kursartId_fkey',
          columns: ['kursartId'],
          references: { schema: 'public', table: 'Kursart', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebsiteSeite',
        foreignKey: {
          name: 'WebsiteSeite_spracheId_fkey',
          columns: ['spracheId'],
          references: { schema: 'public', table: 'Sprache', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebsiteSeiteUebersetzung',
        foreignKey: {
          name: 'WebsiteSeiteUebersetzung_seiteId_fkey',
          columns: ['seiteId'],
          references: { schema: 'public', table: 'WebsiteSeite', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
