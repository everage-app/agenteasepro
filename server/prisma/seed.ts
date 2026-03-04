import {
  PrismaClient,
  DealStatus,
  ClientRole,
  ListingStatus,
  BlastPlaybook,
  BlastStatus,
  BlastChannelType,
  SignatureEnvelopeType,
  SignerRole,
  TaskStatus,
  TaskPriority,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo agent with hashed password: demo1234
  const passwordHash = await bcrypt.hash('demo1234', 10);
  
  const agent = await prisma.agent.upsert({
    where: { email: 'demo@agentease.com' },
    update: {
      passwordHash,
    },
    create: {
      email: 'demo@agentease.com',
      name: 'Demo Agent',
      brokerageName: 'AgentEase Demo Realty',
      passwordHash,
    },
  });

  const buyer = await prisma.client.create({
    data: {
      agentId: agent.id,
      role: ClientRole.BUYER,
      firstName: 'John',
      lastName: 'Buyer',
      email: 'john.buyer@example.com',
    },
  });

  const seller = await prisma.client.create({
    data: {
      agentId: agent.id,
      role: ClientRole.SELLER,
      firstName: 'Sarah',
      lastName: 'Seller',
      email: 'sarah.seller@example.com',
    },
  });

  const referrer = await prisma.client.create({
    data: {
      agentId: agent.id,
      role: ClientRole.OTHER,
      firstName: 'Casey',
      lastName: 'Referral',
      email: 'casey.referral@example.com',
    },
  });

  const property = await prisma.property.create({
    data: {
      agentId: agent.id,
      street: '123 Main St',
      city: 'Salt Lake City',
      county: 'Salt Lake',
      state: 'UT',
      zip: '84101',
    },
  });

  const deal = await prisma.deal.create({
    data: {
      agentId: agent.id,
      title: '123 Main St – Buyer → Seller – REPC',
      propertyId: property.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      status: DealStatus.ACTIVE,
      offerReferenceDate: new Date(),
    },
  });

  await prisma.repc.create({
    data: {
      dealId: deal.id,
      buyerLegalNames: 'John Buyer',
      sellerLegalNames: 'Sarah Seller',
      earnestMoneyAmount: 5000,
      earnestMoneyForm: 'wire',
      additionalEarnestMoneyAmount: null,
      propertyCity: property.city,
      propertyCounty: property.county,
      propertyState: property.state,
      propertyZip: property.zip,
      propertyTaxId: 'tax-123',
      otherIncludedItems: 'Washer, dryer',
      excludedItems: 'Seller personal items',
      waterRightsIncludedNotes: null,
      waterRightsExcludedNotes: null,
      purchasePrice: 500000,
      newLoanAmount: 400000,
      sellerFinancingAmount: null,
      cashAtSettlement: 100000,
      isSubjectToSaleOfBuyersProperty: false,
      buyersPropertyDescription: null,
      possessionTiming: 'ON_RECORDING',
      possessionOffset: null,
      capitalImprovementsPayer: 'SELLER',
      capitalImprovementsPayerOther: null,
      changeOfOwnershipFeePayer: 'BUYER',
      changeOfOwnershipFeePayerOther: null,
      sellerCompensationContributionPercent: 3,
      sellerCompensationContributionFlat: null,
      hasDueDiligenceCondition: true,
      hasAppraisalCondition: true,
      hasFinancingCondition: true,
      sellerDisclosureDeadline: new Date(),
      dueDiligenceDeadline: new Date(),
      financingAppraisalDeadline: new Date(),
      settlementDeadline: new Date(),
      hasHomeWarranty: false,
      homeWarrantyOrderedBy: 'UNKNOWN',
      homeWarrantyMaxCost: null,
      offerExpirationDate: new Date(),
      offerExpirationTime: '17:00',
      offerExpirationMeridiem: 'PM',
      rawJson: {},
    },
  });

  const listing = await prisma.listing.create({
    data: {
      agent: { connect: { id: agent.id } },
      dealId: deal.id,
      addressLine1: '123 Main St',
      city: 'Salt Lake City',
      state: 'UT',
      zipCode: '84101',
      headline: 'Charming SLC Bungalow',
      description: 'Updated bungalow close to downtown and transit.',
      price: 500000,
      beds: 3,
      baths: 2,
      sqft: 1800,
      status: ListingStatus.ACTIVE,
    },
  });

  const defaultChannelTypes: BlastChannelType[] = [
    BlastChannelType.FACEBOOK,
    BlastChannelType.INSTAGRAM,
    BlastChannelType.LINKEDIN,
    BlastChannelType.X,
    BlastChannelType.EMAIL,
    BlastChannelType.SMS,
    BlastChannelType.WEBSITE,
  ];

  await prisma.marketingBlast.create({
    data: {
      agentId: agent.id,
      listingId: listing.id,
      title: 'New listing – 123 Main St',
      playbook: BlastPlaybook.NEW_LISTING,
      status: BlastStatus.SENT,
      sentAt: new Date(),
      channels: {
        create: defaultChannelTypes.map((channel, idx) => ({
          channel,
          enabled: true,
          status: BlastStatus.SENT,
          previewText: `Seed ${channel} copy for 123 Main St`,
          previewHtml:
            channel === BlastChannelType.EMAIL || channel === BlastChannelType.WEBSITE
              ? `<p>Seed rich content for ${channel} – 123 Main St</p>`
              : null,
          shortCode: `seed-${idx}`,
          shortUrl: `https://demo.agenteasepro.com/go/seed-${idx}`,
          clicks: 5 + idx,
          uniqueClicks: 3 + idx,
          hits: {
            create: {
              ip: '127.0.0.1',
              userAgent: 'seed-bot',
            },
          },
        })),
      },
    },
  });

  await prisma.signatureEnvelope.create({
    data: {
      dealId: deal.id,
      type: SignatureEnvelopeType.REPC,
      documentVersion: 1,
      contractSnapshot: {},
      signers: {
        create: [
          { role: SignerRole.BUYER, name: 'John Buyer', email: 'john.buyer@example.com' },
          { role: SignerRole.SELLER, name: 'Sarah Seller', email: 'sarah.seller@example.com' },
        ],
      },
    },
  });

  // Add demo tasks
  await prisma.task.createMany({
    data: [
      {
        agentId: agent.id,
        title: 'Follow up with John Buyer',
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: TaskStatus.OPEN,
        priority: TaskPriority.HIGH,
      },
      {
        agentId: agent.id,
        title: 'Schedule property showing',
        dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        status: TaskStatus.OPEN,
        priority: TaskPriority.HIGH,
      },
      {
        agentId: agent.id,
        title: 'Send listing agreement to Sarah',
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: TaskStatus.OPEN,
        priority: TaskPriority.NORMAL,
      },
    ],
  });

  // Add demo daily activity (Win the Day data)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  await prisma.dailyActivity.upsert({
    where: {
      agentId_date: {
        agentId: agent.id,
        date: today,
      },
    },
    update: {},
    create: {
      agentId: agent.id,
      date: today,
      callsGoal: 10,
      callsMade: 3,
      notesGoal: 5,
      notesSent: 0,
      popbysGoal: 2,
      popbysDone: 1,
      referralsAskedGoal: 3,
      referralsAsked: 0,
    },
  });

  console.log('✅ Demo data seeded successfully!');
  console.log('📧 Demo email: demo@agentease.com');
  console.log('🔑 Demo password: demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
