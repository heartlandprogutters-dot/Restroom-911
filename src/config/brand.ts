/**
 * All user-visible product naming lives here.
 * index.html theme-color should match `themeColor` if you change it.
 */
export const brand = {
  name: 'Restroom 911',
  formerName: 'Restroom Pronto',
  shortName: 'Restroom 911',
  tagline: 'Find a usable restroom quickly.',
  description:
    'A mobile restroom finder for urgent stops. The prototype uses fictional demo places in five western Kentucky cities.',
  themeColor: '#0f3f3e',
  backgroundColor: '#f4f1ea',
  /** Planned consumer price. The prototype never collects payment. */
  plannedMonthlyPriceUsd: 5,
  emergencyNotice:
    'Restroom details can change. Hours open does not mean a restroom is free. Restroom 911 is not an emergency service and does not give medical advice.',
  demoWarning:
    'Sample places are fictional. Do not use them for real emergency navigation.',
} as const;
