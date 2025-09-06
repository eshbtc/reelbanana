import React from 'react';

const PricingPage: React.FC = () => {
  const plans = [
    { 
      name: 'Free', 
      price: '$0', 
      period: 'forever',
      popular: false,
      features: [
        'Draft (3 frames)',
        '480p render',
        'Watermark',
        'No Pro Polish',
        'Basic templates',
        'Community support'
      ],
      limitations: [
        'Limited to 3 scenes per story',
        'Standard quality output',
        'ReelBanana branding'
      ]
    },
    { 
      name: 'Plus', 
      price: '$9', 
      period: 'month',
      popular: true,
      features: [
        'Final (5 frames)',
        '720p render',
        'Upscale (basic)',
        'No watermark',
        'All templates',
        'Priority support',
        'Export to social media'
      ],
      limitations: []
    },
    { 
      name: 'Pro', 
      price: '$29', 
      period: 'month',
      popular: false,
      features: [
        '1080p render',
        'Pro Polish',
        'Priority queue',
        'Custom branding',
        'API access',
        'Advanced templates',
        'Email support',
        'Bring your own API keys'
      ],
      limitations: []
    },
    { 
      name: 'Studio', 
      price: 'Contact', 
      period: 'us',
      popular: false,
      features: [
        '4K render',
        'Team seats',
        'Full API access',
        'White-label solution',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
        'Enterprise security'
      ],
      limitations: []
    },
  ];

  const faqs = [
    {
      question: "How does credit-based billing work?",
      answer: "Each operation (story generation, image creation, video rendering) consumes credits. Free users get 10 credits to start, Plus users get 100 credits/month, Pro users get 500 credits/month, and Studio users get unlimited credits."
    },
    {
      question: "Can I bring my own API keys?",
      answer: "Yes! Pro and Studio users can use their own Google Gemini and Fal AI API keys to reduce costs and have more control over their usage."
    },
    {
      question: "What's the difference between Draft and Final?",
      answer: "Draft mode creates 3-frame stories for quick prototyping, while Final mode creates 5-frame stories for complete narratives. Plus and above plans include Final mode."
    },
    {
      question: "What is Pro Polish?",
      answer: "Pro Polish uses advanced AI upscaling and interpolation to enhance your videos with better quality, smoother motion, and professional-grade output."
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll retain access to your current plan features until the end of your billing period."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, contact our support team for a full refund."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pricing</h1>
            <p className="text-gray-400 mt-1">Choose the perfect plan for your storytelling needs</p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors duration-200"
          >
            ← Back to Home
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Start free and scale as you grow. All plans include our core AI storytelling features with no hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={`relative bg-gray-800 rounded-xl border-2 p-6 ${
                plan.popular 
                  ? 'border-amber-500 ring-2 ring-amber-500/20' 
                  : 'border-gray-700 hover:border-gray-600'
              } transition-all duration-200`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-amber-500 text-black px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-amber-400">{plan.price}</span>
                  {plan.period !== 'us' && (
                    <span className="text-gray-400 ml-1">/{plan.period}</span>
                  )}
                </div>
                {plan.period === 'us' && (
                  <p className="text-sm text-gray-400">Custom pricing</p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-amber-400 mr-2 mt-0.5">✓</span>
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
                {plan.limitations.map((limitation, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-500 mr-2 mt-0.5">•</span>
                    <span className="text-gray-500 text-sm">{limitation}</span>
                  </li>
                ))}
              </ul>

              <button 
                className={`w-full py-3 rounded-lg font-medium transition-colors duration-200 ${
                  plan.popular
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : plan.name === 'Free'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
                onClick={() => {
                  if (plan.name === 'Studio') {
                    // Contact sales
                    window.open('mailto:sales@reelbanana.ai?subject=Studio Plan Inquiry', '_blank');
                  } else {
                    // Handle upgrade
                    console.log(`Upgrade to ${plan.name}`);
                  }
                }}
              >
                {plan.name === 'Free' ? 'Get Started' : 
                 plan.name === 'Studio' ? 'Contact Sales' : 
                 'Upgrade Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-16">
          <h3 className="text-xl font-bold mb-4">Billing & Credits</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-amber-400 mb-2">Credit-Based System</h4>
              <p className="text-gray-300 text-sm mb-3">
                Each operation consumes credits based on complexity. Story generation uses 1 credit, 
                image creation uses 1 credit per image, and video rendering uses 2-5 credits depending on quality.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-amber-400 mb-2">Bring Your Own Keys</h4>
              <p className="text-gray-300 text-sm mb-3">
                Pro and Studio users can use their own Google Gemini and Fal AI API keys to reduce costs 
                and have more control over their AI model usage.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h3>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="font-medium text-white mb-2">{faq.question}</h4>
                <p className="text-gray-300 text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-xl p-8 border border-amber-500/30">
          <h3 className="text-2xl font-bold mb-4">Ready to Start Creating?</h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Join thousands of creators who are already using ReelBanana to bring their stories to life. 
            Start free and upgrade when you're ready for more features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.location.href = '/'}
              className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Start Creating Free
            </button>
            <button
              onClick={() => window.open('mailto:support@reelbanana.ai', '_blank')}
              className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
