-- CreateEnum
CREATE TYPE "FolderType" AS ENUM ('inbox', 'sent', 'draft', 'trash', 'custom');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('draft', 'queued', 'sent', 'cancelled');

-- CreateTable
CREATE TABLE "mailbox" (
    "mailbox_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_address" TEXT NOT NULL,
    "quota_mb" INTEGER NOT NULL DEFAULT 1024,
    "used_mb" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_pkey" PRIMARY KEY ("mailbox_id")
);

-- CreateTable
CREATE TABLE "folder" (
    "folder_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "folder_name" TEXT NOT NULL,
    "folder_type" "FolderType" NOT NULL DEFAULT 'custom',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_pkey" PRIMARY KEY ("folder_id")
);

-- CreateTable
CREATE TABLE "email" (
    "email_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "parent_email_id" TEXT,
    "related_email_id" TEXT,
    "from_addr" TEXT NOT NULL,
    "to_addr" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_important" BOOLEAN NOT NULL DEFAULT false,
    "is_spam" BOOLEAN NOT NULL DEFAULT false,
    "send_status" "SendStatus" NOT NULL DEFAULT 'sent',
    "recall_deadline_at" TIMESTAMP(3),
    "recalled" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_pkey" PRIMARY KEY ("email_id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "attachment_id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size_kb" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_user_id_key" ON "mailbox"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_email_address_key" ON "mailbox"("email_address");

-- CreateIndex
CREATE UNIQUE INDEX "folder_mailbox_id_folder_name_key" ON "folder"("mailbox_id", "folder_name");

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailbox"("mailbox_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "email_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailbox"("mailbox_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "email_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folder"("folder_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "email"("email_id") ON DELETE RESTRICT ON UPDATE CASCADE;
