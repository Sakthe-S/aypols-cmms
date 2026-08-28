import { Pool, type PoolClient } from 'pg';
import bcrypt from 'bcryptjs';

process.loadEnvFile();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function insertMany(
  tx: PoolClient,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[]
): Promise<number[]> {
  const ids: number[] = [];
  for (const row of rows) {
    const cols = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const values = columns.map(c => row[c]);
    const res = await tx.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING id`,
      values
    );
    ids.push(Number(res.rows[0].id));
  }
  return ids;
}

async function main() {
  console.log('Seeding database...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash('password123', 10);

    const userIds = await insertMany(client, 'users', ['name', 'email', 'password_hash', 'role', 'trade', 'phone'], [
      { name: 'Admin User', email: 'admin@aypols.com', password_hash: passwordHash, role: 'ADMIN', trade: null, phone: '9876543210' },
      { name: 'Rajesh Kumar', email: 'rajesh@aypols.com', password_hash: passwordHash, role: 'SUPERVISOR', trade: 'mechanical', phone: '9876543211' },
      { name: 'Kumar S', email: 'kumar@aypols.com', password_hash: passwordHash, role: 'TECHNICIAN', trade: 'mechanical', phone: '9876543212' },
      { name: 'Selvam M', email: 'selvam@aypols.com', password_hash: passwordHash, role: 'TECHNICIAN', trade: 'electrical', phone: '9876543213' },
      { name: 'Murugan K', email: 'murugan@aypols.com', password_hash: passwordHash, role: 'STORE_ADMIN', trade: null, phone: '9876543214' },
      { name: 'Priya R', email: 'priya@aypols.com', password_hash: passwordHash, role: 'EHS_OFFICER', trade: null, phone: '9876543215' },
      { name: 'Arun V', email: 'arun@aypols.com', password_hash: passwordHash, role: 'EMPLOYEE', trade: null, phone: '9876543216' },
    ]);
    const [adminId, supervisorId, technician1Id, technician2Id, storeAdminId, ehsOfficerId, employeeId] = userIds;

    const machineIds = await insertMany(client, 'machines', [
      'machine_name', 'serial_number', 'department', 'location', 'installation_date', 'manufacturer', 'model', 'current_status',
    ], [
      { machine_name: 'Mixer M101', serial_number: 'MX-2020-001', department: 'Production', location: 'Bay 1', installation_date: new Date('2020-03-15'), manufacturer: 'Lodha Mechanical', model: 'LM-500', current_status: 'operational' },
      { machine_name: 'Reactor R201', serial_number: 'RC-2019-003', department: 'Production', location: 'Bay 2', installation_date: new Date('2019-08-20'), manufacturer: 'INOX', model: 'IR-1000', current_status: 'operational' },
      { machine_name: 'Forklift F301', serial_number: 'FK-2021-005', department: 'Logistics', location: 'Warehouse', installation_date: new Date('2021-01-10'), manufacturer: 'ACE', model: 'Forklift-15', current_status: 'operational' },
      { machine_name: 'Hydraulic Press H401', serial_number: 'HP-2018-002', department: 'Production', location: 'Bay 3', installation_date: new Date('2018-06-05'), manufacturer: 'Dake', model: 'Force-50', current_status: 'maintenance' },
      { machine_name: 'Air Compressor C501', serial_number: 'AC-2020-008', department: 'Utilities', location: 'Utility Room', installation_date: new Date('2020-11-20'), manufacturer: 'Atlas Copco', model: 'GA-37', current_status: 'operational' },
    ]);
    const [mixerId, reactorId, forkliftId, hydraulicPressId, compressorId] = machineIds;

    const partIds = await insertMany(client, 'spare_parts', [
      'part_code', 'part_name', 'category', 'unit', 'purchase_rate', 'current_qty', 'min_threshold', 'reorder_qty', 'storage_room', 'rack_bin', 'supplier',
    ], [
      { part_code: 'BRG-001', part_name: 'Main Bearing', category: 'Mechanical', unit: 'pcs', purchase_rate: 500, current_qty: 15, min_threshold: 5, reorder_qty: 10, storage_room: 'Main Store', rack_bin: 'R1-B1', supplier: 'SKF Bearings' },
      { part_code: 'SL-002', part_name: 'Seal Ring', category: 'Mechanical', unit: 'pcs', purchase_rate: 200, current_qty: 3, min_threshold: 10, reorder_qty: 20, storage_room: 'Main Store', rack_bin: 'R1-B2', supplier: 'Garlock' },
      { part_code: 'LUB-003', part_name: 'Lubricant (20W-50)', category: 'Consumable', unit: 'litre', purchase_rate: 150, current_qty: 25, min_threshold: 10, reorder_qty: 20, storage_room: 'Chemical Store', rack_bin: 'R2-B1', supplier: 'Shell' },
      { part_code: 'FLT-004', part_name: 'Hydraulic Filter', category: 'Hydraulic', unit: 'pcs', purchase_rate: 350, current_qty: 8, min_threshold: 4, reorder_qty: 10, storage_room: 'Main Store', rack_bin: 'R3-B1', supplier: 'Parker' },
      { part_code: 'ELC-005', part_name: 'Contactors (20A)', category: 'Electrical', unit: 'pcs', purchase_rate: 800, current_qty: 2, min_threshold: 3, reorder_qty: 5, storage_room: 'Electrical Store', rack_bin: 'R4-B1', supplier: 'Schneider' },
      { part_code: 'BGT-006', part_name: 'V-Belt (Type B68)', category: 'Mechanical', unit: 'pcs', purchase_rate: 250, current_qty: 12, min_threshold: 4, reorder_qty: 8, storage_room: 'Main Store', rack_bin: 'R1-B3', supplier: 'Gates' },
      { part_code: 'TMS-007', part_name: 'Temperature Sensor', category: 'Instrumentation', unit: 'pcs', purchase_rate: 1200, current_qty: 6, min_threshold: 2, reorder_qty: 4, storage_room: 'Electrical Store', rack_bin: 'R4-B2', supplier: 'Honeywell' },
      { part_code: 'GSK-008', part_name: 'Gasket Set', category: 'Mechanical', unit: 'set', purchase_rate: 400, current_qty: 1, min_threshold: 5, reorder_qty: 10, storage_room: 'Main Store', rack_bin: 'R1-B4', supplier: 'Flexitallic' },
    ]);

    const ticketIds = await insertMany(client, 'maintenance_tickets', [
      'ticket_number', 'machine_id', 'reported_by_id', 'priority', 'category', 'issue_description', 'status',
      'assigned_to_id', 'allocated_date', 'start_time', 'end_time', 'downtime_minutes', 'diagnosis', 'rootcause',
      'actions_taken', 'labor_hours', 'labor_rate_per_hour', 'labor_cost', 'contractor_charges', 'other_costs',
      'parts_cost', 'total_repair_cost', 'closure_outcome', 'closure_verified_by_id', 'closure_date',
    ], [
      {
        ticket_number: 'TKT-2026-001', machine_id: mixerId, reported_by_id: employeeId, priority: 'high',
        category: 'mechanical', issue_description: 'Bearing noise from main drive. Unusual vibration felt during operation.',
        status: 'closed', assigned_to_id: technician1Id, allocated_date: new Date('2026-08-20T08:00:00'),
        start_time: new Date('2026-08-20T08:30:00'), end_time: new Date('2026-08-20T10:30:00'),
        downtime_minutes: 120, diagnosis: 'Worn main bearing causing vibration and noise',
        rootcause: 'Normal wear and tear due to extended operation',
        actions_taken: 'Replaced main bearing and seal. Lubricated drive assembly.',
        labor_hours: 2, labor_rate_per_hour: 400, labor_cost: 800, contractor_charges: 0, other_costs: 50,
        parts_cost: 1350, total_repair_cost: 2200, closure_outcome: 'closed', closure_verified_by_id: supervisorId,
        closure_date: new Date('2026-08-20T11:00:00'),
      },
      {
        ticket_number: 'TKT-2026-002', machine_id: hydraulicPressId, reported_by_id: employeeId, priority: 'critical',
        category: 'hydraulic', issue_description: 'Hydraulic oil leakage from main cylinder. Production stopped.',
        status: 'in_progress', assigned_to_id: technician2Id, allocated_date: new Date('2026-08-24T07:00:00'),
        start_time: new Date('2026-08-24T07:30:00'),
      },
      {
        ticket_number: 'TKT-2026-003', machine_id: compressorId, reported_by_id: employeeId, priority: 'medium',
        category: 'electrical', issue_description: 'ACB tripping frequently. Power fluctuation observed.',
        status: 'open',
      },
    ]);
    const [ticket1Id, ticket2Id, ticket3Id] = ticketIds;

    await insertMany(client, 'ticket_spare_parts', ['ticket_id', 'part_id', 'qty', 'unit_price', 'total_cost', 'user_id'], [
      { ticket_id: ticket1Id, part_id: partIds[0], qty: 2, unit_price: 500, total_cost: 1000, user_id: technician1Id },
      { ticket_id: ticket1Id, part_id: partIds[1], qty: 1, unit_price: 200, total_cost: 200, user_id: technician1Id },
      { ticket_id: ticket1Id, part_id: partIds[2], qty: 1, unit_price: 150, total_cost: 150, user_id: technician1Id },
    ]);

    await client.query(
      `UPDATE machines SET lifetime_maintenance_cost = $1, last_service_date = $2 WHERE id = $3`,
      [2200, new Date('2026-08-20'), mixerId]
    );

    await insertMany(client, 'pm_schedules', [
      'machine_id', 'task_name', 'frequency', 'description', 'checklist_items', 'next_due_date',
    ], [
      { machine_id: mixerId, task_name: 'Bearing Inspection', frequency: 'quarterly', description: 'Check bearing condition, noise level, and temperature', checklist_items: JSON.stringify(['Check noise level', 'Measure temperature', 'Inspect lubrication', 'Check vibration']), next_due_date: new Date('2026-11-15') },
      { machine_id: reactorId, task_name: 'Safety Valve Check', frequency: 'half_yearly', description: 'Test and calibrate safety valves', checklist_items: JSON.stringify(['Visual inspection', 'Pressure test', 'Calibration check', 'Leak test']), next_due_date: new Date('2027-02-20') },
      { machine_id: compressorId, task_name: 'Air Filter Replacement', frequency: 'monthly', description: 'Replace air filters and check oil level', checklist_items: JSON.stringify(['Replace air filter', 'Check oil level', 'Drain condensate', 'Check belt tension']), next_due_date: new Date('2026-09-20') },
      { machine_id: forkliftId, task_name: 'Hydraulic System Check', frequency: 'quarterly', description: 'Inspect hydraulic fluid level, hoses, and cylinder', checklist_items: JSON.stringify(['Check hydraulic fluid', 'Inspect hoses', 'Check cylinder operation', 'Test lifting capacity']), next_due_date: new Date('2026-10-10') },
    ]);

    await insertMany(client, 'amc_records', [
      'machine_id', 'contract_number', 'vendor_name', 'start_date', 'end_date', 'frequency', 'cost', 'description', 'next_service_date',
    ], [
      { machine_id: compressorId, contract_number: 'AMC-2026-001', vendor_name: 'Atlas Copco Service', start_date: new Date('2026-01-01'), end_date: new Date('2026-12-31'), frequency: 'quarterly', cost: 50000, description: 'Annual maintenance contract for air compressor', next_service_date: new Date('2026-10-01') },
    ]);

    await insertMany(client, 'calibration_records', [
      'machine_id', 'instrument_name', 'calibration_type', 'frequency', 'last_calibration', 'next_due_date', 'lab_name', 'cost',
    ], [
      { machine_id: reactorId, instrument_name: 'Temperature Controller', calibration_type: 'external', frequency: 'half_yearly', last_calibration: new Date('2026-03-15'), next_due_date: new Date('2026-09-15'), lab_name: 'TN Quality Lab', cost: 2500 },
    ]);

    const checklistIds = await insertMany(client, 'safety_checklists', ['name', 'job_type', 'checklist_items'], [
      { name: 'Mechanical Work Safety', job_type: 'mechanical', checklist_items: JSON.stringify(['PPE kit worn (helmet, gloves, goggles)', 'Machine isolated and locked out', 'Work area barricaded', 'Fire extinguisher nearby', 'Supervisor informed', 'Hot work permit (if applicable)', 'Buddy system in place']) },
      { name: 'Electrical Work Safety', job_type: 'electrical', checklist_items: JSON.stringify(['PPE kit worn (insulated gloves, safety shoes)', 'Power isolated and locked out/tagged out', 'Voltage tester available and working', 'Work area barricaded', 'Supervisor informed', 'Confined space permit (if applicable)', 'Emergency contact noted']) },
      { name: 'Hydraulic System Safety', job_type: 'hydraulic', checklist_items: JSON.stringify(['PPE kit worn (chemical-resistant gloves, goggles)', 'System depressurized', 'Hydraulic fluid drained/contained', 'Machine isolated and locked out', 'Spill kit available', 'Supervisor informed', 'Area well-ventilated']) },
    ]);

    await insertMany(client, 'training_records', [
      'training_name', 'training_type', 'description', 'frequency', 'next_due_date', 'assigned_to_ids',
    ], [
      { training_name: 'Fire Safety Training', training_type: 'fire', description: 'Annual fire safety and evacuation training', frequency: 'yearly', next_due_date: new Date('2026-12-15'), assigned_to_ids: JSON.stringify([adminId, supervisorId, technician1Id, technician2Id, employeeId]) },
      { training_name: 'First Aid Refresher', training_type: 'first_aid', description: 'First aid and CPR refresher course', frequency: 'yearly', next_due_date: new Date('2027-01-20'), assigned_to_ids: JSON.stringify([supervisorId, technician1Id, technician2Id]) },
      { training_name: 'Chemical Handling Safety', training_type: 'safety', description: 'Safe handling of chemicals and SDS review', frequency: 'quarterly', next_due_date: new Date('2026-09-30'), assigned_to_ids: JSON.stringify([technician1Id, technician2Id, employeeId]) },
    ]);

    await insertMany(client, 'notifications', ['user_id', 'title', 'message', 'type', 'link_url'], [
      { user_id: supervisorId, title: 'Low Stock Alert', message: 'Seal Ring (SL-002) is below minimum threshold. Current: 3, Min: 10', type: 'low_stock', link_url: '/inventory' },
      { user_id: supervisorId, title: 'Low Stock Alert', message: 'Gasket Set (GSK-008) is below minimum threshold. Current: 1, Min: 5', type: 'low_stock', link_url: '/inventory' },
      { user_id: supervisorId, title: 'PM Due Soon', message: 'Air Compressor C501 - Air Filter Replacement due on Sep 20, 2026', type: 'pm_reminder', link_url: '/pm' },
      { user_id: storeAdminId, title: 'Low Stock Alert', message: 'Contactors 20A (ELC-005) is below minimum threshold. Current: 2, Min: 3', type: 'low_stock', link_url: '/inventory' },
    ]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

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
    await pool.end();
  });