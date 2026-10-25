#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6b8e5132d4c84f890be420bb4963130e2b1229fbf24bca64db7ffe0d56225ab5/contract';
import startContract from '../../snapshots/6b8e5132d4c84f890be420bb4963130e2b1229fbf24bca64db7ffe0d56225ab5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f02f594f2a1b657c39dea94b33795d25aa1f07bbc00725d749b4d6f86b4cea91/contract';
import endContract from '../../snapshots/f02f594f2a1b657c39dea94b33795d25aa1f07bbc00725d749b4d6f86b4cea91/contract.json' with { type: 'json' };
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
        typeName: 'AnwesenheitStatus',
        members: ['ANWESEND', 'ABWESEND_ENTSCHULDIGT', 'ABWESEND_UNENTSCHULDIGT'],
      }),
      this.addNativeEnumValue({
        schema: 'public',
        typeName: 'LektionStatus',
        value: 'DURCHGEFUEHRT',
      }),
      this.createTable({
        schema: 'public',
        table: 'Anwesenheit',
        columns: [
          col('anmeldungId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('bemerkung', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('erfasstAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('erfasstVonName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('korrigiertAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('lektionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"AnwesenheitStatus"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'AnwesenheitStatus' } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('vonLehrperson', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Lektion',
        column: col('abgeschlossenAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Lektion',
        column: col('anwesenheitErinnertAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anwesenheit',
        index: 'Anwesenheit_anmeldungId_idx',
        columns: ['anmeldungId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Anwesenheit',
        index: 'Anwesenheit_lektionId_anmeldungId_key',
        columns: ['lektionId', 'anmeldungId'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anwesenheit',
        foreignKey: {
          name: 'Anwesenheit_lektionId_fkey',
          columns: ['lektionId'],
          references: { schema: 'public', table: 'Lektion', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Anwesenheit',
        foreignKey: {
          name: 'Anwesenheit_anmeldungId_fkey',
          columns: ['anmeldungId'],
          references: { schema: 'public', table: 'Anmeldung', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
