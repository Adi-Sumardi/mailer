-- CreateEnum
CREATE TYPE "LogoPosition" AS ENUM ('left', 'center', 'right');

-- CreateTable
CREATE TABLE "email_template" (
    "template_id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "logo_filename" TEXT,
    "logo_position" "LogoPosition" NOT NULL DEFAULT 'left',
    "title" TEXT,
    "subtitle" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#e11d48',
    "accent_color" TEXT NOT NULL DEFAULT '#0b1c30',
    "footer_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("template_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_template_mailbox_id_key" ON "email_template"("mailbox_id");

-- AddForeignKey
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailbox"("mailbox_id") ON DELETE CASCADE ON UPDATE CASCADE;
