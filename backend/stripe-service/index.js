// Stripe service for subscription management
const express = require('express');
const cors = require('cors');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const Stripe = require('stripe');
const admin = require('firebase-admin');
const { createHealthEndpoints } = require('./shared/healthCheck');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const secretClient = new SecretManagerServiceClient();

// Stripe configuration
let stripe = null;
let stripePublishableKey = null;

// Initialize Stripe with secret key from Google Cloud Secrets
async function initializeStripe() {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'reel-banana-35a54';
    const isProduction = process.env.NODE_ENV === 'production';
    
    const secretName = isProduction ? 'stripe-live-secret-key' : 'stripe-test-secret-key';
    const publishableSecretName = isProduction ? 'stripe-live-publishable-key' : 'stripe-test-publishable-key';
    
    // Get secret key
    const [secretVersion] = await secretClient.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });
    const secretKey = secretVersion.payload.data.toString();
    
    // Get publishable key
    const [publishableVersion] = await secretClient.accessSecretVersion({
      name: `projects/${projectId}/secrets/${publishableSecretName}/versions/latest`,
    });
    stripePublishableKey = publishableVersion.payload.data.toString();
    
    stripe = new Stripe(secretKey);
    global.stripe = stripe; // Set global for health check
    console.log('Stripe initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

// Initialize Stripe on startup
initializeStripe();

// Health check endpoints
createHealthEndpoints(app, 'stripe-service');

// Middleware to verify Firebase App Check
const appCheckVerification = async (req, res, next) => {
  try {
    const appCheckToken = req.header('X-Firebase-AppCheck');
    if (!appCheckToken) {
      return res.status(401).json({ error: 'Missing App Check token' });
    }
    
    const decodedToken = await admin.appCheck().verifyToken(appCheckToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('App Check verification failed:', error);
    return res.status(401).json({ error: 'Invalid App Check token' });
  }
};

// Helper function to get user from Firebase ID token
const getUserFromToken = async (req) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Failed to verify ID token:', error);
    throw new Error('Invalid authentication token');
  }
};

