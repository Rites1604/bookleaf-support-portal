-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('UNCLASSIFIED', 'ROYALTY_PAYMENTS', 'ISBN_METADATA', 'PRINTING_QUALITY', 'DISTRIBUTION_AVAILABILITY', 'BOOK_STATUS_PRODUCTION', 'GENERAL_INQUIRY');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "LabelSource" AS ENUM ('PENDING', 'AI', 'FALLBACK', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "authorCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "joinedDate" DATE NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "bookCode" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isbn" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "publicationDate" DATE,
    "mrp" INTEGER,
    "royaltyPerCopy" INTEGER,
    "copiesSold" INTEGER NOT NULL DEFAULT 0,
    "royaltyEarned" INTEGER NOT NULL DEFAULT 0,
    "royaltyPaid" INTEGER NOT NULL DEFAULT 0,
    "royaltyPending" INTEGER NOT NULL DEFAULT 0,
    "lastPayoutDate" DATE,
    "printPartner" TEXT,
    "availableOn" TEXT[],

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bookId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachmentName" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "category" "TicketCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "categorySource" "LabelSource" NOT NULL DEFAULT 'PENDING',
    "prioritySource" "LabelSource" NOT NULL DEFAULT 'PENDING',
    "aiConfidence" DOUBLE PRECISION,
    "aiReasoning" TEXT,
    "assigneeId" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "fromAiDraft" BOOLEAN NOT NULL DEFAULT false,
    "aiEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDraft" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "task" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Author_authorCode_key" ON "Author"("authorCode");

-- CreateIndex
CREATE UNIQUE INDEX "Author_userId_key" ON "Author"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_bookCode_key" ON "Book"("bookCode");

-- CreateIndex
CREATE INDEX "Book_authorId_idx" ON "Book"("authorId");

-- CreateIndex
CREATE INDEX "Ticket_status_priority_createdAt_idx" ON "Ticket"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_authorId_createdAt_idx" ON "Ticket"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "AiDraft_ticketId_createdAt_idx" ON "AiDraft"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- AddForeignKey
ALTER TABLE "Author" ADD CONSTRAINT "Author_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDraft" ADD CONSTRAINT "AiDraft_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
