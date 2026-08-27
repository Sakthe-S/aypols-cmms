import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create users
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@aypols.com',
      passwordHash,
      role: 'ADMIN',
      phone: '9876543210',
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      name: 'Rajesh Kumar',
      email: 'rajesh@aypols.com',
      passwordHash,
      role: 'SUPERVISOR',
      trade: 'mechanical',
      phone: '9876543211',
    },
  });

  const technician1 = await prisma.user.create({
    data: {
      name: 'Kumar S',
      email: 'kumar@aypols.com',
      passwordHash,
      role: 'TECHNICIAN',
      trade: 'mechanical',
      phone: '9876543212',
    },
  });

  const technician2 = await prisma.user.create({
    data: {
      name: 'Selvam M',
      email: 'selvam@aypols.com',
      passwordHash,
      role: 'TECHNICIAN',
      trade: 'electrical',
      phone: '9876543213',
    },
  });

  const storeAdmin = await prisma.user.create({
    data: {
      name: 'Murugan K',
      email: 'murugan@aypols.com',
      passwordHash,
      role: 'STORE_ADMIN',
      phone: '9876543214',
    },
  });

  const ehsOfficer = await prisma.user.create({
    data: {
      name: 'Priya R',
      email: 'priya@aypols.com',
      passwordHash,
      role: 'EHS_OFFICER',
      phone: '9876543215',
    },
  });

  const employee = await prisma.user.create({
    data: {
      name: 'Arun V',
      email: 'arun@aypols.com',
      passwordHash,
      role: 'EMPLOYEE',
      phone: '9876543216',
    },
  });

  // Create machines
  const mixer = await prisma.machine.create({
    data: {
      machineName: 'Mixer M101',
      serialNumber: 'MX-2020-001',
      department: 'Production',
      location: 'Bay 1',
      installationDate: new Date('2020-03-15'),
      manufacturer: 'Lodha Mechanical',
      model: 'LM-500',
      currentStatus: 'operational',
    },
  });

  const reactor = await prisma.machine.create({
    data: {
      machineName: 'Reactor R201',
      serialNumber: 'RC-2019-003',
      department: 'Production',
      location: 'Bay 2',
      installationDate: new Date('2019-08-20'),
      manufacturer: 'INOX',
      model: 'IR-1000',
      currentStatus: 'operational',
    },
  });

  const forklift = await prisma.machine.create({
    data: {
      machineName: 'Forklift F301',
      serialNumber: 'FK-2021-005',
      department: 'Logistics',
      location: 'Warehouse',
      installationDate: new Date('2021-01-10'),
      manufacturer: 'ACE',
      model: 'Forklift-15',
      currentStatus: 'operational',
    },
  });

  const hydraulicPress = await prisma.machine.create({
    data: {
      machineName: 'Hydraulic Press H401',
      serialNumber: 'HP-2018-002',
      department: 'Production',
      location: 'Bay 3',
      installationDate: new Date('2018-06-05'),
      manufacturer: 'Dake',
      model: 'Force-50',
      currentStatus: 'maintenance',
    },
  });

  const compressor = await prisma.machine.create({
    data: {
      machineName: 'Air Compressor C501',
      serialNumber: 'AC-2020-008',
      department: 'Utilities',
      location: 'Utility Room',
      installationDate: new Date('2020-11-20'),
      manufacturer: 'Atlas Copco',
      model: 'GA-37',
      currentStatus: 'operational',
    },
  });

  // Create spare parts
  const parts = await Promise.all([
    prisma.sparePart.create({
      data: {
        partCode: 'BRG-001',
        partName: 'Main Bearing',
        category: 'Mechanical',
        unit: 'pcs',
        purchaseRate: 500,
        currentQty: 15,
        minThreshold: 5,
        reorderQty: 10,
        storageRoom: 'Main Store',
        rackBin: 'R1-B1',
        supplier: 'SKF Bearings',
      },
    }),
    prisma.sparePart.create({
      data: {
        partCode: 'SL-002',
        partName: 'Seal Ring',
        category: 'Mechanical',
        unit: 'pcs',
        purchaseRate: 200,
        currentQty: 3,
        minThreshold: 10,
        reorderQty: 20,
        storageRoom: 'Main Store',
        rackBin: 'R1-B2',
        supplier: 'Garlock',
      },
    }),
    prisma.sparePart.create({
      data: {
        partCode: 'LUB-003',
        partName: 'Lubricant (20W-50)',
        category: 'Consumable',
        unit: 'litre',
        purchaseRate: 150,
        currentQty: 25,
        minThreshold: 10,
        reorderQty: 20,
        storageRoom: 'Chemical Store',
        rackBin: 'R2-B1',
        supplier: 'Shell',
      },
    }),
    prisma.sparePart.create({
      data: {
        partCode: 'FLT-004',
        partName: 'Hydraulic Filter',
        category: 'Hydraulic',
        unit: 'pcs',
        purchaseRate: 350,
        currentQty: 8,
        minThreshold: 4,
        reorderQty: 10,
        storageRoom: 'Main Store',
        rackBin: 'R3-B1',
        supplier: 'Parker',
      },
    }),
    prisma.sparePart.create({
      data: {
        partCode: 'ELC-005',
        partName: 'Contactors (20A)',
        category: 'Electrical',
        unit: 'pcs',
        purchaseRate: 800,
        currentQty: 2,
        minThreshold: 3,
        reorderQty: 5,
        storageRoom: 'Electrical Store',
        rackBin: 'R4-B1',
        supplier: 'Schneider',
      },
    }),
    prisma.sparePart.create({
      data: {
        partCode: 'BGT-006',
        partName: 'V-Belt (Type B68)',
        category: 'Mechanical',
        unit: 'pcs',
        purchaseRate: 250,
        currentQty: 12,
        minThreshold: 4,
        reorderQty: 8,
        storageRoom: 'Main Store',
        rackBin: 'R1-B3',
        supplier: 'Gates',
      },
    }),
    prisma.sparePart.create({
      data: {
        partCode: 'TMS-007',
        partName: 'Temperature Sensor',
        category: 'Instrumentation',
        unit: 'pcs',
        purchaseRate: 1200,
        currentQty: 6,
        minThreshold: 2,
        reorderQty: 4,
        storageRoom: 'Electrical Store',
        rackBin: 'R4-B2',
        supplier: 'Honeywell',
      },
    }),
    prisma.sparePart.create({
      data: {
        partCode: 'GSK-008',
        partName: 'Gasket Set',
        category: 'Mechanical',
        unit: 'set',
        purchaseRate: 400,
        currentQty: 1,
        minThreshold: 5,
        reorderQty: 10,
        storageRoom: 'Main Store',
        rackBin: 'R1-B4',
        supplier: 'Flexitallic',
      },
    }),
  ]);

  // Create some tickets
  const ticket1 = await prisma.maintenanceTicket.create({
    data: {
      ticketNumber: 'TKT-2026-001',
      machineId: mixer.id,
      reportedById: employee.id,
      priority: 'high',
      category: 'mechanical',
      issueDescription: 'Bearing noise from main drive. Unusual vibration felt during operation.',
      status: 'closed',
      assignedToId: technician1.id,
      allocatedDate: new Date('2026-08-20T08:00:00'),
      startTime: new Date('2026-08-20T08:30:00'),
      endTime: new Date('2026-08-20T10:30:00'),
      downtimeMinutes: 120,
      diagnosis: 'Worn main bearing causing vibration and noise',
      rootCause: 'Normal wear and tear due to extended operation',
      actionsTaken: 'Replaced main bearing and seal. Lubricated drive assembly.',
      laborHours: 2,
      laborRatePerHour: 400,
      laborCost: 800,
      contractorCharges: 0,
      otherCosts: 50,
      partsCost: 1350,
      totalRepairCost: 2200,
      closureOutcome: 'closed',
      closureVerifiedById: supervisor.id,
      closureDate: new Date('2026-08-20T11:00:00'),
    },
  });

  const ticket2 = await prisma.maintenanceTicket.create({
    data: {
      ticketNumber: 'TKT-2026-002',
      machineId: hydraulicPress.id,
      reportedById: employee.id,
      priority: 'critical',
      category: 'hydraulic',
      issueDescription: 'Hydraulic oil leakage from main cylinder. Production stopped.',
      status: 'in_progress',
      assignedToId: technician2.id,
      allocatedDate: new Date('2026-08-24T07:00:00'),
      startTime: new Date('2026-08-24T07:30:00'),
    },
  });

  const ticket3 = await prisma.maintenanceTicket.create({
    data: {
      ticketNumber: 'TKT-2026-003',
      machineId: compressor.id,
      reportedById: employee.id,
      priority: 'medium',
      category: 'electrical',
      issueDescription: 'ACB tripping frequently. Power fluctuation observed.',
      status: 'open',
    },
  });

  // Add spare parts to ticket1
  await prisma.ticketSparePart.createMany({
    data: [
      { ticketId: ticket1.id, partId: parts[0].id, qty: 2, unitPrice: 500, totalCost: 1000, userId: technician1.id },
      { ticketId: ticket1.id, partId: parts[1].id, qty: 1, unitPrice: 200, totalCost: 200, userId: technician1.id },
      { ticketId: ticket1.id, partId: parts[2].id, qty: 1, unitPrice: 150, totalCost: 150, userId: technician1.id },
    ],
  });

  // Update machine lifetime cost
  await prisma.machine.update({
    where: { id: mixer.id },
    data: {
      lifetimeMaintenanceCost: 2200,
      lastServiceDate: new Date('2026-08-20'),
    },
  });

  // Create PM schedules
  await prisma.pmSchedule.createMany({
    data: [
      {
        machineId: mixer.id,
        taskName: 'Bearing Inspection',
        frequency: 'quarterly',
        description: 'Check bearing condition, noise level, and temperature',
        checklistItems: JSON.stringify(['Check noise level', 'Measure temperature', 'Inspect lubrication', 'Check vibration']),
        nextDueDate: new Date('2026-11-15'),
      },
      {
        machineId: reactor.id,
        taskName: 'Safety Valve Check',
        frequency: 'half_yearly',
        description: 'Test and calibrate safety valves',
        checklistItems: JSON.stringify(['Visual inspection', 'Pressure test', 'Calibration check', 'Leak test']),
        nextDueDate: new Date('2027-02-20'),
      },
      {
        machineId: compressor.id,
        taskName: 'Air Filter Replacement',
        frequency: 'monthly',
        description: 'Replace air filters and check oil level',
        checklistItems: JSON.stringify(['Replace air filter', 'Check oil level', 'Drain condensate', 'Check belt tension']),
        nextDueDate: new Date('2026-09-20'),
      },
      {
        machineId: forklift.id,
        taskName: 'Hydraulic System Check',
        frequency: 'quarterly',
        description: 'Inspect hydraulic fluid level, hoses, and cylinder',
        checklistItems: JSON.stringify(['Check hydraulic fluid', 'Inspect hoses', 'Check cylinder operation', 'Test lifting capacity']),
        nextDueDate: new Date('2026-10-10'),
      },
    ],
  });

  // Create AMC records
  await prisma.amcRecord.createMany({
    data: [
      {
        machineId: compressor.id,
        contractNumber: 'AMC-2026-001',
        vendorName: 'Atlas Copco Service',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        frequency: 'quarterly',
        cost: 50000,
        description: 'Annual maintenance contract for air compressor',
        nextServiceDate: new Date('2026-10-01'),
      },
    ],
  });

  // Create calibration records
  await prisma.calibrationRecord.createMany({
    data: [
      {
        machineId: reactor.id,
        instrumentName: 'Temperature Controller',
        calibrationType: 'external',
        frequency: 'half_yearly',
        lastCalibration: new Date('2026-03-15'),
        nextDueDate: new Date('2026-09-15'),
        labName: 'TN Quality Lab',
        cost: 2500,
      },
    ],
  });

  // Create safety checklists
  const mechChecklist = await prisma.safetyChecklist.create({
    data: {
      name: 'Mechanical Work Safety',
      jobType: 'mechanical',
      checklistItems: JSON.stringify([
        'PPE kit worn (helmet, gloves, goggles)',
        'Machine isolated and locked out',
        'Work area barricaded',
        'Fire extinguisher nearby',
        'Supervisor informed',
        'Hot work permit (if applicable)',
        'Buddy system in place',
      ]),
    },
  });

  const electricalChecklist = await prisma.safetyChecklist.create({
    data: {
      name: 'Electrical Work Safety',
      jobType: 'electrical',
      checklistItems: JSON.stringify([
        'PPE kit worn (insulated gloves, safety shoes)',
        'Power isolated and locked out/tagged out',
        'Voltage tester available and working',
        'Work area barricaded',
        'Supervisor informed',
        'Confined space permit (if applicable)',
        'Emergency contact noted',
      ]),
    },
  });

  const hydraulicChecklist = await prisma.safetyChecklist.create({
    data: {
      name: 'Hydraulic System Safety',
      jobType: 'hydraulic',
      checklistItems: JSON.stringify([
        'PPE kit worn (chemical-resistant gloves, goggles)',
        'System depressurized',
        'Hydraulic fluid drained/contained',
        'Machine isolated and locked out',
        'Spill kit available',
        'Supervisor informed',
        'Area well-ventilated',
      ]),
    },
  });

  // Create training records
  await prisma.trainingRecord.createMany({
    data: [
      {
        trainingName: 'Fire Safety Training',
        trainingType: 'fire',
        description: 'Annual fire safety and evacuation training',
        frequency: 'yearly',
        nextDueDate: new Date('2026-12-15'),
        assignedToIds: JSON.stringify([admin.id, supervisor.id, technician1.id, technician2.id, employee.id]),
      },
      {
        trainingName: 'First Aid Refresher',
        trainingType: 'first_aid',
        description: 'First aid and CPR refresher course',
        frequency: 'yearly',
        nextDueDate: new Date('2027-01-20'),
        assignedToIds: JSON.stringify([supervisor.id, technician1.id, technician2.id]),
      },
      {
        trainingName: 'Chemical Handling Safety',
        trainingType: 'safety',
        description: 'Safe handling of chemicals and SDS review',
        frequency: 'quarterly',
        nextDueDate: new Date('2026-09-30'),
        assignedToIds: JSON.stringify([technician1.id, technician2.id, employee.id]),
      },
    ],
  });

  // Create notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: supervisor.id,
        title: 'Low Stock Alert',
        message: 'Seal Ring (SL-002) is below minimum threshold. Current: 3, Min: 10',
        type: 'low_stock',
        linkUrl: '/inventory',
      },
      {
        userId: supervisor.id,
        title: 'Low Stock Alert',
        message: 'Gasket Set (GSK-008) is below minimum threshold. Current: 1, Min: 5',
        type: 'low_stock',
        linkUrl: '/inventory',
      },
      {
        userId: supervisor.id,
        title: 'PM Due Soon',
        message: 'Air Compressor C501 - Air Filter Replacement due on Sep 20, 2026',
        type: 'pm_reminder',
        linkUrl: '/pm',
      },
      {
        userId: storeAdmin.id,
        title: 'Low Stock Alert',
        message: 'Contactors 20A (ELC-005) is below minimum threshold. Current: 2, Min: 3',
        type: 'low_stock',
        linkUrl: '/inventory',
      },
    ],
  });

  console.log('Seed complete!');
  console.log('Login credentials:');
  console.log('  Admin: admin@aypols.com / password123');
  console.log('  Supervisor: rajesh@aypols.com / password123');
  console.log('  Technician: kumar@aypols.com / password123');
  console.log('  Store Admin: murugan@aypols.com / password123');
  console.log('  EHS Officer: priya@aypols.com / password123');
  console.log('  Employee: arun@aypols.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
