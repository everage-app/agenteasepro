"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const agent = await prisma.agent.upsert({
        where: { email: 'demo.agent@example.com' },
        update: {},
        create: {
            email: 'demo.agent@example.com',
            name: 'Demo Agent',
            brokerageName: 'Demo Realty',
        },
    });
    const buyer = await prisma.client.create({
        data: {
            agentId: agent.id,
            role: client_1.ClientRole.BUYER,
            firstName: 'John',
            lastName: 'Buyer',
            email: 'john.buyer@example.com',
        },
    });
    const seller = await prisma.client.create({
        data: {
            agentId: agent.id,
            role: client_1.ClientRole.SELLER,
            firstName: 'Sarah',
            lastName: 'Seller',
            email: 'sarah.seller@example.com',
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
            status: client_1.DealStatus.ACTIVE,
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
            agentId: agent.id,
            dealId: deal.id,
            headline: 'Charming SLC Bungalow',
            description: 'Updated bungalow close to downtown and transit.',
            price: 500000,
            status: client_1.ListingStatus.ACTIVE,
        },
    });
    await prisma.marketingBlast.create({
        data: {
            agentId: agent.id,
            listingId: listing.id,
            title: 'Just listed in SLC',
            message: 'Check out this charming bungalow at 123 Main St.',
            targetChannels: ['LINKEDIN', 'EMAIL'],
            status: client_1.MarketingBlastStatus.SENT,
            sentAt: new Date(),
        },
    });
    await prisma.signatureEnvelope.create({
        data: {
            dealId: deal.id,
            type: client_1.SignatureEnvelopeType.REPC,
            documentVersion: 1,
            contractSnapshot: {},
            signers: {
                create: [
                    { role: client_1.SignerRole.BUYER, name: 'John Buyer', email: 'john.buyer@example.com' },
                    { role: client_1.SignerRole.SELLER, name: 'Sarah Seller', email: 'sarah.seller@example.com' },
                ],
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
