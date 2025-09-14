# ReelBanana Component Library Specification
*Figma Components with Exact React Native Implementation Mapping*

---

## 🎯 **Core Components for Figma Library**

### **1. LiquidGlassButton**
*Primary interactive element with Apple's Liquid Glass material*

#### **Figma Component Setup**
```
Component Name: LiquidGlass/Button
Variants: 
- State: Default, Hover, Pressed, Loading, Disabled
- Size: Small (40px), Medium (48px), Large (56px), Hero (64px)
- Variant: Regular, Primary (tinted)
```

#### **State Specifications**
```typescript
// Default State
{
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 16,
  shadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
  scale: 1.0,
}

// Hover State (trackpad/mouse)
{
  background: 'rgba(255, 255, 255, 0.08)',
  transform: 'translateY(-1px)',
  shadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
  // Add specular highlight overlay
}

// Pressed State (touch)
{
  background: 'rgba(255, 255, 255, 0.06)',
  scale: 0.98,
  transform: 'translateY(0)',
  shadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
}

// Loading State
{
  opacity: 0.7,
  // Add liquid fill animation from left to right
  // Duration: 2s infinite
}

// Disabled State
{
  opacity: 0.4,
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid rgba(255, 255, 255, 0.04)',
}

// Primary Variant (tinted)
{
  background: 'rgba(0, 122, 255, 0.08)', // Apple Blue
  border: '1px solid rgba(0, 122, 255, 0.2)',
}
```

#### **React Native Mapping**
```typescript
// Exact implementation for developers
const LiquidGlassButton = ({ 
  size = 'medium',
  variant = 'regular',
  state = 'default',
  children 
}) => {
  const buttonStyle = getButtonStyle(size, variant, state);
  return (
    <LiquidGlass 
      variant={variant === 'primary' ? 'regular' : 'regular'}
      interactive
      style={[styles.button, buttonStyle]}
    >
      {children}
    </LiquidGlass>
  );
};
```

---

### **2. PhotoBubble**
*Photo selection component with glass overlay*

#### **Figma Component Setup**
```
Component Name: Photo/Bubble
Variants:
- State: Unselected, Selected, Loading
- Size: Small (80px), Medium (120px), Large (160px)
- AspectRatio: Square (1:1)
```

#### **State Specifications**
```typescript
// Unselected State
{
  background: 'Clear glass variant over photo',
  borderRadius: 16,
  scale: 1.0,
  overlay: 'none',
}

// Selected State  
{
  background: 'Regular glass variant',
  borderRadius: 16,
  scale: 1.05,
  overlay: {
    checkmark: '✓',
    position: 'top-right 8px',
    background: 'rgba(34, 197, 94, 0.9)',
    size: '24x24px',
    borderRadius: 12,
  }
}

// Loading State
{
  opacity: 0.6,
  overlay: {
    spinner: 'Loading animation',
    position: 'center',
    size: '32x32px',
  }
}
```

#### **Photo Content Guidelines**
```figma
// In Figma, use these as placeholder images:
- Portrait photos for face detection examples
- Landscape photos for scene examples  
- Food photos for lifestyle examples
- Travel photos for adventure examples

// Ensure photos have sufficient contrast for glass overlays
```

---

### **3. ProgressStudio**
*Real-time progress container with music visualization*

#### **Figma Component Setup**
```
Component Name: Progress/Studio
Variants:
- State: Idle, Processing, MusicPlaying, Complete, Error
- Layout: Compact, Full
```

#### **State Specifications**
```typescript
// Idle State
{
  background: 'Regular glass variant',
  borderRadius: 24,
  padding: 24,
  content: 'Ready to create...',
}

// Processing State
{
  background: 'Regular glass variant',
  progressBar: {
    background: 'Linear gradient fill',
    height: 8,
    borderRadius: 4,
    animation: 'Liquid fill left-to-right',
  },
  eta: 'Display remaining time',
}

// Music Playing State
{
  background: 'Regular glass variant with subtle pulse',
  animation: {
    scale: '1.0 to 1.02',
    duration: '2s',
    easing: 'ease-in-out',
    repeat: 'infinite',
  },
  musicVisualizer: {
    waveform: 'Animated bars',
    position: 'bottom of container',
  }
}

// Complete State
{
  background: 'Regular glass variant',
  celebration: {
    particles: 'Burst effect',
    checkmark: 'Large green checkmark',
    animation: 'Scale in with bounce',
  }
}

// Error State
{
  background: 'Regular glass variant',
  border: '1px solid rgba(255, 59, 48, 0.3)', // Apple Red
  errorIcon: 'Warning triangle',
  shake: 'Subtle shake animation',
}
```

---

### **4. VoiceRecorder**
*Voice input component with waveform visualization*

#### **Figma Component Setup**
```
Component Name: Voice/Recorder
Variants:
- State: Idle, Recording, Processing, Complete
- Layout: Compact, Expanded
```

