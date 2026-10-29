/**
 * Seeds the provided dataset (10 authors, 18 books) plus two admins and a handful of
 * realistic tickets so the admin queue is not empty on first login.
 * Idempotent: wipes tickets/users and recreates them, so `npm run db:seed` always gives a clean demo.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fallbackClassify } from "../src/server/ai/fallbackClassifier";

type SourceBook = {
  book_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
};
type SourceAuthor = {
  author_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_date: string;
  books: SourceBook[];
};

const prisma = new PrismaClient();
const date = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

const ADMINS = [
  { email: "admin@bookleaf.in", name: "Support Admin" },
  { email: "ops@bookleaf.in", name: "Ops Lead" },
];

// Taken from the KB's sample queries, attached to authors whose data makes them plausible.
const DEMO_TICKETS: { author: string; book: string | null; subject: string; description: string; ageHours: number }[] = [
  {
    author: "AUTH003",
    book: "BK005",
    subject: "No royalty received since publication",
    description:
      "I published Between Two Temples over a year ago and still haven't received any royalty payment at all. My dashboard shows a pending amount but nothing has reached my bank. What's going on?",
    ageHours: 70,
  },
  {
    author: "AUTH002",
    book: "BK003",
    subject: "ISBN on Amazon doesn't match my printed copy",
    description:
      "My book Code & Karma is showing a different ISBN on Amazon than what's printed on the physical copy. Readers are getting confused and I'm worried it affects sales tracking.",
    ageHours: 30,
  },
  {
    author: "AUTH004",
    book: "BK006",
    subject: "Author copies have blurry images and misaligned pages",
    description:
      "I received my author copies of Debugging Life and the print quality is terrible. The images are blurry and several pages are misaligned. I have a launch event in two weeks.",
    ageHours: 20,
  },
  {
    author: "AUTH001",
    book: "BK002",
    subject: "Book showing Currently Unavailable on Amazon",
    description:
      "The Saffron Diaries is published but it's showing as 'Currently Unavailable' on Amazon India since last week. Can you please check?",
    ageHours: 8,
  },
  {
    author: "AUTH009",
    book: "BK015",
    subject: "Still in typesetting after 3 weeks",
    description:
      "It's been 3 weeks and Raising Roots is still in typesetting. When will it be done? I was hoping to launch before the school term.",
    ageHours: 4,
  },
  {
    author: "AUTH008",
    book: null,
    subject: "How do I update my author bio?",
    description: "Can I update my author bio on the BookLeaf Store and Amazon? I've had a new collection accepted and want to mention it.",
    ageHours: 2,
  },
];

async function main() {
  const file = join(__dirname, "data", "bookleaf_sample_data.json");
  const { authors } = JSON.parse(readFileSync(file, "utf8")) as { authors: SourceAuthor[] };
  const password = process.env.SEED_PASSWORD ?? "BookLeaf@2026";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.aiUsage.deleteMany(),
    prisma.aiDraft.deleteMany(),
    prisma.ticketMessage.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.book.deleteMany(),
    prisma.author.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const admins = [];
  for (const a of ADMINS) {
    admins.push(await prisma.user.create({ data: { ...a, passwordHash, role: "ADMIN" } }));
  }

  const authorIds = new Map<string, string>();
  const bookIds = new Map<string, string>();
  for (const a of authors) {
    const user = await prisma.user.create({
      data: {
        email: a.email.toLowerCase(),
        name: a.name,
        passwordHash,
        role: "AUTHOR",
        author: {
          create: {
            authorCode: a.author_id,
            phone: a.phone,
            city: a.city,
            joinedDate: date(a.joined_date)!,
            books: {
              create: a.books.map((b) => ({
                bookCode: b.book_id,
                title: b.title,
                isbn: b.isbn,
                genre: b.genre,
                status: b.status,
                publicationDate: date(b.publication_date),
                mrp: b.mrp,
                royaltyPerCopy: b.author_royalty_per_copy,
                copiesSold: b.total_copies_sold,
                royaltyEarned: b.total_royalty_earned,
                royaltyPaid: b.royalty_paid,
                royaltyPending: b.royalty_pending,
                lastPayoutDate: date(b.last_royalty_payout_date),
                printPartner: b.print_partner,
                availableOn: b.available_on,
              })),
            },
          },
        },
      },
      include: { author: { include: { books: true } } },
    });
    authorIds.set(a.author_id, user.author!.id);
    for (const b of user.author!.books) bookIds.set(b.bookCode, b.id);
  }

  // Demo tickets are labelled with the rule-based classifier (marked FALLBACK) so seeding
  // never needs an API key. Admins can re-run AI classification from the ticket page.
  for (const t of DEMO_TICKETS) {
    const labels = fallbackClassify(`${t.subject}\n${t.description}`);
    await prisma.ticket.create({
      data: {
        authorId: authorIds.get(t.author)!,
        bookId: t.book ? bookIds.get(t.book)! : null,
        subject: t.subject,
        description: t.description,
        ...labels,
        categorySource: "FALLBACK",
        prioritySource: "FALLBACK",
        createdAt: hoursAgo(t.ageHours),
      },
    });
  }

  // One ticket already mid-conversation, to show history and internal notes.
  const priya = authorIds.get("AUTH001")!;
  await prisma.ticket.create({
    data: {
      authorId: priya,
      bookId: bookIds.get("BK001")!,
      subject: "Royalty breakdown for Whispers of the Ganges",
      description:
        "My royalty for Whispers of the Ganges seems low for 342 copies. Could you share how the amount is calculated?",
      category: "ROYALTY_PAYMENTS",
      priority: "MEDIUM",
      categorySource: "ADMIN",
      prioritySource: "ADMIN",
      status: "RESOLVED",
      assigneeId: admins[0].id,
      createdAt: hoursAgo(120),
      firstResponseAt: hoursAgo(118),
      resolvedAt: hoursAgo(100),
      messages: {
        create: [
          {
            senderId: admins[0].id,
            isInternal: true,
            body: "Checked ledger: ₹35/copy x 342 = ₹11,970 earned, ₹8,400 paid, ₹3,570 pending for next cycle. Numbers are correct.",
            createdAt: hoursAgo(119),
          },
          {
            senderId: admins[0].id,
            body:
              "Hi Priya, thank you for asking, and it's a fair question. Your royalty is 80% of the net profit per copy (MRP minus printing, platform commission and shipping), which works out to ₹35 per copy for Whispers of the Ganges. For 342 copies that's ₹11,970 earned: ₹8,400 has been paid and ₹3,570 is pending for the next quarterly payout. I've attached a line-by-line breakdown by platform to your dashboard. Let us know if anything there doesn't match your records.",
            createdAt: hoursAgo(118),
          },
        ],
      },
    },
  });

  console.log(`Seeded ${authors.length} authors, ${bookIds.size} books, ${admins.length} admins, ${DEMO_TICKETS.length + 1} tickets.`);
  console.log(`All accounts use the password from SEED_PASSWORD.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
