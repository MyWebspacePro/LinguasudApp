#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/10cd32cbcf39c462c93242877cb595645363916a4759257d4049964301779c75/contract';
import startContract from '../../snapshots/10cd32cbcf39c462c93242877cb595645363916a4759257d4049964301779c75/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fbb48def7deb8c71f91ca1587127f4e683a0942d123b7bb961d6352021b489a2/contract';
import endContract from '../../snapshots/fbb48def7deb8c71f91ca1587127f4e683a0942d123b7bb961d6352021b489a2/contract.json' with { type: 'json' };
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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
