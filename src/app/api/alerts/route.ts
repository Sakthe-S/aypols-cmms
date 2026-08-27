import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const allParts = await prisma.sparePart.findMany();
  const lowStockParts = allParts.filter(p => p.currentQty <= p.minThreshold);

  const upcomingPm = await prisma.pmSchedule.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    },
    include: { machine: true },
    orderBy: { nextDueDate: 'asc' },
  });

  const upcomingCalibration = await prisma.calibrationRecord.findMany({
    where: {
      isActive: true,
      nextDueDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    },
    include: { machine: true },
    orderBy: { nextDueDate: 'asc' },
  });

  const overdueTraining = await prisma.trainingRecord.findMany({
    where: {
      isActive: true,
      nextDueDate: { lt: new Date() },
    },
  });

  // Auto-generate notifications for low stock
  for (const part of lowStockParts) {
    const existing = await prisma.notification.findFirst({
      where: {
        type: 'low_stock',
        message: { contains: part.partCode },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (!existing) {
      const supervisors = await prisma.user.findMany({
        where: { role: { in: ['SUPERVISOR', 'STORE_ADMIN', 'ADMIN'] } },
      });
      for (const user of supervisors) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: 'Low Stock Alert',
            message: `${part.partName} (${part.partCode}) is below minimum threshold. Current: ${part.currentQty}, Min: ${part.minThreshold}`,
            type: 'low_stock',
            linkUrl: `/inventory/${part.id}`,
          },
        });
      }
    }
  }

  return NextResponse.json({
    lowStock: lowStockParts.length,
    upcomingPm: upcomingPm.length,
    upcomingCalibration: upcomingCalibration.length,
    overdueTraining: overdueTraining.length,
  });
}
