import React from 'react';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DemoWizardHelpModal: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <Modal isOpen={open} onClose={onClose} panelClassName="bg-gray-850 bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl p-0 border border-gray-700">
      <div className="text-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Demo Mode vs Wizard Mode</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-5 space-y-4 text-sm text-gray-300">
          <div>
            <span className="inline-block px-2 py-0.5 text-xs rounded bg-blue-600 text-white mr-2">Demo Mode</span>
            lets you explore the editor with placeholder content and no API usage.
          </div>
          <ul className="list-disc ml-5 space-y-1">
            <li>Generate buttons are disabled to avoid costs.</li>
            <li>Click <strong>Upgrade Demo → Real Project</strong> to create a real project and enable generation.</li>
            <li>After upgrade, you can generate story, images, and render/polish a real video.</li>
          </ul>

          <div className="pt-2">
            <span className="inline-block px-2 py-0.5 text-xs rounded bg-amber-600 text-white mr-2">Wizard Mode</span>
            provides step-by-step control over the pipeline with visibility and logs.
          </div>
          <ul className="list-disc ml-5 space-y-1">
            <li>Run steps individually or use <strong>Run All</strong> to execute the full pipeline.</li>
            <li>See estimated time and open <strong>Logs</strong> for each service when needed.</li>
            <li>Resume previous sessions when returning to the wizard.</li>
          </ul>

          <div className="pt-2">
            <span className="inline-block px-2 py-0.5 text-xs rounded bg-purple-600 text-white mr-2">Tips</span>
            for great results:
          </div>
          <ul className="list-disc ml-5 space-y-1">
            <li>Use 1–3 Character Passport images (frontal, good lighting) for consistency.</li>
            <li>Try style presets (Ghibli, Noir, Pixel Art) to rapidly explore looks.</li>
            <li>Draft mode (3 frames) is fast; Final mode (5 frames) increases quality.</li>
          </ul>
        </div>
        <div className="px-5 py-4 border-t border-gray-800 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default DemoWizardHelpModal;

