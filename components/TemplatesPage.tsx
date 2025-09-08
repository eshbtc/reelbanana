import React, { useState, useEffect } from 'react';
import { TEMPLATES } from '../lib/templates';
import { DocumentAddIcon, SparklesIcon } from './Icon';

interface TemplatesPageProps {
  onNavigate: (view: string) => void;
  onLoadTemplate: (templateId: string) => void;
}

const TemplatesPage: React.FC<TemplatesPageProps> = ({ onNavigate, onLoadTemplate }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  // Load custom templates from localStorage
  useEffect(() => {
    const savedTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    setCustomTemplates(savedTemplates);
  }, []);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const handleStartWithTemplate = () => {
    if (selectedTemplate) {
      console.log('🎬 Starting with template:', selectedTemplate);
      
      // Check if it's a custom template
      const customTemplate = customTemplates.find(t => t.id === selectedTemplate);
      if (customTemplate) {
        // Store custom template data for loading
        window.templateToLoad = customTemplate;
      }
      
      onLoadTemplate(selectedTemplate);
      onNavigate('editor');
    }
  };

  const handleStartFromScratch = () => {
    console.log('🎬 Starting from scratch');
    onNavigate('editor');
  };

  const getTemplateIcon = (templateId: string) => {
    switch (templateId) {
      case 'superhero-banana':
        return '🦸‍♂️';
      case 'space-banana-odyssey':
        return '🚀';
      case 'banana-heist':
        return '🕵️‍♂️';
      default:
        return '🍌';
    }
  };

  const getTemplateGradient = (templateId: string) => {
    switch (templateId) {
      case 'superhero-banana':
        return 'from-blue-500 to-purple-600';
      case 'space-banana-odyssey':
        return 'from-indigo-500 to-cyan-600';
      case 'banana-heist':
        return 'from-orange-500 to-red-600';
      default:
        return 'from-amber-500 to-orange-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-16">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-4">
              Create Your Story
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto px-4">
              Choose from our curated templates or start with a blank canvas. 
              Let AI bring your vision to life.
            </p>
          </div>

          {/* Start from Scratch - Hero Card */}
          <div className="max-w-2xl mx-auto mb-8 md:mb-16">
            <div 
              className="group relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-4 md:p-8 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/25"
              onClick={handleStartFromScratch}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <SparklesIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Start from Scratch</h3>
                  <p className="text-gray-300 text-sm md:text-lg">Create a completely original story with AI assistance</p>
                </div>
                <div className="text-amber-400 text-xl md:text-2xl group-hover:translate-x-2 transition-transform hidden sm:block">→</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-16">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Or Choose a Template</h2>
          <p className="text-gray-400 text-base md:text-lg">Pre-crafted stories to get you started</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Built-in Templates */}
          {TEMPLATES.map((template) => (
            <div
              key={template.id}
              className={`group relative bg-gray-800/50 backdrop-blur-sm border rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                selectedTemplate === template.id
                  ? 'border-amber-500 bg-amber-500/10 shadow-amber-500/25'
                  : 'border-gray-700 hover:border-gray-600 hover:shadow-gray-500/10'
              }`}
              onClick={() => handleSelectTemplate(template.id)}
            >
              {/* Template Icon */}
              <div className={`w-12 h-12 bg-gradient-to-r ${getTemplateGradient(template.id)} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                <span className="text-2xl">{getTemplateIcon(template.id)}</span>
              </div>

              {/* Template Content */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                  {template.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {template.topic}
                </p>
              </div>

              {/* Template Stats */}
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {template.scenes.length} scenes
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  ~{template.scenes.length * 3}s duration
                </span>
              </div>

              {/* Scene Preview */}
              {selectedTemplate === template.id && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-semibold text-amber-400 mb-3">Scene Preview:</h4>
                  <div className="space-y-2">
                    {template.scenes.slice(0, 2).map((scene, index) => (
                      <div key={index} className="text-xs text-gray-300 bg-gray-700/50 rounded-lg p-2">
                        <span className="text-amber-400 font-medium">{index + 1}.</span> {scene.prompt}
                      </div>
                    ))}
                    {template.scenes.length > 2 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{template.scenes.length - 2} more scenes...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Selection Indicator */}
              {selectedTemplate === template.id && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Custom Templates Section */}
        {customTemplates.length > 0 && (
          <div className="mt-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Your Custom Templates</h2>
              <p className="text-gray-400 text-lg">Templates you've created and saved</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {customTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`group relative bg-gray-800/50 backdrop-blur-sm border rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                    selectedTemplate === template.id
                      ? 'border-purple-500 bg-purple-500/10 shadow-purple-500/25'
                      : 'border-gray-700 hover:border-gray-600 hover:shadow-gray-500/10'
                  }`}
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  {/* Custom Template Icon */}
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <span className="text-2xl">⭐</span>
                  </div>

                  {/* Template Content */}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                      {template.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {template.topic}
                    </p>
                  </div>

                  {/* Template Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      {template.scenes.length} scenes
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                      Custom
                    </span>
                  </div>

                  {/* Scene Preview */}
                  {selectedTemplate === template.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <h4 className="text-sm font-semibold text-purple-400 mb-3">Scene Preview:</h4>
                      <div className="space-y-2">
                        {template.scenes.slice(0, 2).map((scene: any, index: number) => (
                          <div key={index} className="text-xs text-gray-300 bg-gray-700/50 rounded-lg p-2">
                            <span className="text-purple-400 font-medium">{index + 1}.</span> {scene.prompt}
                          </div>
                        ))}
                        {template.scenes.length > 2 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{template.scenes.length - 2} more scenes...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Selection Indicator */}
                  {selectedTemplate === template.id && (
                    <div className="absolute top-4 right-4 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        {selectedTemplate && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={handleStartWithTemplate}
              className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-2xl transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-amber-500/25 hover:scale-105"
            >
              <DocumentAddIcon className="w-5 h-5" />
              Start with Selected Template
              <div className="group-hover:translate-x-1 transition-transform">→</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesPage;
