#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/10cd32cbcf39c462c93242877cb595645363916a4759257d4049964301779c75/contract';
import endContract from '../../snapshots/10cd32cbcf39c462c93242877cb595645363916a4759257d4049964301779c75/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f105b98f732b6296dc99844463ec3c11db417eabd306d23e5fc17a1cf1098917/contract';
import startContract from '../../snapshots/f105b98f732b6296dc99844463ec3c11db417eabd306d23e5fc17a1cf1098917/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'PublicFormVersuch',
        columns: [
          col('createdAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('form', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ip', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PublicFormVersuch',
        index: 'PublicFormVersuch_form_email_createdAt_idx',
        columns: ['form', 'email', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PublicFormVersuch',
        index: 'PublicFormVersuch_form_ip_createdAt_idx',
        columns: ['form', 'ip', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
