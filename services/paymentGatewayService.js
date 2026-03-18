const axios = require('axios');
const mtnService = require('./mtnMobileMoneyService');

const readEnv = (...keys) => {
  for (const key of keys) {
    if (typeof process.env[key] === 'string' && process.env[key].trim()) {
      return process.env[key].trim();
    }
  }
  return '';
};

const PROVIDER_KIND = readEnv('PAYMENT_PROVIDER', 'PAYMENT_GATEWAY', 'MOBILE_MONEY_PROVIDER') || 'auto';
const PAYMENT_API_ID = readEnv('PAYMENT_API_ID', 'API ID');
const PAYMENT_API_KEY = readEnv('PAYMENT_API_KEY', 'API Key');
const PAYMENT_API_BASE_URL = readEnv('PAYMENT_API_BASE_URL', 'PAYMENT_PROVIDER_BASE_URL', 'PAYMENT_COLLECTION_BASE_URL');
const PAYMENT_INITIATE_PATH = readEnv('PAYMENT_INITIATE_PATH') || '/payments/initiate';
const PAYMENT_STATUS_PATH = readEnv('PAYMENT_STATUS_PATH') || '/payments/status';

const normalizeStatus = (rawStatus) => {
  const value = String(rawStatus || '').trim().toLowerCase();
  if (!value) return 'failed';
  if (['pending', 'processing', 'initiated', 'requested', 'waiting'].includes(value)) return 'pending';
  if (['success', 'successful', 'completed', 'paid', 'approved'].includes(value)) return 'success';
  if (['failed', 'error', 'rejected', 'cancelled', 'canceled', 'expired', 'timeout'].includes(value)) return 'failed';
  return 'failed';
};

const buildGenericHeaders = () => {
  if (!PAYMENT_API_ID || !PAYMENT_API_KEY) {
    throw new Error('Missing payment provider credentials. Configure PAYMENT_API_ID and PAYMENT_API_KEY.');
  }

  return {
    'Content-Type': 'application/json',
    'X-API-ID': PAYMENT_API_ID,
    'X-API-KEY': PAYMENT_API_KEY,
    Authorization: `Bearer ${PAYMENT_API_KEY}`,
  };
};

const detectProviderKind = () => {
  if (PROVIDER_KIND !== 'auto') return PROVIDER_KIND;
  if (PAYMENT_API_BASE_URL) return 'generic';

  const hasMtnConfig = Boolean(
    readEnv('MTN_CONSUMER_KEY') &&
    readEnv('MTN_CONSUMER_SECRET') &&
    readEnv('MTN_API_USER')
  );

  if (hasMtnConfig || process.env.MTN_USE_MOCK === 'true') {
    return 'mtn';
  }

  // No provider fully configured. Fall back to mtn (which supports mock mode)
  // rather than generic, which requires PAYMENT_API_BASE_URL.
  return 'mtn';
};

const initiateCollection = async ({ amount, currency, phoneNumber, reference, description, paymentMethod, callbackUrl }) => {
  const providerKind = detectProviderKind();

  if (providerKind === 'mtn') {
    const response = await mtnService.requestToPay({
      amount,
      currency,
      externalId: reference,
      payerMessage: description,
      payeeNote: description,
      // Both the real MTN service and mock expect payer.partyId
      payer: {
        partyIdType: 'MSISDN',
        partyId: phoneNumber,
      },
      // Some versions of the real service also read phoneNumber directly
      phoneNumber,
    });

    return {
      provider: 'mtn',
      providerReference: response.referenceId,
      externalReference: response.externalId || reference,
      status: normalizeStatus(response.status),
      raw: response,
    };
  }

  if (!PAYMENT_API_BASE_URL) {
    throw new Error('Missing PAYMENT_API_BASE_URL for generic payment provider integration.');
  }

  const payload = {
    amount,
    currency,
    phone_number: phoneNumber,
    payment_method: paymentMethod,
    reference,
    description,
    callback_url: callbackUrl,
  };

  const response = await axios.post(
    `${PAYMENT_API_BASE_URL.replace(/\/$/, '')}${PAYMENT_INITIATE_PATH}`,
    payload,
    {
      headers: buildGenericHeaders(),
      timeout: 30000,
    }
  );

  const data = response.data || {};
  return {
    provider: 'generic',
    providerReference: data.provider_reference || data.reference || data.transaction_id || reference,
    externalReference: data.external_reference || data.reference || reference,
    status: normalizeStatus(data.status || 'pending'),
    raw: data,
  };
};

const getCollectionStatus = async ({ providerReference }) => {
  const providerKind = detectProviderKind();

  if (!providerReference) {
    throw new Error('providerReference is required to fetch payment status');
  }

  if (providerKind === 'mtn') {
    const response = await mtnService.checkTransactionStatus(providerReference);
    return {
      provider: 'mtn',
      providerReference,
      status: normalizeStatus(response.status),
      raw: response,
    };
  }

  if (!PAYMENT_API_BASE_URL) {
    throw new Error('Missing PAYMENT_API_BASE_URL for generic payment provider integration.');
  }

  const response = await axios.get(
    `${PAYMENT_API_BASE_URL.replace(/\/$/, '')}${PAYMENT_STATUS_PATH}/${encodeURIComponent(providerReference)}`,
    {
      headers: buildGenericHeaders(),
      timeout: 20000,
    }
  );

  const data = response.data || {};
  return {
    provider: 'generic',
    providerReference,
    status: normalizeStatus(data.status),
    raw: data,
  };
};

const extractWebhookEvent = (payload) => {
  const providerReference =
    payload?.provider_reference ||
    payload?.reference ||
    payload?.transaction_id ||
    payload?.data?.provider_reference ||
    payload?.data?.reference ||
    payload?.data?.transaction_id ||
    '';

  const externalReference =
    payload?.external_reference ||
    payload?.externalId ||
    payload?.reference ||
    payload?.data?.external_reference ||
    payload?.data?.externalId ||
    '';

  const rawStatus =
    payload?.status ||
    payload?.payment_status ||
    payload?.transaction_status ||
    payload?.data?.status ||
    payload?.event?.status ||
    '';

  return {
    providerReference,
    externalReference,
    status: normalizeStatus(rawStatus),
    raw: payload,
  };
};

module.exports = {
  initiateCollection,
  getCollectionStatus,
  extractWebhookEvent,
  normalizeStatus,
};
