import { apiCall, API_ENDPOINTS } from '../config/apiConfig';

export interface PurchaseCreditsRequest {
  packageId: string;
  paymentMethodId: string;
}

export interface PurchaseCreditsResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export const purchaseCreditsApi = (req: PurchaseCreditsRequest) =>
  apiCall(
    API_ENDPOINTS.stripe.purchaseCredits,
    req,
    'Failed to purchase credits'
  ) as Promise<PurchaseCreditsResponse>;

