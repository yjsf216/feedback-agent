/*
  Warnings:

  - Added the required column `secretEncrypted` to the `AppCredential` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AppCredential" ADD COLUMN     "secretEncrypted" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserIdentity" ADD COLUMN     "passwordHash" TEXT;
