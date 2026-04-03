import { useOrganization } from '../context/OrganizationContext';

export function useOrganizationSettings() {
  const { organization } = useOrganization();

  return {
    // Financial settings
    vatRate: organization?.vat_rate ?? 20,
    enableVAT: organization?.settings?.enableVAT ?? true,
    enableReceipts: organization?.settings?.enableReceipts ?? true,
    enableNotifications: organization?.settings?.enableNotifications ?? true,
    currencySymbol: organization?.currency_symbol ?? '£',
    currencyCode: organization?.currency_code ?? 'GBP',

    // Theme colors
    primaryColor: organization?.theme?.primaryColor ?? '#2e7d32',
    secondaryColor: organization?.theme?.secondaryColor ?? '#ffd700',
  };
}