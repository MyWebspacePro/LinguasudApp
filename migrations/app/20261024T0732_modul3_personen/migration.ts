#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1df251fb9578853b1bfad6189e5905fdae4ac3c48f4b4997690dfcd76e648dda/contract';
import endContract from '../../snapshots/1df251fb9578853b1bfad6189e5905fdae4ac3c48f4b4997690dfcd76e648dda/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/37c31a3a146c8192f23191f1cf3523521b82d18453a518275c2881d0bac8068b/contract';
import startContract from '../../snapshots/37c31a3a146c8192f23191f1cf3523521b82d18453a518275c2881d0bac8068b/contract.json' with { type: 'json' };
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
        typeName: 'Anrede',
        members: ['HERR', 'FRAU', 'DIVERS'],
      }),
      this.createNativeEnumType({
        schema: 'public',
        typeName: 'PersonStatus',
        members: ['INTERESSENT', 'AKTIV', 'INAKTIV'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Lehrqualifikation',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('niveauId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('spracheId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Person',
        columns: [
          col('anrede', '"Anrede"', {
            notNull: true,
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'Anrede' } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('istLehrperson', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('kuerzel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('nachname', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ort', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('plz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rechnungOrt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rechnungPlz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rechnungStrasse', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('signal1', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('signal2', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('status', '"PersonStatus"', {
            notNull: true,
            default: lit('INTERESSENT'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'PersonStatus' } },
          }),
          col('strasse', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('telefon1', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('telefon2', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('vorname', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('whatsapp1', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('whatsapp2', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PersonBeziehung',
        columns: [
          col('berechtigterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kindId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PersonNotiz',
        columns: [
          col('authorName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('authorUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('personId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Lehrqualifikation',
        index: 'Lehrqualifikation_personId_spracheId_niveauId_key',
        columns: ['personId', 'spracheId', 'niveauId'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Person',
        index: 'Person_kuerzel_key',
        columns: ['kuerzel'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Person',
        index: 'Person_nachname_vorname_idx',
        columns: ['nachname', 'vorname'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Person',
        index: 'Person_status_idx',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PersonBeziehung',
        index: 'PersonBeziehung_berechtigterId_idx',
        columns: ['berechtigterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PersonBeziehung',
        index: 'PersonBeziehung_kindId_berechtigterId_key',
        columns: ['kindId', 'berechtigterId'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'PersonNotiz',
        index: 'PersonNotiz_personId_createdAt_idx',
        columns: ['personId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'User',
        index: 'User_personId_key',
        columns: ['personId'],
        extras: { unique: true },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Lehrqualifikation',
        foreignKey: {
          name: 'Lehrqualifikation_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Lehrqualifikation',
        foreignKey: {
          name: 'Lehrqualifikation_spracheId_fkey',
          columns: ['spracheId'],
          references: { schema: 'public', table: 'Sprache', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Lehrqualifikation',
        foreignKey: {
          name: 'Lehrqualifikation_niveauId_fkey',
          columns: ['niveauId'],
          references: { schema: 'public', table: 'Niveau', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PersonBeziehung',
        foreignKey: {
          name: 'PersonBeziehung_kindId_fkey',
          columns: ['kindId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PersonBeziehung',
        foreignKey: {
          name: 'PersonBeziehung_berechtigterId_fkey',
          columns: ['berechtigterId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PersonNotiz',
        foreignKey: {
          name: 'PersonNotiz_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PersonNotiz',
        foreignKey: {
          name: 'PersonNotiz_authorUserId_fkey',
          columns: ['authorUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'User',
        foreignKey: {
          name: 'User_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
