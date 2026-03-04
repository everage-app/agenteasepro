import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { syncDealEventsFromRepc } from '../services/calendarService';
import { prisma } from '../lib/prisma';
export const router = Router();

const toIsoDate = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return undefined;
};

const normalizeRepcForForm = (repc: Record<string, any>) => ({
  buyerLegalNames: repc.buyerLegalNames,
  sellerLegalNames: repc.sellerLegalNames,
  earnestMoneyAmount: repc.earnestMoneyAmount,
  earnestMoneyForm: repc.earnestMoneyForm,
  additionalEarnestMoneyAmount: repc.additionalEarnestMoneyAmount,
  propertyCity: repc.propertyCity,
  propertyCounty: repc.propertyCounty,
  propertyState: repc.propertyState,
  propertyZip: repc.propertyZip,
  propertyTaxId: repc.propertyTaxId,
  otherIncludedItems: repc.otherIncludedItems,
  excludedItems: repc.excludedItems,
  purchasePrice: repc.purchasePrice,
  newLoanAmount: repc.newLoanAmount,
  sellerFinancingAmount: repc.sellerFinancingAmount,
  cashAtSettlement: repc.cashAtSettlement,
  isSubjectToSaleOfBuyersProperty: repc.isSubjectToSaleOfBuyersProperty,
  buyersPropertyDescription: repc.buyersPropertyDescription,
  possessionTiming: repc.possessionTiming,
  possessionOffset: repc.possessionOffset,
  capitalImprovementsPayer: repc.capitalImprovementsPayer,
  capitalImprovementsPayerOther: repc.capitalImprovementsPayerOther,
  changeOfOwnershipFeePayer: repc.changeOfOwnershipFeePayer,
  changeOfOwnershipFeePayerOther: repc.changeOfOwnershipFeePayerOther,
  hasDueDiligenceCondition: repc.hasDueDiligenceCondition,
  hasAppraisalCondition: repc.hasAppraisalCondition,
  hasFinancingCondition: repc.hasFinancingCondition,
  sellerDisclosureDeadline: toIsoDate(repc.sellerDisclosureDeadline),
  dueDiligenceDeadline: toIsoDate(repc.dueDiligenceDeadline),
  financingAppraisalDeadline: toIsoDate(repc.financingAppraisalDeadline),
  settlementDeadline: toIsoDate(repc.settlementDeadline),
  hasHomeWarranty: repc.hasHomeWarranty,
  homeWarrantyOrderedBy: repc.homeWarrantyOrderedBy,
  homeWarrantyMaxCost: repc.homeWarrantyMaxCost,
  offerExpirationDate: toIsoDate(repc.offerExpirationDate),
  offerExpirationTime: repc.offerExpirationTime,
  offerExpirationMeridiem: repc.offerExpirationMeridiem,
});

const syncFormInstanceFromRepc = async (dealId: string, repc: Record<string, any>) => {
  const def = await prisma.formDefinition.findUnique({ where: { code: 'REPC' } });
  if (!def) return;
  const instance = await prisma.formInstance.findFirst({
    where: { dealId, formDefinitionId: def.id },
  });
  if (!instance) return;

  const existing = (instance.data as Record<string, unknown>) || {};
  const normalized = normalizeRepcForForm(repc);
  const merged = { ...existing, ...normalized } as Prisma.JsonValue;

  await prisma.formInstance.update({
    where: { id: instance.id },
    data: { data: merged },
  });
};

router.post('/', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId, ...rest } = req.body;

  const repc = await prisma.repc.create({
    data: {
      dealId,
      rawJson: rest.rawJson ?? rest,
      ...rest,
    },
  });

  syncFormInstanceFromRepc(dealId, repc).catch((err) =>
    console.error('Failed to sync form instance from REPC:', err),
  );

  // Sync calendar events from REPC (non-blocking)
  syncDealEventsFromRepc(dealId).catch(err => 
    console.error('Failed to sync calendar events:', err)
  );

  res.status(201).json(repc);
});

router.get('/:dealId', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId } = req.params;
  const repc = await prisma.repc.findUnique({ where: { dealId } });
  if (!repc) return res.status(404).json({ error: 'REPC not found' });
  res.json(repc);
});

router.put('/:dealId', async (req: AuthenticatedRequest, res) => {
  if (!req.agentId) return res.status(401).json({ error: 'Unauthorized' });
  const { dealId } = req.params;
  const rest = req.body;
  const repc = await prisma.repc.update({
    where: { dealId },
    data: {
      ...rest,
      rawJson: rest.rawJson ?? rest,
    },
  });

  syncFormInstanceFromRepc(dealId, repc).catch((err) =>
    console.error('Failed to sync form instance from REPC:', err),
  );

  // Sync calendar events from REPC (non-blocking)
  syncDealEventsFromRepc(dealId).catch(err => 
    console.error('Failed to sync calendar events:', err)
  );

  res.json(repc);
});
