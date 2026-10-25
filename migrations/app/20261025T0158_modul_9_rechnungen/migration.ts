#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/412f793ee267cc3470c5ef20ef6426c0ec02d7eb50c68725e14e915ed03182ca/contract';
import startContract from '../../snapshots/412f793ee267cc3470c5ef20ef6426c0ec02d7eb50c68725e14e915ed03182ca/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d0264d130365d52f722ae2448ab014f175e5d615f180bb0b46832b441c7277d2/contract';
import endContract from '../../snapshots/d0264d130365d52f722ae2448ab014f175e5d615f180bb0b46832b441c7277d2/contract.json' with { type: 'json' };
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
        typeName: 'RechnungStatus',
        members: ['ENTWURF', 'VERSENDET', 'TEILBEZAHLT', 'BEZAHLT', 'STORNIERT'],
      }),
      this.createTable({
        schema: 'public',
        table: 'Mahnung',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fehler', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rechnungId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('stufe', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('versendetAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Rechnung',
        columns: [
          col('anmeldungId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('betragChf', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('empfaengerEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('empfaengerLand', 'text', {
            notNull: true,
            default: lit('CH'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('empfaengerName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('empfaengerOrt', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('empfaengerPlz', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('empfaengerStrasse', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('faelligAm', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kostentraegerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('letzteMahnAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('mahnStufe', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('mwstSatzProzent', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('notiz', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('nummer', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('personId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rechnungsdatum', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('referenzNr', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', '"RechnungStatus"', {
            notNull: true,
            default: lit('ENTWURF'),
            codecRef: { codecId: 'pg/enum@1', typeParams: { typeName: 'RechnungStatus' } },
          }),
          col('storniertAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('storniertGrund', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('totalChf', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('versendetAt', 'timestamp(3)', {
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'RechnungsPosition',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('einzelpreisChf', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('menge', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('rechnungId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reihenfolge', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Zahlung',
        columns: [
          col('actorName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bemerkung', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('betragChf', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
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
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rechnungId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Mahnung',
        index: 'Mahnung_rechnungId_idx',
        columns: ['rechnungId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rechnung',
        index: 'Rechnung_kostentraegerId_idx',
        columns: ['kostentraegerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rechnung',
        index: 'Rechnung_nummer_key',
        columns: ['nummer'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rechnung',
        index: 'Rechnung_personId_idx',
        columns: ['personId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rechnung',
        index: 'Rechnung_referenzNr_key',
        columns: ['referenzNr'],
        extras: { unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rechnung',
        index: 'Rechnung_status_faelligAm_idx',
        columns: ['status', 'faelligAm'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RechnungsPosition',
        index: 'RechnungsPosition_rechnungId_idx',
        columns: ['rechnungId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Zahlung',
        index: 'Zahlung_rechnungId_idx',
        columns: ['rechnungId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Mahnung',
        foreignKey: {
          name: 'Mahnung_rechnungId_fkey',
          columns: ['rechnungId'],
          references: { schema: 'public', table: 'Rechnung', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Rechnung',
        foreignKey: {
          name: 'Rechnung_personId_fkey',
          columns: ['personId'],
          references: { schema: 'public', table: 'Person', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Rechnung',
        foreignKey: {
          name: 'Rechnung_kostentraegerId_fkey',
          columns: ['kostentraegerId'],
          references: { schema: 'public', table: 'Kostentraeger', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Rechnung',
        foreignKey: {
          name: 'Rechnung_anmeldungId_fkey',
          columns: ['anmeldungId'],
          references: { schema: 'public', table: 'Anmeldung', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RechnungsPosition',
        foreignKey: {
          name: 'RechnungsPosition_rechnungId_fkey',
          columns: ['rechnungId'],
          references: { schema: 'public', table: 'Rechnung', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Zahlung',
        foreignKey: {
          name: 'Zahlung_rechnungId_fkey',
          columns: ['rechnungId'],
          references: { schema: 'public', table: 'Rechnung', columns: ['id'] },
          onDelete: 'cascade',
          onUpdate: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Zahlung',
        foreignKey: {
          name: 'Zahlung_actorUserId_fkey',
          columns: ['actorUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
