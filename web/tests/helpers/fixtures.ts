/**
 * Test fixtures - reusable test data
 */

export const testAgent = {
  id: 1,
  email: 'test@agenteasepro.com',
  name: 'Test Agent',
  phone: '801-555-1234',
  licenseNumber: 'UT-12345',
};

export const testClient = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '801-555-5678',
  type: 'BUYER',
  status: 'ACTIVE',
};

export const testListing = {
  address: '123 Main Street',
  city: 'Provo',
  state: 'UT',
  zipCode: '84601',
  price: 450000,
  bedrooms: 4,
  bathrooms: 3,
  squareFeet: 2500,
  listingType: 'SALE',
  status: 'ACTIVE',
};

export const testTask = {
  title: 'Call client about inspection',
  description: 'Follow up on property inspection scheduled for tomorrow',
  category: 'CALL',
  priority: 'HIGH',
  bucket: 'TODAY',
};

export const testDeal = {
  propertyAddress: '456 Oak Avenue',
  clientName: 'Jane Smith',
  dealType: 'PURCHASE',
  price: 525000,
  status: 'IN_CONTRACT',
  stage: 'INSPECTION',
};

export const testCalendarEvent = {
  title: 'Property Showing',
  description: 'Show listing at 789 Pine Street',
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
  location: '789 Pine Street, Salt Lake City, UT',
};

export const testMarketingBlast = {
  subject: 'New Listing Alert!',
  message: 'Check out this amazing property just listed in Provo.',
  blastType: 'NEW_LISTING',
  channels: ['EMAIL', 'SMS'],
};

export const testRepcData = {
  propertyAddress: '321 Elm Street',
  city: 'Orem',
  state: 'UT',
  zipCode: '84057',
  purchasePrice: 375000,
  earnestMoney: 5000,
  closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  buyerName: 'Bob Johnson',
  sellerName: 'Alice Williams',
};

export const testDocument = {
  name: 'Purchase Agreement',
  type: 'REPC',
  url: 'https://example.com/documents/repc-123.pdf',
  status: 'PENDING',
};

export const testAutomation = {
  name: 'Client Follow-up',
  triggerType: 'SCHEDULE',
  actionType: 'SEND_EMAIL',
  schedule: '0 9 * * *', // Daily at 9 AM
  enabled: true,
};

export const testMLSListing = {
  mlsNumber: 'MLS-123456',
  address: '999 Market Street',
  city: 'Sandy',
  state: 'UT',
  zipCode: '84070',
  price: 599000,
  bedrooms: 5,
  bathrooms: 4,
  squareFeet: 3200,
  listDate: new Date().toISOString(),
  status: 'ACTIVE',
};

export const testChannelConnection = {
  channelType: 'EMAIL',
  name: 'Gmail Account',
  username: 'agent@gmail.com',
  isActive: true,
};
