#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/177ae0e1aba9645650aa6288c70b1bacbe9c7649529d4828f4eff84ddb571962/contract';
import startContract from '../../snapshots/177ae0e1aba9645650aa6288c70b1bacbe9c7649529d4828f4eff84ddb571962/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/2eadc7db4d6f4337490dc7f78c6e9c09b6c6fd2b8989bc6c4dfa8a9a3a4ac7d4/contract';
import endContract from '../../snapshots/2eadc7db4d6f4337490dc7f78c6e9c09b6c6fd2b8989bc6c4dfa8a9a3a4ac7d4/contract.json' with { type: 'json' };
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
        typeName: 'HonorarStatus',
        members: ['OFFEN', 'BEZAHLT'],
      }),
      this.createTable({
        schema: 'public',
        table: 'HonorarAbrechnung',
        columns: [
          col('actorName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bezahltAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lehrpersonId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lektionenAnzahl', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('monat', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"HonorarStatus"', {
            notNull: true,
            default: lit('OFFEN'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'HonorarStatus' } },
          }),
          col('totalChf', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
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
        table: 'HonorarSatz',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursartId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lehrpersonId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('minuten', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stundensatzChf', 'numeric(8,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 8, scale: 2 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HonorarAbrechnung',
        index: 'HonorarAbrechnung_lehrpersonId_monat_key',
        columns: ['lehrpersonId', 'monat'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'HonorarAbrechnung',
        index: 'HonorarAbrechnung_monat_idx',
        columns: ['monat'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HonorarSatz',
        index: 'HonorarSatz_lehrpersonId_idx',
        columns: ['lehrpersonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HonorarSatz',
        index: 'HonorarSatz_lehrpersonId_kursartId_minuten_key',
        columns: ['lehrpersonId', 'kursartId', 'minuten'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HonorarAbrechnung',
        foreignKey: {
          name: 'HonorarAbrechnung_lehrpersonId_fkey',
          columns: ['lehrpersonId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HonorarAbrechnung',
        foreignKey: {
          name: 'HonorarAbrechnung_actorUserId_fkey',
          columns: ['actorUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HonorarSatz',
        foreignKey: {
          name: 'HonorarSatz_lehrpersonId_fkey',
          columns: ['lehrpersonId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HonorarSatz',
        foreignKey: {
          name: 'HonorarSatz_kursartId_fkey',
          columns: ['kursartId'],
          references: { schema: 'public', table: 'Kursart', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
