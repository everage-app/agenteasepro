$content = Get-Content -Raw "server\src\routes\leads.ts"
$smartListEndpoints = @"

// --- SMART LISTS ---

router.get('/smart-lists', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await prisma.smartList.findMany({
      where: { agentId: req.user!.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/smart-lists', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, icon, filters, sortOrder, isSystem } = req.body;
    const newList = await prisma.smartList.create({
      data: {
        agentId: req.user!.id,
        name,
        icon,
        filters: filters || {},
        sortOrder: sortOrder || {},
        isSystem: isSystem || false
      }
    });
    res.json(newList);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/smart-lists/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const target = await prisma.smartList.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (target.agentId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    if (target.isSystem) return res.status(400).json({ error: 'Cannot delete system lists' });
    
    await prisma.smartList.delete({ where: { id: target.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- END SMART LISTS ---

