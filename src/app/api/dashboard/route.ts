import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const stats = {
    openTickets: await prisma.maintenanceTicket.count({
      where: { status: { in: ['open', 'allocated'] } },
    }),
    inProgressTickets: await prisma.maintenanceTicket.count({
      where: { status: 'in_progress' },
    }),
    totalMachines: await prisma.machine.count(),
    lowStockParts: (await prisma.$queryRawUnsafe<[{count: number}]>(`SELECT COUNT(*) as count FROM spare_parts WHERE current_qty <= min_threshold`))[0]?.count || 0,
    totalLifetimeCost: await prisma.machine.aggregate({
      _sum: { lifetimeMaintenanceCost: true },
    }),
    recentTickets: await prisma.maintenanceTicket.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { machine: true, assignedTo: true },
    }),
    lowStockItems: await prisma.sparePart.findMany({
      where: { currentQty: { lte: prisma.sparePart.fields.minThreshold } },
      orderBy: { currentQty: 'asc' },
    }),
  };

  return NextResponse.json(stats);
}
