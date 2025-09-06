import React from 'react';

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

const plans = [
  { name: 'Free', price: '$0', features: ['Draft (3 frames)', '480p render', 'Watermark', 'No Pro Polish'] },
  { name: 'Plus', price: '$9/mo', features: ['Final (5 frames)', '720p render', 'Upscale (basic)'] },
  { name: 'Pro', price: '$29/mo', features: ['1080p render', 'Pro Polish', 'Priority queue'] },
  { name: 'Studio', price: 'Contact', features: ['4K render', 'Team seats', 'API access'] },
];

const PricingModal: React.FC<PricingModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Pricing</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
          {plans.map((p) => (
            <div key={p.name} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-white font-semibold text-lg mb-1">{p.name}</div>
              <div className="text-amber-400 font-bold text-xl mb-3">{p.price}</div>
              <ul className="text-sm text-gray-300 space-y-1">
                {p.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <button className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 rounded">
                Upgrade
              </button>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6 text-xs text-gray-400">
          Billing is credit‑based. You can also bring your own provider keys (Fal, Google) on Pro/Studio.
        </div>
      </div>
    </div>
  );
};

export default PricingModal;

