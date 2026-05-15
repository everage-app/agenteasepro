import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import * as crypto from 'crypto';

export async function createESignAudit(req: AuthenticatedRequest, res: Response) {
  try {
    const { envelopeId, action, actorIdentifier, geoDetail } = req.body;
    
    // In a real system, you'd integrate a more sophisticated hashing tool like PGP
    // The requirement mentions 'a method to generate a PGP/SHA256 hash or simulated audit trail'
    
    const timestamp = new Date();
    const payloadToHash = JSON.stringify({
      envelopeId,
      action,
      actorIdentifier,
      geoDetail,
      timestamp: timestamp.toISOString(),
      agentId: req.user!.id
    });
    
    const hash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const audit = await prisma.eSignAudit.create({
      data: {
        envelopeId,
        action,
        actorIdentifier: actorIdentifier || req.user!.id,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        geoDetail,
        timestamp,
        hash
      }
    });

    res.status(201).json(audit);
  } catch (error) {
    console.error('Failed to create E-Sign audit:', error);
    res.status(500).json({ error: 'Failed to create simulated E-Sign audit trail' });
  }
}

export async function getESignAudits(req: AuthenticatedRequest, res: Response) {
  try {
    const { envelopeId } = req.params;

    const audits = await prisma.eSignAudit.findMany({
      where: { 
        envelopeId,
        envelope: {
           deal: {
             agentId: req.user!.id
           }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    res.json(audits);
  } catch (error) {
    console.error('Failed to get E-Sign audits:', error);
    res.status(500).json({ error: 'Failed to retrieve audits' });
  }
}