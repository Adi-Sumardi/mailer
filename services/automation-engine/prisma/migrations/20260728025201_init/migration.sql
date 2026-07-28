-- CreateEnum
CREATE TYPE "ConditionField" AS ENUM ('sender', 'subject', 'body');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('contains', 'equals');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('move_folder', 'forward', 'auto_reply', 'delete');

-- CreateTable
CREATE TABLE "automation_rule" (
    "rule_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditionField" "ConditionField" NOT NULL,
    "condition_operator" "ConditionOperator" NOT NULL DEFAULT 'contains',
    "condition_value" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "action_value" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("rule_id")
);
