#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2eadc7db4d6f4337490dc7f78c6e9c09b6c6fd2b8989bc6c4dfa8a9a3a4ac7d4/contract';
import startContract from '../../snapshots/2eadc7db4d6f4337490dc7f78c6e9c09b6c6fd2b8989bc6c4dfa8a9a3a4ac7d4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e558cb7e1b5d2b4abae3142585604187b29c286de6e1444d7725e567b0cab6e4/contract';
import endContract from '../../snapshots/e558cb7e1b5d2b4abae3142585604187b29c286de6e1444d7725e567b0cab6e4/contract.json' with { type: 'json' };
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
        typeName: 'VermietungStatus',
        members: ['GEPLANT', 'FINDET_STATT', 'ABGESAGT'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Vermietung',
        columns: [
          col('absageGrund', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('dauerMinuten', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mieterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notiz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('preisChf', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('raumId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rechnungId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('serieId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('status', '"VermietungStatus"', {
            notNull: true,
            default: lit('GEPLANT'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'VermietungStatus' } },
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
        table: 'VermietungMieter',
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
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notiz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ort', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('plz', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('strasse', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('telefon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'VermietungSerie',
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
          col('endZeit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mieterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notiz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('preisChf', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('raumId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startZeit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('von', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('wochentag', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Rechnung',
        column: col('mieterId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rechnung',
        index: 'Rechnung_mieterId_idx',
        columns: ['mieterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Vermietung',
        index: 'Vermietung_mieterId_idx',
        columns: ['mieterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Vermietung',
        index: 'Vermietung_raumId_startAt_idx',
        columns: ['raumId', 'startAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Vermietung',
        index: 'Vermietung_rechnungId_key',
        columns: ['rechnungId'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Vermietung',
        index: 'Vermietung_serieId_idx',
        columns: ['serieId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Vermietung',
        index: 'Vermietung_startAt_idx',
        columns: ['startAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VermietungMieter',
        index: 'VermietungMieter_active_idx',
        columns: ['active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VermietungMieter',
        index: 'VermietungMieter_name_idx',
        columns: ['name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VermietungSerie',
        index: 'VermietungSerie_mieterId_idx',
        columns: ['mieterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'VermietungSerie',
        index: 'VermietungSerie_von_idx',
        columns: ['von'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Vermietung',
        foreignKey: {
          name: 'Vermietung_mieterId_fkey',
          columns: ['mieterId'],
          references: { schema: 'public', table: 'VermietungMieter', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Vermietung',
        foreignKey: {
          name: 'Vermietung_raumId_fkey',
          columns: ['raumId'],
          references: { schema: 'public', table: 'Raum', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Vermietung',
        foreignKey: {
          name: 'Vermietung_serieId_fkey',
          columns: ['serieId'],
          references: { schema: 'public', table: 'VermietungSerie', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Vermietung',
        foreignKey: {
          name: 'Vermietung_rechnungId_fkey',
          columns: ['rechnungId'],
          references: { schema: 'public', table: 'Rechnung', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Rechnung',
        foreignKey: {
          name: 'Rechnung_mieterId_fkey',
          columns: ['mieterId'],
          references: { schema: 'public', table: 'VermietungMieter', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VermietungSerie',
        foreignKey: {
          name: 'VermietungSerie_mieterId_fkey',
          columns: ['mieterId'],
          references: { schema: 'public', table: 'VermietungMieter', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'VermietungSerie',
        foreignKey: {
          name: 'VermietungSerie_raumId_fkey',
          columns: ['raumId'],
          references: { schema: 'public', table: 'Raum', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
