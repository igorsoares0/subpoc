-- AlterTable
-- Make password nullable so OAuth-only users (e.g. Google sign-in) can exist
-- without a credentials password. Hand-written on purpose: do NOT regenerate via
-- `prisma migrate dev` auto-diff, which would try to drop the orphaned AudioTrack
-- table / originalAudio* columns that live in the DB but not in schema.prisma.
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
