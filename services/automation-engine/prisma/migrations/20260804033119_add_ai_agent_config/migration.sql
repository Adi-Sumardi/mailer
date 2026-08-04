-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('openai', 'anthropic');

-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'ai_agent';

-- AlterTable
ALTER TABLE "automation_rule" ADD COLUMN     "ai_api_key_encrypted" TEXT,
ADD COLUMN     "ai_api_key_masked" TEXT,
ADD COLUMN     "ai_model" TEXT,
ADD COLUMN     "ai_provider" "AiProvider";