// GET /config - Get Stripe publishable key and subscription plans
app.get('/config', appCheckVerification, async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        interval: 'month',
        features: [
          '50 free credits',
          '480p render',
          'Basic templates',
          'Watermark'
        ],
        limits: {
          dailyRenders: 5,
          maxScenes: 3,
          resolution: '480p'
        }
      },
      {
        id: 'plus',
        name: 'Plus',
        price: 9,
        interval: 'month',
        features: [
          '500 credits/month',
          '720p render',
          'All templates',
          'No watermark',
          'Priority support'
        ],
        limits: {
          dailyRenders: 50,
          maxScenes: 8,
          resolution: '720p'
        }
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 29,
        interval: 'month',
        features: [
          '2000 credits/month',
          '1080p render',
          'Pro Polish',
          'Custom branding',
          'API access',
          'BYO API keys'
        ],
        limits: {
          dailyRenders: 200,
          maxScenes: 15,
          resolution: '1080p'
        }
      }
    ];

    res.json({
      publishableKey: stripePublishableKey,
      plans
    });
  } catch (error) {
    console.error('Failed to get config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// POST /create-customer - Create Stripe customer
app.post('/create-customer', appCheckVerification, async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    const { email, name } = req.body;

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not initialized' });
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: email || user.email,
      name: name || user.name,
      metadata: {
        firebase_uid: user.uid
      }
    });

    // Update user document with Stripe customer ID
    await db.collection('users').doc(user.uid).update({
      stripeCustomerId: customer.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ customerId: customer.id });
  } catch (error) {
    console.error('Failed to create customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// POST /create-subscription - Create subscription
app.post('/create-subscription', appCheckVerification, async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    const { priceId, paymentMethodId } = req.body;

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not initialized' });
    }

    // Get or create customer
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    let customerId = userData?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { firebase_uid: user.uid }
      });
      customerId = customer.id;
      
      await db.collection('users').doc(user.uid).update({
        stripeCustomerId: customerId
      });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    console.error('Failed to create subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// POST /webhook - Handle Stripe webhooks
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Handle subscription changes
async function handleSubscriptionChange(subscription) {
  const customerId = subscription.customer;
  const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
  
  if (userQuery.empty) {
    console.error('No user found for customer:', customerId);
    return;
  }

  const userDoc = userQuery.docs[0];
  const planId = subscription.items.data[0].price.id;
  
  await userDoc.ref.update({
    subscription: {
      id: subscription.id,
      status: subscription.status,
      planId: planId,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  console.log(`Updated subscription for user ${userDoc.id}: ${subscription.status}`);
}

// Handle subscription cancellation
async function handleSubscriptionCancellation(subscription) {
  const customerId = subscription.customer;
  const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
  
  if (userQuery.empty) {
    console.error('No user found for customer:', customerId);
    return;
  }

  const userDoc = userQuery.docs[0];
  
  await userDoc.ref.update({
    subscription: {
      id: subscription.id,
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  console.log(`Canceled subscription for user ${userDoc.id}`);
}

// Handle successful payment
async function handlePaymentSuccess(invoice) {
  const customerId = invoice.customer;
  const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
  
  if (userQuery.empty) {
    console.error('No user found for customer:', customerId);
    return;
  }

  const userDoc = userQuery.docs[0];
  
  // Add credits based on plan
  const planId = invoice.subscription_items?.data[0]?.price?.id;
  const creditsToAdd = getCreditsForPlan(planId);
  
  if (creditsToAdd > 0) {
    await userDoc.ref.update({
      freeCredits: admin.firestore.FieldValue.increment(creditsToAdd),
      lastPaymentAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Added ${creditsToAdd} credits for user ${userDoc.id}`);
  }
}

// Handle payment failure
async function handlePaymentFailure(invoice) {
  const customerId = invoice.customer;
  const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
  
  if (userQuery.empty) {
    console.error('No user found for customer:', customerId);
    return;
  }

  const userDoc = userQuery.docs[0];
  
  await userDoc.ref.update({
    'subscription.status': 'past_due',
    lastPaymentFailureAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Payment failed for user ${userDoc.id}`);
}

// Get credits for plan
function getCreditsForPlan(planId) {
  const creditMap = {
    'price_plus': 500,
    'price_pro': 2000,
    'price_studio': 10000
  };
  return creditMap[planId] || 0;
}

// POST /purchase-credits - Purchase credits directly
app.post('/purchase-credits', appCheckVerification, async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    const { packageId, paymentMethodId } = req.body;

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not initialized' });
    }

    // Credit package mapping
    const creditPackages = {
      'starter': { credits: 100, price: 1000 }, // $10.00 in cents
      'creator': { credits: 500, price: 4000 }, // $40.00 in cents
      'pro': { credits: 1000, price: 7000 },    // $70.00 in cents
      'studio': { credits: 5000, price: 30000 } // $300.00 in cents
    };

    const packageData = creditPackages[packageId];
    if (!packageData) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    // Get or create customer
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    let customerId = userData?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { firebase_uid: user.uid }
      });
      customerId = customer.id;
      
      await db.collection('users').doc(user.uid).update({
        stripeCustomerId: customerId
      });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: packageData.price,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      metadata: {
        firebase_uid: user.uid,
        package_id: packageId,
        credits: packageData.credits.toString()
      }
    });

    if (paymentIntent.status === 'succeeded') {
      // Add credits to user
      await db.collection('users').doc(user.uid).update({
        freeCredits: admin.firestore.FieldValue.increment(packageData.credits),
        lastCreditPurchase: admin.firestore.FieldValue.serverTimestamp()
      });

      // Record transaction
      await db.collection('credit_transactions').add({
        userId: user.uid,
        type: 'purchase',
        amount: packageData.credits,
        description: `Purchased ${packageData.credits} credits`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          packageId,
          paymentIntentId: paymentIntent.id,
          amountPaid: packageData.price
        }
      });

      res.json({
        success: true,
        transactionId: paymentIntent.id,
        creditsAdded: packageData.credits
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment not completed',
        paymentIntent: paymentIntent
      });
    }
  } catch (error) {
    console.error('Failed to purchase credits:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to purchase credits' 
    });
  }
});

// GET /subscription-status - Get user's subscription status
app.get('/subscription-status', appCheckVerification, async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const subscription = userData.subscription || null;
    
    res.json({
      subscription,
      freeCredits: userData.freeCredits || 0,
      plan: subscription?.planId || 'free'
    });
  } catch (error) {
    console.error('Failed to get subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

const PORT = process.env.PORT || 8087;
app.listen(PORT, () => {
  console.log(`Stripe service running on port ${PORT}`);
});
