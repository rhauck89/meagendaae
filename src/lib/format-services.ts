/**
 * Format appointment services with duration display.
 * Example: "Corte + Barba • 45 min"
 */
export function formatServicesWithDuration(
  appointmentServices: any[] | null | undefined
): string {
  if (!appointmentServices || appointmentServices.length === 0) return '';

  const names = appointmentServices
    .map((s: any) => s.service?.name)
    .filter(Boolean)
    .join(', ');

  const totalDuration = appointmentServices.reduce(
    (sum: number, s: any) => sum + (s.duration_minutes || 0),
    0
  );

  if (totalDuration > 0) {
    return `${names} • ${totalDuration} min`;
  }

  return names;
}
