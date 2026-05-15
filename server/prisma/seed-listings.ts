import { PrismaClient, ListingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const sampleListings = [
  {
    addressLine1: '742 East Capital Boulevard',
    city: 'Salt Lake City',
    state: 'UT',
    zipCode: '84103',
    mlsId: 'MLS2024001',
    headline: 'Stunning Capitol Hill Victorian with City Views',
    description: 'Completely renovated 1890s Victorian featuring original hardwood floors, modern kitchen with marble countertops, spa-like bathrooms, and incredible downtown views from the rooftop deck.',
    price: 895000,
    beds: 4,
    baths: 3.5,
    sqft: 2850,
    status: ListingStatus.ACTIVE,
    heroImageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
    isFeatured: true,
  },
  {
    addressLine1: '1523 South 900 East',
    city: 'Salt Lake City',
    state: 'UT',
    zipCode: '84105',
    mlsId: 'MLS2024002',
    headline: 'Modern 9th & 9th Townhome with Roof Deck',
    description: 'Brand new 3-story townhome in the heart of 9th & 9th. Open concept living, chef\'s kitchen, private rooftop with mountain views, walk to restaurants and coffee shops.',
    price: 649000,
    beds: 3,
    baths: 2.5,
    sqft: 1950,
    status: ListingStatus.ACTIVE,
    heroImageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    isFeatured: false,
  },
  {
    addressLine1: '3421 Wasatch Boulevard',
    city: 'Holladay',
    state: 'UT',
    zipCode: '84121',
    mlsId: 'MLS2024003',
    headline: 'Luxury Wasatch Mountain Estate',
    description: 'Spectacular 5-bedroom estate nestled in the foothills. Custom build with soaring ceilings, gourmet kitchen, home theater, wine cellar, and resort-style backyard with pool and spa.',
    price: 1895000,
    beds: 5,
    baths: 4.5,
    sqft: 5200,
    status: ListingStatus.PENDING,
    heroImageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
    isFeatured: true,
  },
  {
    addressLine1: '892 North 200 West',
    city: 'Provo',
    state: 'UT',
    zipCode: '84601',
    mlsId: 'MLS2024004',
    headline: 'Charming Provo Starter Home Near BYU',
    description: 'Perfect for first-time buyers or investors. Updated 3-bed rambler with new carpet, fresh paint, modern appliances. Large fenced backyard, close to campus and downtown.',
    price: 385000,
    beds: 3,
    baths: 2,
    sqft: 1450,
    status: ListingStatus.ACTIVE,
    heroImageUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
    isFeatured: false,
  },
  {
    addressLine1: '2150 East Skyline Drive',
    city: 'Park City',
    state: 'UT',
    zipCode: '84060',
    mlsId: 'MLS2024005',
    headline: 'Ski-In/Ski-Out Park City Mountain Retreat',
    description: 'Rare opportunity on the slopes! Contemporary 4-bed ski cabin with floor-to-ceiling windows, chef\'s kitchen, hot tub, heated garage. Steps from lifts and Main Street.',
    price: 2450000,
    beds: 4,
    baths: 3.5,
    sqft: 3400,
    status: ListingStatus.UNDER_CONTRACT,
    heroImageUrl: 'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=800',
    isFeatured: false,
  },
  {
    addressLine1: '645 West 300 South',
    city: 'Salt Lake City',
    state: 'UT',
    zipCode: '84101',
    mlsId: 'MLS2023089',
    headline: 'Industrial Loft in Downtown\'s Marmalade District',
    description: 'Rare downtown loft with exposed brick, 14-ft ceilings, concrete floors, and huge windows. Updated kitchen and bath, walk to everything, one secured parking space included.',
    price: 525000,
    beds: 2,
    baths: 2,
    sqft: 1650,
    status: ListingStatus.SOLD,
    heroImageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
    isFeatured: false,
    totalBlasts: 3,
    totalClicks: 47,
  },
];

async function main() {
  console.log('🏠 Seeding sample listings...');

  // Get the first agent (demo agent)
  const agent = await prisma.agent.findFirst();
  
  if (!agent) {
    console.error('❌ No agent found. Please seed agents first.');
    return;
  }

  console.log(`✅ Found agent: ${agent.name}`);

  // Clear existing listings for this agent
  await prisma.listing.deleteMany({
    where: { agentId: agent.id },
  });

  console.log('🗑️  Cleared existing listings');

  // Create sample listings
  for (const listingData of sampleListings) {
    const listing = await prisma.listing.create({
      data: {
        ...listingData,
        agentId: agent.id,
      },
    });
    console.log(`  ✅ Created: ${listing.headline}`);
  }

  console.log(`\n✨ Successfully seeded ${sampleListings.length} listings!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding listings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
