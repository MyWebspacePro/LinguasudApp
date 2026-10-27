#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/e558cb7e1b5d2b4abae3142585604187b29c286de6e1444d7725e567b0cab6e4/contract';
import startContract from '../../snapshots/e558cb7e1b5d2b4abae3142585604187b29c286de6e1444d7725e567b0cab6e4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f105b98f732b6296dc99844463ec3c11db417eabd306d23e5fc17a1cf1098917/contract';
import endContract from '../../snapshots/f105b98f732b6296dc99844463ec3c11db417eabd306d23e5fc17a1cf1098917/contract.json' with { type: 'json' };
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
        typeName: 'AnfrageStatus',
        members: ['OFFEN', 'IN_BEARBEITUNG', 'ZUGEORDNET', 'ABGELEHNT'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'AufgabeStatus',
        members: ['OFFEN', 'ERLEDIGT'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Anfrage',
        columns: [
          col('ablehnungsGrund', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bestaetigtAm', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('bestaetigtVia', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('empfohlenesNiveauId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nachricht', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('niveauId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('spracheId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"AnfrageStatus"', {
            notNull: true,
            default: lit('OFFEN'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'AnfrageStatus' } },
          }),
          col('telefon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('testResultat', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('zugeordnetAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('zugeordnetVonName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Aufgabe',
        columns: [
          col('anfrageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('assigneeUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('beschreibung', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('dedupKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('erledigtAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('erledigtVonName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('faelligAm', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('quelle', 'text', {
            notNull: true,
            default: lit('manual'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', '"AufgabeStatus"', {
            notNull: true,
            default: lit('OFFEN'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'AufgabeStatus' } },
          }),
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
        table: 'Einstufungsfrage',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('antwort1', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('antwort2', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('antwort3', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('antwort4', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('archivedAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('niveauId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('richtig', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('spracheId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anfrage',
        index: 'Anfrage_email_idx',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anfrage',
        index: 'Anfrage_personId_idx',
        columns: ['personId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anfrage',
        index: 'Anfrage_status_createdAt_idx',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Aufgabe',
        index: 'Aufgabe_anfrageId_idx',
        columns: ['anfrageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Aufgabe',
        index: 'Aufgabe_assigneeUserId_status_idx',
        columns: ['assigneeUserId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Aufgabe',
        index: 'Aufgabe_dedupKey_key',
        columns: ['dedupKey'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Aufgabe',
        index: 'Aufgabe_kursId_idx',
        columns: ['kursId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Aufgabe',
        index: 'Aufgabe_personId_idx',
        columns: ['personId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Aufgabe',
        index: 'Aufgabe_status_faelligAm_idx',
        columns: ['status', 'faelligAm'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Einstufungsfrage',
        index: 'Einstufungsfrage_active_idx',
        columns: ['active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Einstufungsfrage',
        index: 'Einstufungsfrage_spracheId_niveauId_sortOrder_idx',
        columns: ['spracheId', 'niveauId', 'sortOrder'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anfrage',
        foreignKey: {
          name: 'Anfrage_spracheId_fkey',
          columns: ['spracheId'],
          references: { schema: 'public', table: 'Sprache', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anfrage',
        foreignKey: {
          name: 'Anfrage_niveauId_fkey',
          columns: ['niveauId'],
          references: { schema: 'public', table: 'Niveau', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anfrage',
        foreignKey: {
          name: 'Anfrage_empfohlenesNiveauId_fkey',
          columns: ['empfohlenesNiveauId'],
          references: { schema: 'public', table: 'Niveau', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anfrage',
        foreignKey: {
          name: 'Anfrage_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Aufgabe',
        foreignKey: {
          name: 'Aufgabe_assigneeUserId_fkey',
          columns: ['assigneeUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Aufgabe',
        foreignKey: {
          name: 'Aufgabe_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Aufgabe',
        foreignKey: {
          name: 'Aufgabe_kursId_fkey',
          columns: ['kursId'],
          references: { schema: 'public', table: 'Kurs', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Aufgabe',
        foreignKey: {
          name: 'Aufgabe_anfrageId_fkey',
          columns: ['anfrageId'],
          references: { schema: 'public', table: 'Anfrage', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Einstufungsfrage',
        foreignKey: {
          name: 'Einstufungsfrage_spracheId_fkey',
          columns: ['spracheId'],
          references: { schema: 'public', table: 'Sprache', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Einstufungsfrage',
        foreignKey: {
          name: 'Einstufungsfrage_niveauId_fkey',
          columns: ['niveauId'],
          references: { schema: 'public', table: 'Niveau', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
