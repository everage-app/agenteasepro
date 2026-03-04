import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const baseSections = [
    {
      id: 'offer_basics',
      label: 'Offer Basics',
      fields: [
        {
          name: 'offerReferenceDate',
          type: 'date',
          label: 'Offer Reference Date',
          required: true,
        },
        { name: 'buyerNames', type: 'string', label: 'Buyer(s)', required: true },
        { name: 'sellerNames', type: 'string', label: 'Seller(s)', required: true },
      ],
    },
    {
      id: 'property',
      label: 'Property',
      fields: [
        { name: 'street', type: 'string', label: 'Street', required: true },
        { name: 'city', type: 'string', label: 'City', required: true },
        { name: 'county', type: 'string', label: 'County', required: false },
        { name: 'state', type: 'string', label: 'State', required: true },
        { name: 'zip', type: 'string', label: 'ZIP', required: true },
      ],
    },
  ];

  await prisma.formDefinition.upsert({
    where: { code: 'REPC' },
    update: {},
    create: {
      code: 'REPC',
      displayName: 'Utah REPC',
      category: 'Contract',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Utah RE REPC.pdf',
      schemaJson: {
        sections: [
          ...baseSections,
          {
            id: 'money',
            label: 'Money',
            fields: [
              { name: 'purchasePrice', type: 'number', label: 'Purchase Price', required: true },
              { name: 'earnestMoneyAmount', type: 'number', label: 'Earnest Money', required: true },
              { name: 'additionalEarnestMoneyAmount', type: 'number', label: 'Additional Earnest Money', required: false },
              { name: 'sellerConcessions', type: 'number', label: 'Seller-paid closing costs / concessions', required: false },
            ],
          },
          {
            id: 'deadlines',
            label: 'Deadlines',
            fields: [
              { name: 'sellerDisclosureDeadline', type: 'date', label: 'Seller disclosure deadline', required: true },
              { name: 'dueDiligenceDeadline', type: 'date', label: 'Due diligence deadline', required: true },
              { name: 'financingAppraisalDeadline', type: 'date', label: 'Financing/Appraisal deadline', required: true },
              { name: 'settlementDeadline', type: 'date', label: 'Settlement deadline', required: true },
            ],
          },
          {
            id: 'possession',
            label: 'Possession',
            fields: [
              { name: 'possessionTiming', type: 'select', label: 'Possession timing', required: true, options: [
                { value: 'ON_RECORDING', label: 'On recording' },
                { value: 'HOURS_AFTER_RECORDING', label: 'Hours after recording' },
                { value: 'DAYS_AFTER_RECORDING', label: 'Days after recording' },
              ] },
              { name: 'possessionOffset', type: 'number', label: 'Offset (hours or days)', required: false },
            ],
          },
        ],
        questions: [
          {
            id: 'q_offer_basics',
            sectionId: 'offer_basics',
            label: 'Offer basics',
            prompt: 'What is the offer reference date and who are the buyers and sellers?',
            helpText: 'Example: Today, buyer John Buyer, seller Sarah Seller.',
            targets: ['offerReferenceDate', 'buyerNames', 'sellerNames'],
            order: 1,
          },
          {
            id: 'q_property_address',
            sectionId: 'property',
            label: 'Property address',
            prompt: 'What is the full property address (street, city, county, state, ZIP)?',
            helpText: 'We will map this into the property and REPC address sections.',
            targets: ['street', 'city', 'county', 'state', 'zip'],
            order: 2,
          },
          {
            id: 'q_purchase_price',
            sectionId: 'money',
            label: 'Purchase price',
            prompt: 'What is the total purchase price for this offer?',
            helpText: 'You can say things like "550k" or "$550,000".',
            targets: ['purchasePrice'],
            order: 3,
          },
          {
            id: 'q_earnest_money',
            sectionId: 'money',
            label: 'Earnest money',
            prompt: 'How much earnest money is the buyer putting down?',
            helpText: 'Example: $10,000 earnest money.',
            targets: ['earnestMoneyAmount'],
            order: 4,
          },
          {
            id: 'q_additional_earnest',
            sectionId: 'money',
            label: 'Additional earnest money',
            prompt: 'Is there any additional earnest money due later?',
            helpText: 'If none, you can say "none".',
            targets: ['additionalEarnestMoneyAmount'],
            order: 5,
          },
          {
            id: 'q_concessions',
            sectionId: 'money',
            label: 'Seller concessions',
            prompt: 'Are sellers paying any of the buyers closing costs or concessions?',
            helpText: 'Example: Seller to pay up to $5,000 of buyer closing costs.',
            targets: ['sellerConcessions'],
            order: 6,
          },
          {
            id: 'q_disclosure_deadline',
            sectionId: 'deadlines',
            label: 'Seller disclosure deadline',
            prompt: 'When should seller disclosures be due?',
            helpText: 'Example: 7 days from acceptance.',
            targets: ['sellerDisclosureDeadline'],
            order: 7,
          },
          {
            id: 'q_due_diligence_deadline',
            sectionId: 'deadlines',
            label: 'Due diligence deadline',
            prompt: 'When does the buyer want due diligence to end?',
            helpText: 'Example: 14 days from acceptance.',
            targets: ['dueDiligenceDeadline'],
            order: 8,
          },
          {
            id: 'q_financing_deadline',
            sectionId: 'deadlines',
            label: 'Financing/Appraisal deadline',
            prompt: 'When should the financing and appraisal deadline be?',
            helpText: 'Example: 21 days from acceptance.',
            targets: ['financingAppraisalDeadline'],
            order: 9,
          },
          {
            id: 'q_settlement_deadline',
            sectionId: 'deadlines',
            label: 'Settlement deadline',
            prompt: 'When do you expect to settle/close?',
            helpText: 'Example: June 20th or 30 days from acceptance.',
            targets: ['settlementDeadline'],
            order: 10,
          },
          {
            id: 'q_possession',
            sectionId: 'possession',
            label: 'Possession timing',
            prompt: 'When will the buyer get possession of the property?',
            helpText: 'Example: On recording, or 3 days after recording.',
            targets: ['possessionTiming', 'possessionOffset'],
            order: 11,
          },
        ],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'REPC_ADDENDUM' },
    update: {},
    create: {
      code: 'REPC_ADDENDUM',
      displayName: 'Utah REPC Addendum',
      category: 'Addendum',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Utah RE REPC Addendum.pdf',
      schemaJson: {
        sections: [
          ...baseSections,
          {
            id: 'body',
            label: 'Addendum Body',
            fields: [
              { name: 'body', type: 'textarea', label: 'Text', required: true },
            ],
          },
        ],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'SELLER_PROPERTY_CONDITION_DISCLOSURE_ADDENDUM' },
    update: {},
    create: {
      code: 'SELLER_PROPERTY_CONDITION_DISCLOSURE_ADDENDUM',
      displayName: 'Seller Property Condition Disclosure Addendum',
      category: 'Disclosures',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Seller Property Condition Disclosure Addendum.pdf',
      schemaJson: {
        sections: [...baseSections],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'SELLER_PROPERTY_CONDITION_DISCLOSURES' },
    update: {},
    create: {
      code: 'SELLER_PROPERTY_CONDITION_DISCLOSURES',
      displayName: 'Seller Property Condition Disclosures',
      category: 'Disclosures',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Seller Property Condition Disclosures.pdf',
      schemaJson: {
        sections: [...baseSections],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'LEAD_BASED_PAINT_DISCLOSURE' },
    update: {},
    create: {
      code: 'LEAD_BASED_PAINT_DISCLOSURE',
      displayName: 'Lead-Based Paint Disclosure',
      category: 'Disclosures',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Lead-Based Paint Disclosure.pdf',
      schemaJson: {
        sections: [...baseSections],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'WIRE_FRAUD_ADVISORY' },
    update: {},
    create: {
      code: 'WIRE_FRAUD_ADVISORY',
      displayName: 'Wire Fraud Advisory',
      category: 'General',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Wire Fraud Advisory.pdf',
      schemaJson: {
        sections: [...baseSections],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'EXCLUSIVE_RIGHT_TO_SELL' },
    update: {},
    create: {
      code: 'EXCLUSIVE_RIGHT_TO_SELL',
      displayName: 'Exclusive Right to Sell',
      category: 'General',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Exclusive Right to Sell.pdf',
      schemaJson: {
        sections: [...baseSections],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'BLANK_ADDENDUM' },
    update: {},
    create: {
      code: 'BLANK_ADDENDUM',
      displayName: 'Blank Addendum',
      category: 'Addendum',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Utah RE REPC Addendum.pdf',
      schemaJson: {
        sections: [
          {
            id: 'body',
            label: 'Addendum Body',
            fields: [
              { name: 'body', type: 'textarea', label: 'Text', required: true },
            ],
          },
        ],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'TRANSACTION_RECEIPT' },
    update: {},
    create: {
      code: 'TRANSACTION_RECEIPT',
      displayName: 'Transaction Receipt',
      category: 'Receipt',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Transaction Receipt.pdf',
      schemaJson: {
        sections: [...baseSections],
        questions: [],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'BUYER_BROKER_AGREEMENT' },
    update: {},
    create: {
      code: 'BUYER_BROKER_AGREEMENT',
      displayName: 'Exclusive Buyer Broker Agreement',
      category: 'Agency',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Exclusive Buyer Broker Agreement.pdf',
      schemaJson: {
        sections: [...baseSections],
        questions: [],
      },
    },
  });

  await prisma.formDefinition.upsert({
    where: { code: 'SELLER_PROPERTY_CONDITION_DISCLOSURE_ADDENDUM' },
    update: {},
    create: {
      code: 'SELLER_PROPERTY_CONDITION_DISCLOSURE_ADDENDUM',
      displayName: 'Seller Property Condition Disclosure Addendum',
      category: 'Disclosure',
      version: '2025-01',
      officialPdfPath: 'contracts/templates/Seller Property Condition Disclosure Addendum.pdf',
      schemaJson: {
        sections: [...baseSections],
        questions: [],
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
