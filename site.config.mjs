// Public settings. Never add credentials here. Rebuild after any changes.
export default {
  name: 'ADG Hospitality',
  siteUrl: 'https://adghospitality.com',
  email: 'alisa@adghospitality.com',
  // Paste your actual public Cal.com, Calendly, or Google appointment URL.
  bookingUrl: '',
  consultationMinutes: 30,
  // Leave empty to use /api/inquiry on Vercel. The HostGator build changes this.
  inquiryEndpoint: '/api/inquiry',
  // Turn on only after testing the production inquiry delivery.
  inquiryEnabled: false,
  launchReady: false,
};
