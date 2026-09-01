import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(date);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    allocated: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    verified: 'bg-purple-100 text-purple-800',
    closed: 'bg-gray-100 text-gray-800',
    operational: 'bg-green-100 text-green-800',
    down: 'bg-red-100 text-red-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

export function generateTicketNumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `TKT-${year}-${String(sequence).padStart(3, '0')}`;
}

const FLUID_KEYWORDS = [
  'oil', 'grease', 'lubricant', 'solvent', 'acetone', 'thinner', 'resin',
  'coolant', 'cutting fluid', 'hydraulic fluid', 'transformer oil', 'gear oil',
  'lpg', 'diesel', 'fuel', 'petrol', 'kerosene', 'chemical', 'acid',
  'fevicol', 'adhesive', 'glue', 'epsom', 'lactose', 'syrup',
];

// Countable units -> always physical (round figures), regardless of the name.
const COUNTABLE_UNITS = [
  'nos', 'no', 'pcs', 'pc', 'set', 'sets', 'pair', 'pairs', 'packet',
  'pack', 'packets', 'roll', 'rolls', 'piece', 'pieces', 'each',
  'box', 'boxes', 'bottle', 'carton', 'unit', 'units', 'mtr', 'mtrs', 'mt', 'metre',
];

export function isFluidPart(part: { partName?: string; name?: string; unit?: string }): boolean {
  const name = `${part.partName || part.name || ''}`.toLowerCase();
  const unit = (part.unit || '').toLowerCase().trim();
  const unitBase = unit.split(' ')[0];
  if (COUNTABLE_UNITS.includes(unitBase)) return false;
  return FLUID_KEYWORDS.some((k) => name.includes(k));
}

export function formatQty(
  part: { partName?: string; name?: string; unit?: string },
  value: number | null | undefined
): string {
  const v = Number(value ?? 0);
  if (isFluidPart(part)) return v.toFixed(2);
  return Math.round(v).toString();
}
