#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/412f793ee267cc3470c5ef20ef6426c0ec02d7eb50c68725e14e915ed03182ca/contract';
import endContract from '../../snapshots/412f793ee267cc3470c5ef20ef6426c0ec02d7eb50c68725e14e915ed03182ca/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f02f594f2a1b657c39dea94b33795d25aa1f07bbc00725d749b4d6f86b4cea91/contract';
import startContract from '../../snapshots/f02f594f2a1b657c39dea94b33795d25aa1f07bbc00725d749b4d6f86b4cea91/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'BueroAbweichungArt',
        members: ['ARBEITSZEIT', 'FREI'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'BueroAbwesenheitArt',
        members: ['URLAUB', 'KRANKHEIT', 'SONSTIGE'],
      }),
      this.createTable({
        schema: 'public',
        table: 'BueroAbweichung',
        columns: [
          col('art', '"BueroAbweichungArt"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'BueroAbweichungArt' } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('datum', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('endZeit', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notiz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startZeit', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'BueroAbwesenheit',
        columns: [
          col('art', '"BueroAbwesenheitArt"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'BueroAbwesenheitArt' } },
          }),
          col('bemerkung', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bis', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('von', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'BueroDienst',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('endZeit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notiz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startZeit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('wochentag', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'BueroUrlaubskontingent',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('jahr', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tage', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BueroAbweichung',
        index: 'BueroAbweichung_datum_idx',
        columns: ['datum'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BueroAbweichung',
        index: 'BueroAbweichung_personId_datum_key',
        columns: ['personId', 'datum'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'BueroAbwesenheit',
        index: 'BueroAbwesenheit_personId_von_idx',
        columns: ['personId', 'von'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BueroAbwesenheit',
        index: 'BueroAbwesenheit_von_bis_idx',
        columns: ['von', 'bis'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BueroDienst',
        index: 'BueroDienst_personId_wochentag_idx',
        columns: ['personId', 'wochentag'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BueroUrlaubskontingent',
        index: 'BueroUrlaubskontingent_personId_jahr_key',
        columns: ['personId', 'jahr'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BueroAbweichung',
        foreignKey: {
          name: 'BueroAbweichung_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BueroAbwesenheit',
        foreignKey: {
          name: 'BueroAbwesenheit_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BueroDienst',
        foreignKey: {
          name: 'BueroDienst_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BueroUrlaubskontingent',
        foreignKey: {
          name: 'BueroUrlaubskontingent_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
