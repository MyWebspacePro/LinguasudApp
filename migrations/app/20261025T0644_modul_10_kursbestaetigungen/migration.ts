#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/177ae0e1aba9645650aa6288c70b1bacbe9c7649529d4828f4eff84ddb571962/contract';
import endContract from '../../snapshots/177ae0e1aba9645650aa6288c70b1bacbe9c7649529d4828f4eff84ddb571962/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d0264d130365d52f722ae2448ab014f175e5d615f180bb0b46832b441c7277d2/contract';
import startContract from '../../snapshots/d0264d130365d52f722ae2448ab014f175e5d615f180bb0b46832b441c7277d2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'BestaetigungsAusloeser',
        members: ['NIVEAU_WECHSEL', 'MANUELL'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Kursbestaetigung',
        columns: [
          col('anmeldungId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ausgestelltVonName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ausloeser', '"BestaetigungsAusloeser"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'BestaetigungsAusloeser' } },
          }),
          col('ausstellungsdatum', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('besuchteLektionen', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kursartName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('niveauCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('niveauName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('personAnrede', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('personName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('spracheName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('verlaufId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('zeitraumBis', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('zeitraumVon', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Kursbestaetigung',
        index: 'Kursbestaetigung_kursId_idx',
        columns: ['kursId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Kursbestaetigung',
        index: 'Kursbestaetigung_personId_ausstellungsdatum_idx',
        columns: ['personId', 'ausstellungsdatum'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Kursbestaetigung',
        index: 'Kursbestaetigung_personId_verlaufId_key',
        columns: ['personId', 'verlaufId'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kursbestaetigung',
        foreignKey: {
          name: 'Kursbestaetigung_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kursbestaetigung',
        foreignKey: {
          name: 'Kursbestaetigung_kursId_fkey',
          columns: ['kursId'],
          references: { schema: 'public', table: 'Kurs', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kursbestaetigung',
        foreignKey: {
          name: 'Kursbestaetigung_verlaufId_fkey',
          columns: ['verlaufId'],
          references: { schema: 'public', table: 'KursNiveauVerlauf', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Kursbestaetigung',
        foreignKey: {
          name: 'Kursbestaetigung_anmeldungId_fkey',
          columns: ['anmeldungId'],
          references: { schema: 'public', table: 'Anmeldung', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
