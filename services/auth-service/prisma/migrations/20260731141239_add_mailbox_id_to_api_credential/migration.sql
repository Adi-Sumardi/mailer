/*
  Warnings:

  - Added the required column `mailbox_id` to the `api_credential` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "api_credential" ADD COLUMN     "mailbox_id" TEXT NOT NULL;
