/**
 * Format appointment services with duration display.
 * Example: "Corte + Barba • 45 min"
 */
export function formatServicesWithDuration(
  appointmentServices: any[] | null | undefined,
  limit: number = 0
): string {
  if (!appointmentServices || appointmentServices.length === 0) return '';

  const validServices = appointmentServices.filter((s: any) => s.service?.name);
  if (validServices.length === 0) return '';

  let names = '';
  if (limit > 0 && validServices.length > limit) {
    names = validServices
      .slice(0, limit)
      .map((s: any) => s.service.name)
      .join(', ') + ` +${validServices.length - limit}`;
  } else {
    names = validServices.map((s: any) => s.service.name).join(', ');
  }

  const totalDuration = appointmentServices.reduce(
    (sum: number, s: any) => sum + (s.duration_minutes || 0),
    0
  );

  if (totalDuration > 0) {
    return `${names} • ${totalDuration} min`;
  }

  return names;
}
