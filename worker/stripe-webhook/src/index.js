import Stripe from 'stripe';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Stripe client for webhook verification (API key not used, but required for init)
const stripe = new Stripe('sk_none', {
  httpClient: Stripe.createFetchHttpClient(),
});

// Resend API endpoint
const RESEND_API_URL = 'https://api.resend.com/emails';

// Keygen configuration
const KEYGEN_API_URL = 'https://api.keygen.sh/v1/accounts/bytebase';
const KEYGEN_POLICY_ID = '2ca585ae-4ba4-4ce9-9056-8d51ba55b50a';

// Product configuration: productId -> planName
const PRODUCTS = {
  // Test
  'prod_TvEOD3fbORZgV5': 'Team',
  // Production
  'prod_TvIPxbQUfqXquA': 'Team',
};

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    const body = await request.text();

    // Try to verify with live secret first, then test
    let event = await verifyWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET_LIVE);
    if (!event) {
      event = await verifyWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET_TEST);
    }
    if (!event) {
      return new Response('Invalid signature', { status: 400 });
    }

    // Handle the event
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      // Only handle subscription invoices (not one-time payments)
      const subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription;
      if (subscriptionId) {
        const result = processInvoice(invoice, event.livemode, subscriptionId);
        const prefix = result.mode === 'test' ? '[test] ' : '';
        if (result.error) {
          console.log(`${prefix}Skipped: ${result.error}`);
        } else {
          // Log proration (mid-cycle upgrade) details
          if (result.billingReason === 'subscription_update') {
            console.log(
              `${prefix}Mid-cycle upgrade: ${result.customerEmail} (${result.customerName || 'N/A'}) ` +
                `upgraded to ${result.userSeatCount} seats on ${result.planName} plan. ` +
                `Amount charged: $${(result.amountPaid / 100).toFixed(2)} ${result.currency.toUpperCase()}`
            );
          }
          try {
            result.licenseKey = await generateLicense(result, env);
            console.log(`${prefix}Invoice paid:`, JSON.stringify(result, null, 2));
            await sendLicenseEmail(result, env);
          } catch (error) {
            console.log(`${prefix}License generation failed:`, error.message);
          }
        }
      } else {
        console.log('Skipped: Not a subscription invoice');
      }
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

function processInvoice(invoice, livemode, subscriptionId) {
  const mode = livemode ? 'live' : 'test';
  const isProration = invoice.billing_reason === 'subscription_update';

  // For proration invoices (mid-cycle upgrades), find the NEW state line item (positive amount)
  // For regular invoices (renewals, initial), use the first line item
  const lineItem = isProration
    ? invoice.lines?.data?.find((line) => line.amount > 0)
    : invoice.lines?.data?.[0];
  if (!lineItem) {
    return { mode, error: 'No line items found' };
  }

  const priceDetails = lineItem.pricing?.price_details;
  if (!priceDetails) {
    return { mode, error: 'No price details found' };
  }

  // Look up plan name by product ID
  const productId = priceDetails.product;
  const planName = PRODUCTS[productId];
  if (!planName) {
    return { mode, error: `Unknown product: ${productId}` };
  }

  // Split customer name into first and last name
  const { firstName, lastName } = splitName(invoice.customer_name);

  return {
    mode,
    invoiceId: invoice.id,
    subscriptionId,
    customerId: invoice.customer,
    customerEmail: invoice.customer_email,
    customerName: invoice.customer_name,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerCountry: invoice.customer_address?.country,
    planName,
    userSeatCount: lineItem.quantity,
    periodStart: lineItem.period.start,
    periodEnd: lineItem.period.end,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    billingReason: invoice.billing_reason,
  };
}

async function verifyWebhook(payload, signature, secret) {
  if (!secret) return null;

  try {
    return await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      secret,
      undefined,
      cryptoProvider
    );
  } catch {
    return null;
  }
}

