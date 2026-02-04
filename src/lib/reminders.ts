export function reminderStage(daysOverdue: number) {
  if (daysOverdue >= 21) return 3;
  if (daysOverdue >= 14) return 2;
  if (daysOverdue >= 7) return 1;
  return 0;
}
