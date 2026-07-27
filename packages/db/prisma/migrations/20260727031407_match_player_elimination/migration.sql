-- AlterTable
ALTER TABLE "MatchPlayer" ADD COLUMN     "eliminated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "knockouts" INTEGER NOT NULL DEFAULT 0;
