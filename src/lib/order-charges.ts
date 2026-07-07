export const SERVICE_CHARGE_RATE = 0.05;
export const PBJT_RATE = 0.1;

export function calculateOrderCharges(subtotal: number) {
  const serviceCharge = Math.round(subtotal * SERVICE_CHARGE_RATE);
  const taxTotal = Math.round((subtotal + serviceCharge) * PBJT_RATE);

  return {
    subtotal,
    serviceCharge,
    taxTotal,
    total: subtotal + serviceCharge + taxTotal,
  };
}

export function formatRate(rate: number) {
  return `${Math.round(rate * 100)}%`;
}
