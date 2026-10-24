-- CreateEnum
CREATE TYPE "KostentraegerArt" AS ENUM ('FIRMA', 'OEFFENTLICHE_EINRICHTUNG');

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Standort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strasse" TEXT NOT NULL,
    "plz" TEXT NOT NULL,
    "ort" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etage" (
    "id" TEXT NOT NULL,
    "standortId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Etage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raum" (
    "id" TEXT NOT NULL,
    "etageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprache" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niveau" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Niveau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kursart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxParticipants" INTEGER,
    "requiresRoom" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kursart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lektionsdauer" (
    "id" TEXT NOT NULL,
    "minuten" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lektionsdauer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarifstufe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lessonsPerPackage" INTEGER NOT NULL,
    "middayFrom" TEXT,
    "middayTo" TEXT,
    "eveningFrom" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarifstufe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preis" (
    "id" TEXT NOT NULL,
    "kursartId" TEXT NOT NULL,
    "lektionsdauerId" TEXT NOT NULL,
    "tarifstufeId" TEXT NOT NULL,
    "amountChf" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "Preis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kostentraeger" (
    "id" TEXT NOT NULL,
    "art" "KostentraegerArt" NOT NULL,
    "name" TEXT NOT NULL,
    "kundennummer" TEXT NOT NULL,
    "strasse" TEXT NOT NULL,
    "plz" TEXT NOT NULL,
    "ort" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kostentraeger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Standort_name_key" ON "Standort"("name");

-- CreateIndex
CREATE INDEX "Standort_active_idx" ON "Standort"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Etage_standortId_name_key" ON "Etage"("standortId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Raum_etageId_name_key" ON "Raum"("etageId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Sprache_name_key" ON "Sprache"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sprache_code_key" ON "Sprache"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Niveau_code_key" ON "Niveau"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Kursart_name_key" ON "Kursart"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lektionsdauer_minuten_key" ON "Lektionsdauer"("minuten");

-- CreateIndex
CREATE UNIQUE INDEX "Tarifstufe_name_key" ON "Tarifstufe"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Preis_kursartId_lektionsdauerId_tarifstufeId_key" ON "Preis"("kursartId", "lektionsdauerId", "tarifstufeId");

-- CreateIndex
CREATE UNIQUE INDEX "Kostentraeger_kundennummer_key" ON "Kostentraeger"("kundennummer");

-- CreateIndex
CREATE INDEX "Kostentraeger_name_idx" ON "Kostentraeger"("name");

-- CreateIndex
CREATE INDEX "Kostentraeger_active_idx" ON "Kostentraeger"("active");

-- AddForeignKey
ALTER TABLE "Etage" ADD CONSTRAINT "Etage_standortId_fkey" FOREIGN KEY ("standortId") REFERENCES "Standort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raum" ADD CONSTRAINT "Raum_etageId_fkey" FOREIGN KEY ("etageId") REFERENCES "Etage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preis" ADD CONSTRAINT "Preis_kursartId_fkey" FOREIGN KEY ("kursartId") REFERENCES "Kursart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preis" ADD CONSTRAINT "Preis_lektionsdauerId_fkey" FOREIGN KEY ("lektionsdauerId") REFERENCES "Lektionsdauer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preis" ADD CONSTRAINT "Preis_tarifstufeId_fkey" FOREIGN KEY ("tarifstufeId") REFERENCES "Tarifstufe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