#### **State Specifications**
```typescript
// Idle State
{
  background: 'Regular glass variant',
  borderRadius: 20,
  icon: 'Microphone icon',
  text: 'Hold to record',
  pulse: 'Subtle breathing animation',
}

// Recording State
{
  background: 'Regular glass variant with red tint',
  border: '2px solid rgba(255, 59, 48, 0.3)',
  icon: 'Recording dot (pulsing)',
  waveform: {
    bars: '8-12 animated bars',
    height: '4-32px range',
    animation: 'Real-time audio visualization',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timer: 'Recording duration',
}

// Processing State
{
  background: 'Regular glass variant',
  icon: 'Loading spinner',
  text: 'Processing voice...',
  animation: 'Spinner rotation',
}

// Complete State
{
  background: 'Regular glass variant',
  icon: 'Checkmark',
  text: 'Voice captured',
  preview: 'Play button for playback',
}
```

---

### **5. ShareButton**
*Platform-specific sharing components*

#### **Figma Component Setup**
```
Component Name: Share/Platform
Variants:
- Platform: TikTok, Instagram, YouTube, Twitter, More
- State: Default, Pressed, Success
- Credits: Show, Hide
```

#### **Platform Specifications**
```typescript
// TikTok Variant
{
  background: 'Regular glass variant',
  icon: 'TikTok logo (black)',
  label: 'TikTok',
  credits: '+5 credits',
  accent: 'rgba(0, 0, 0, 0.1)',
}

// Instagram Variant  
{
  background: 'Regular glass variant',
  icon: 'Instagram logo (gradient)',
  label: 'Instagram',
  credits: '+5 credits',
  accent: 'rgba(225, 48, 108, 0.1)',
}

// YouTube Variant
{
  background: 'Regular glass variant', 
  icon: 'YouTube logo (red)',
  label: 'YouTube',
  credits: '+3 credits',
  accent: 'rgba(255, 0, 0, 0.1)',
}

// Success State (all platforms)
{
  background: 'Regular glass variant',
  checkmark: 'Green checkmark overlay',
  animation: 'Scale bounce',
  feedback: 'Shared successfully!',
}
```

---

### **6. Navigation Elements**

#### **TabBar**
```typescript
// Figma Component: Navigation/TabBar
{
  background: 'Regular glass variant',
  borderRadius: '24px top corners',
  position: 'Bottom safe area',
  tabs: [
    { icon: 'Home', label: 'Create' },
    { icon: 'Grid', label: 'Gallery' },
    { icon: 'Profile', label: 'Profile' }
  ],
  selectedState: {
    background: 'rgba(0, 122, 255, 0.1)',
    icon: 'Filled variant',
  }
}
```

#### **BackButton**
```typescript
// Figma Component: Navigation/Back
{
  background: 'Regular glass variant',
  size: '44x44px', // Apple minimum touch target
  borderRadius: 22,
  icon: 'Chevron left',
  position: 'Top-left safe area + 16px',
}
```

---

### **7. Content Containers**

#### **SceneCard**
```typescript
// Figma Component: Content/SceneCard
// CRITICAL: Content layer - NO glass background
{
  background: 'Transparent',
  borderRadius: 16,
  border: '1px solid rgba(255, 255, 255, 0.1)',
  content: {
    image: 'Generated scene image',
    text: 'Scene description',
    controls: 'Edit/regenerate buttons (with glass)',
  }
}
```

---

## 🎨 **Figma Implementation Guidelines**

### **Layer Structure**
```figma
Component Structure:
├── Background (Glass effect simulation)
├── Border (Stroke with glass border color)
├── Content Layer
│   ├── Icons/Text
│   └── Interactive Elements
└── Overlay Effects
    ├── Specular Highlight (for hover)
    └── Selection Indicators
```

### **Glass Effect Simulation**
```figma
// Since Figma can't do real blur, simulate with:
1. Background fill: rgba(255, 255, 255, 0.04)
2. Inner shadow: 0 1px 0 rgba(255, 255, 255, 0.1)
3. Drop shadow: 0 8px 24px rgba(0, 0, 0, 0.06)
4. Stroke: 1px rgba(255, 255, 255, 0.08)

// Add note: "Real blur effect will be applied in React Native"
```

### **Auto Layout Settings**
```figma
// For responsive components:
- Padding: 16px horizontal, 12px vertical (minimum)
- Gap: 8px between elements
- Resizing: Fill container width, Hug contents height
- Alignment: Center (for buttons), Top-left (for cards)
```

### **Component Properties**
```figma
// Expose these as Figma component properties:
- Text content (for labels)
- Icon selection (for platform buttons)
- State (for all interactive elements)
- Size (for scalable components)
- Variant (for glass types)
```

---

## 🔧 **Developer Handoff Notes**

### **Critical Implementation Details**
```typescript
// For each Figma component, include these specs:

1. Exact React Native component mapping
2. BlurView configuration (blurType, blurAmount)
3. Animation timing and easing curves
4. Haptic feedback patterns
5. Accessibility labels and hints
6. Platform-specific considerations
```

### **Assets Export**
```figma
// Export requirements:
- Icons: SVG format, 24x24px base size
- Images: 3x resolution for iOS, 2x for Android
- Animations: Lottie files for complex animations
- Colors: Exact rgba values in style guide
```

This component library spec gives your UI/UX lead everything they need to create pixel-perfect, implementation-ready Figma components that map directly to the React Native code! 🎯