import { parseISO, isBefore, isAfter, differenceInMinutes } from 'date-fns';

export interface CalendarItem {
  id: string;
  start_time: string;
  end_time: string;
  [key: string]: any;
}

export interface PositionedItem {
  item: CalendarItem;
  top: number;
  height: number;
  left: number;
  width: number;
  column: number;
  totalColumns: number;
}

const START_HOUR = 7;
const HOUR_HEIGHT = 60; // Default, can be passed as param

export const getTimePosition = (timeStr: string, hourHeight = HOUR_HEIGHT, startHour = START_HOUR): number => {
  const date = parseISO(timeStr);
  const hours = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, (hours - startHour) * hourHeight);
};

export const getBlockHeight = (startStr: string, endStr: string, hourHeight = HOUR_HEIGHT): number => {
  const mins = differenceInMinutes(parseISO(endStr), parseISO(startStr));
  return Math.max(20, (mins / 60) * hourHeight);
};

/**
 * Groups appointments that overlap in time
 */
export const groupOverlappingItems = (items: CalendarItem[]): CalendarItem[][] => {
  if (items.length === 0) return [];

  // Sort by start time, then by end time (longer first)
  const sorted = [...items].sort((a, b) => {
    const startA = parseISO(a.start_time).getTime();
    const startB = parseISO(b.start_time).getTime();
    if (startA !== startB) return startA - startB;
    
    const endA = parseISO(a.end_time).getTime();
    const endB = parseISO(b.end_time).getTime();
    return endB - endA;
  });

  const groups: CalendarItem[][] = [];
  let currentGroup: CalendarItem[] = [];
  let groupEndTime: number | null = null;

  for (const item of sorted) {
    const itemStart = parseISO(item.start_time).getTime();
    const itemEnd = parseISO(item.end_time).getTime();

    if (groupEndTime === null || itemStart < groupEndTime) {
      currentGroup.push(item);
      groupEndTime = Math.max(groupEndTime || 0, itemEnd);
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
      groupEndTime = itemEnd;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

/**
 * Calculates columns for a group of overlapping items
 */
export const calculateGroupPositions = (
  group: CalendarItem[], 
  hourHeight = HOUR_HEIGHT, 
  startHour = START_HOUR
): PositionedItem[] => {
  const columns: CalendarItem[][] = [];
  
  // Sort items in group to ensure consistent column assignment
  const sortedGroup = [...group].sort((a, b) => {
    const startA = parseISO(a.start_time).getTime();
    const startB = parseISO(b.start_time).getTime();
    if (startA !== startB) return startA - startB;
    return parseISO(b.end_time).getTime() - parseISO(a.end_time).getTime();
  });

  for (const item of sortedGroup) {
    let placed = false;
    for (let i = 0; i < columns.length; i++) {
      const lastInColumn = columns[i][columns[i].length - 1];
      if (isBefore(parseISO(lastInColumn.end_time), parseISO(item.start_time)) || 
          parseISO(lastInColumn.end_time).getTime() === parseISO(item.start_time).getTime()) {
        columns[i].push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([item]);
    }
  }

  const totalColumns = columns.length;
  const positionedItems: PositionedItem[] = [];

  columns.forEach((col, colIdx) => {
    col.forEach(item => {
      positionedItems.push({
        item,
        top: getTimePosition(item.start_time, hourHeight, startHour),
        height: getBlockHeight(item.start_time, item.end_time, hourHeight),
        column: colIdx,
        totalColumns,
        left: (colIdx / totalColumns) * 100,
        width: (1 / totalColumns) * 100
      });
    });
  });

  return positionedItems;
};

/**
 * Professional color generation
 */
export const getProfessionalColor = (id: string, name = ''): { 
  bg: string, 
  border: string, 
  text: string, 
  badge: string 
} => {
  // Pastel colors palette
  const palette = [
    { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-900', badge: 'bg-blue-100' },
    { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-900', badge: 'bg-emerald-100' },
    { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', badge: 'bg-purple-100' },
    { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-900', badge: 'bg-amber-100' },
    { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-900', badge: 'bg-rose-100' },
    { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-900', badge: 'bg-cyan-100' },
    { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-900', badge: 'bg-indigo-100' },
    { bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-900', badge: 'bg-teal-100' },
  ];

  // Use ID or name to get a stable index
  const seed = id || name || 'default';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};

export const getStatusVisuals = (status: string) => {
  const statusConfig: Record<string, { bg: string, border: string, text: string }> = {
    pending: { bg: 'bg-warning/10', border: 'border-warning/50', text: 'text-warning-foreground' },
    confirmed: { bg: 'bg-primary/10', border: 'border-primary/50', text: 'text-primary-foreground' },
    in_progress: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-700' },
    cancelled: { bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive' },
    completed: { bg: 'bg-success/10', border: 'border-success/50', text: 'text-success-foreground' },
    no_show: { bg: 'bg-muted/50', border: 'border-border', text: 'text-muted-foreground' },
    rescheduled: { bg: 'bg-orange-400/10', border: 'border-orange-500/50', text: 'text-orange-700' },
    late: { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-700' },
  };

  return statusConfig[status] || { bg: 'bg-muted/30', border: 'border-border', text: 'text-foreground' };
};