// Split full name into first and last name
function splitName(fullName) {
  if (!fullName) return {};
  // Normalize: trim and collapse multiple spaces into one
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return {};
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

// Upsert user in Keygen: retrieve by email, create if not found
async function upsertKeygenUser(params, env) {
  const { email, customerId, customerFirstName, customerLastName, customerCountry } = params;
  const keygenApiUrl = KEYGEN_API_URL;
  const headers = {
    Authorization: `Bearer ${env.KEYGEN_API_KEY}`,
    'Content-Type': 'application/vnd.api+json',
    Accept: 'application/vnd.api+json',
  };

  // Try to retrieve user by email (email can be used as ID in the URL path)
  const retrieveUrl = `${keygenApiUrl}/users/${email.toLowerCase()}`;
  const retrieveResponse = await fetch(retrieveUrl, { headers });

  if (retrieveResponse.ok) {
    const userData = await retrieveResponse.json();
    return { id: userData.data.id };
  }

  // User not found (404), create new user
  const metadata = {
    stripeCustomerId: customerId,
  };
  if (customerCountry) metadata.country = customerCountry;

  const attributes = {
    email: email.toLowerCase(),
    metadata,
  };
  if (customerFirstName) attributes.firstName = customerFirstName;
  if (customerLastName) attributes.lastName = customerLastName;

  const createResponse = await fetch(`${keygenApiUrl}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        type: 'users',
        attributes,
      },
    }),
  });

  if (!createResponse.ok) {
    const errorData = await createResponse.json();
    throw new Error(`Failed to create Keygen user: ${JSON.stringify(errorData)}`);
  }

  const createData = await createResponse.json();
  return { id: createData.data.id };
}

// Create license in Keygen
async function createKeygenLicense(params, env) {
  const { userId, customerId, email, plan, userSeatCount, periodStart, periodEnd } = params;
  const keygenApiUrl = KEYGEN_API_URL;
  const keygenPolicyId = KEYGEN_POLICY_ID;

  // Build the license key JSON (all values lowercase)
  const licenseKeyData = {
    iss: 'pgconsole/license',
    sub: customerId,
    aud: 'pgconsole-prod',
    iat: periodStart,
    exp: periodEnd,
    plan: plan.toLowerCase(),
    userSeat: userSeatCount,
    email: email.toLowerCase(),
  };

  const expiryDate = new Date(periodEnd * 1000).toISOString();

  const response = await fetch(`${keygenApiUrl}/licenses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.KEYGEN_API_KEY}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'licenses',
        attributes: {
          key: JSON.stringify(licenseKeyData),
          expiry: expiryDate,
        },
        relationships: {
          policy: {
            data: { type: 'policies', id: keygenPolicyId },
          },
          user: {
            data: { type: 'users', id: userId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to create Keygen license: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.data.attributes.key;
}

// Generate license via Keygen
async function generateLicense(result, env) {
  if (!env.KEYGEN_API_KEY) {
    throw new Error('Missing KEYGEN_API_KEY');
  }

  // Upsert user
  const user = await upsertKeygenUser(
    {
      email: result.customerEmail,
      customerId: result.customerId,
      customerFirstName: result.customerFirstName,
      customerLastName: result.customerLastName,
      customerCountry: result.customerCountry,
    },
    env
  );

  // Create license
  const licenseKey = await createKeygenLicense(
    {
      userId: user.id,
      customerId: result.customerId,
      email: result.customerEmail,
      plan: result.planName,
      userSeatCount: result.userSeatCount,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
    },
    env
  );

  return licenseKey;
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

async function sendLicenseEmail(result, env) {
  const prefix = result.mode === 'test' ? '[test] ' : '';

  if (!env.RESEND_API_KEY) {
    console.log(`${prefix}Email skipped: Missing RESEND_API_KEY`);
    return;
  }

  const variables = {
    plan: result.planName,
    license_key: result.licenseKey,
    user_seat: String(result.userSeatCount),
    issue_date: formatDate(result.periodStart),
    expire_date: formatDate(result.periodEnd),
  };
  if (result.customerFirstName) {
    variables.customer_name = result.customerFirstName;
  }

  const payload = {
    to: [result.customerEmail],
    template: {
      id: 'send-license',
      variables,
    },
  };

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`${prefix}Email sent to ${result.customerEmail}:`, data.id);
    } else {
      console.log(`${prefix}Email failed:`, JSON.stringify(data));
    }
  } catch (error) {
    console.log(`${prefix}Email error:`, error.message);
  }
}
