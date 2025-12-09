/**
 * Basiq API Service
 * Handles all interactions with the Basiq Open Banking API for Australian banks
 * Documentation: https://api.basiq.io/reference
 */

const BASIQ_API_URL = process.env.BASIQ_API_URL || 'https://au-api.basiq.io';
const BASIQ_API_KEY = process.env.BASIQ_API_KEY;

interface BasiqTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface BasiqUser {
  id: string;
  email: string;
  mobile?: string;
}

interface BasiqConnection {
  id: string;
  status: string;
  institution: {
    id: string;
    name: string;
    shortName: string;
    logo: {
      links: {
        square: string;
      };
    };
  };
  accounts: string[];
  lastUsed: string;
}

interface BasiqAccount {
  id: string;
  accountNo: string;
  name: string;
  currency: string;
  balance: number;
  availableFunds: number;
  class: {
    type: string;
    product: string;
  };
  connection: string;
  institution: string;
  lastUpdated: string;
  status: string;
}

interface BasiqTransaction {
  id: string;
  status: string;
  description: string;
  amount: number;
  account: string;
  balance: number;
  direction: 'credit' | 'debit';
  class: string;
  institution: string;
  connection: string;
  transactionDate: string;
  postDate: string;
  subClass?: {
    title: string;
    code: string;
  };
  enrich?: {
    merchant?: {
      businessName: string;
      category: string;
    };
    category?: {
      anzsic?: {
        code: string;
        title: string;
      };
    };
  };
}

// Token cache to avoid excessive token requests
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid Basiq access token
 * Uses cached token if still valid, otherwise fetches a new one
 */
export async function getBasiqToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  if (!BASIQ_API_KEY) {
    throw new Error('BASIQ_API_KEY is not configured');
  }

  const response = await fetch(`${BASIQ_API_URL}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${BASIQ_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'basiq-version': '3.0',
    },
    body: 'scope=SERVER_ACCESS',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Basiq token: ${error}`);
  }

  const data: BasiqTokenResponse = await response.json();

  // Cache the token (expire 5 minutes before actual expiry for safety)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

/**
 * Create a Basiq user for the given email
 * Required before creating connections
 */
export async function createBasiqUser(email: string, mobile?: string): Promise<BasiqUser> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'basiq-version': '3.0',
    },
    body: JSON.stringify({
      email,
      mobile: mobile || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Basiq user: ${error}`);
  }

  return response.json();
}

/**
 * Get or create a Basiq user
 */
export async function getOrCreateBasiqUser(email: string): Promise<BasiqUser> {
  const token = await getBasiqToken();

  // Try to find existing user by email
  const searchResponse = await fetch(`${BASIQ_API_URL}/users?filter=email.eq('${encodeURIComponent(email)}')`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
  }

  // Create new user if not found
  return createBasiqUser(email);
}

/**
 * Generate a consent/auth link for the user to connect their bank
 * Returns a URL that opens the Basiq consent UI
 */
export async function createConsentLink(basiqUserId: string): Promise<string> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/auth_link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'basiq-version': '3.0',
    },
    body: JSON.stringify({
      // Optional: specify which institutions to show
      // institutionId: 'AU00000',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create consent link: ${error}`);
  }

  const data = await response.json();
  return data.links.self;
}

/**
 * Get all connections for a Basiq user
 */
export async function getConnections(basiqUserId: string): Promise<BasiqConnection[]> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/connections`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get connections: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Get a specific connection
 */
export async function getConnection(basiqUserId: string, connectionId: string): Promise<BasiqConnection> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/connections/${connectionId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get connection: ${error}`);
  }

  return response.json();
}

/**
 * Refresh a connection to get latest data
 */
export async function refreshConnection(basiqUserId: string, connectionId: string): Promise<void> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/connections/${connectionId}/refresh`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh connection: ${error}`);
  }
}

/**
 * Delete a connection
 */
export async function deleteConnection(basiqUserId: string, connectionId: string): Promise<void> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/connections/${connectionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete connection: ${error}`);
  }
}

/**
 * Get all accounts for a Basiq user
 */
export async function getAccounts(basiqUserId: string): Promise<BasiqAccount[]> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/accounts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get accounts: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Get a specific account
 */
export async function getAccount(basiqUserId: string, accountId: string): Promise<BasiqAccount> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/accounts/${accountId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get account: ${error}`);
  }

  return response.json();
}

/**
 * Get transactions for a Basiq user
 * Supports filtering by account, date range, etc.
 */
export async function getTransactions(
  basiqUserId: string,
  options?: {
    accountId?: string;
    fromDate?: string; // YYYY-MM-DD
    toDate?: string; // YYYY-MM-DD
    limit?: number;
  }
): Promise<BasiqTransaction[]> {
  const token = await getBasiqToken();

  const params = new URLSearchParams();

  if (options?.accountId) {
    params.append('filter', `account.id.eq('${options.accountId}')`);
  }

  if (options?.limit) {
    params.append('limit', options.limit.toString());
  }

  const url = `${BASIQ_API_URL}/users/${basiqUserId}/transactions${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get transactions: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Get all institutions (banks) available
 */
export async function getInstitutions(): Promise<any[]> {
  const token = await getBasiqToken();

  const response = await fetch(`${BASIQ_API_URL}/institutions`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'basiq-version': '3.0',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get institutions: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Map Basiq account type to Monitrax AccountType
 */
export function mapBasiqAccountType(basiqType: string): 'TRANSACTIONAL' | 'SAVINGS' | 'CREDIT_CARD' | 'OFFSET' {
  const typeMap: Record<string, 'TRANSACTIONAL' | 'SAVINGS' | 'CREDIT_CARD' | 'OFFSET'> = {
    'transaction': 'TRANSACTIONAL',
    'savings': 'SAVINGS',
    'credit-card': 'CREDIT_CARD',
    'credit card': 'CREDIT_CARD',
    'loan': 'TRANSACTIONAL', // Will need to handle separately
    'mortgage': 'OFFSET', // Could be offset
    'term-deposit': 'SAVINGS',
    'investment': 'SAVINGS',
  };

  return typeMap[basiqType.toLowerCase()] || 'TRANSACTIONAL';
}

/**
 * Map Basiq transaction direction to Monitrax TransactionDirection
 */
export function mapBasiqTransactionDirection(direction: 'credit' | 'debit'): 'IN' | 'OUT' {
  return direction === 'credit' ? 'IN' : 'OUT';
}

// Export types for use in other files
export type { BasiqUser, BasiqConnection, BasiqAccount, BasiqTransaction };
