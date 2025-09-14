# ReelBanana Animation Specifications
*Precise Timing and Easing for Figma Prototyping & React Native Implementation*

---

## 🎯 **Core Animation Principles**

### **Apple's Physics-Based Motion**
- **Spring Physics**: Natural, organic movement
- **Instant Response**: Touch feedback within 16ms
- **Contextual Duration**: Faster for micro-interactions, slower for page transitions
- **Meaningful Motion**: Every animation serves a purpose

---

## ⚡ **Interaction Animations**

### **1. Touch Feedback (Universal)**
```typescript
// Figma: Smart Animate between component variants
// React Native: Animated.spring()

Duration: 150ms
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275) // Spring bounce
Scale: 1.0 → 0.98 → 1.0
Haptic: Light impact (50ms)

// Figma Prototype Settings:
Trigger: On Tap
Animation: Smart Animate
Duration: 150ms
Easing: Spring (Custom: 0.175, 0.885, 0.32, 1.275)
```

### **2. Button States**
```typescript
// Default → Hover (trackpad/mouse only)
Duration: 300ms
Easing: cubic-bezier(0.4, 0, 0.2, 1) // Standard iOS
Transform: translateY(0 → -1px)
Shadow: 0 8px 24px → 0 12px 32px
Background: rgba(255,255,255,0.04) → rgba(255,255,255,0.08)

// Default → Pressed (touch)
Duration: 150ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) // Custom glass
Scale: 1.0 → 0.98
Background: rgba(255,255,255,0.04) → rgba(255,255,255,0.06)

// Pressed → Released
Duration: 200ms
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275) // Spring back
Scale: 0.98 → 1.0
```

### **3. Specular Highlight (Premium Feel)**
```typescript
// Moving light reflection across glass surfaces
Duration: 800ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Transform: translateX(-100% → 100%)
Opacity: 0 → 0.1 → 0
Trigger: On hover or significant interaction

// Figma Implementation:
1. Create highlight overlay (white, 0.1 opacity)
2. Mask with 45° gradient
3. Animate position from left to right
4. Use "Move In" + "Move Out" for smooth transition
```

---

## 🔄 **Page Transitions**

### **1. Screen Navigation**
```typescript
// Forward Navigation (Create → Photo Selection)
Duration: 300ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Transform: translateX(0 → -30%), opacity(1 → 0.8) // Current screen
Transform: translateX(100% → 0%) // New screen
Blur: Apply 8px blur to outgoing screen

// Back Navigation (swipe from left edge)
Duration: 300ms
Easing: cubic-bezier(0, 0, 0.2, 1) // Decelerate
Transform: translateX(0 → 100%) // Current screen
Transform: translateX(-30% → 0%) // Previous screen
```

### **2. Modal Presentations**
```typescript
// Progress Studio Modal
Duration: 400ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Transform: scale(0.8 → 1.0), translateY(100% → 0%)
Background: opacity(0 → 0.5) // Backdrop
Blur: Apply 20px blur to background content

// Modal Dismissal
Duration: 300ms
Easing: cubic-bezier(0.4, 0, 1, 1) // Accelerate
Transform: scale(1.0 → 0.8), translateY(0% → 100%)
Background: opacity(0.5 → 0)
```

---

## 🎵 **Content Animations**

### **1. Photo Selection**
```typescript
// Photo Grid Appearance
Stagger: 50ms between items
Duration: 400ms per item
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275)
Transform: scale(0.8 → 1.0), opacity(0 → 1)
Origin: center

// Photo Selection
Duration: 200ms
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275)
Scale: 1.0 → 1.05
Border: opacity(0 → 1)
Checkmark: scale(0 → 1.2 → 1.0) with 100ms delay

// Photo Deselection
Duration: 150ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Scale: 1.05 → 1.0
Border: opacity(1 → 0)
Checkmark: scale(1.0 → 0)
```

### **2. Voice Recording**
```typescript
// Start Recording
Duration: 200ms
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275)
Scale: 1.0 → 1.1 → 1.05
Border: color change to red with pulse
Haptic: Medium impact

// Waveform Animation
Duration: Continuous while recording
Easing: ease-in-out
Bars: 8-12 vertical bars
Height: 4px → 32px (based on audio input)
Refresh: 60fps
Color: rgba(255, 255, 255, 0.8)

// Stop Recording
Duration: 300ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Scale: 1.05 → 1.0
Border: red → glass border
Waveform: fade out over 200ms
```

---

## 🎬 **Progress Animations**

### **1. Liquid Progress Bar**
```typescript
// Fill Animation
Duration: Based on actual progress (1-90 seconds)
Easing: linear for consistent speed
Fill: Liquid-like gradient moving left to right
Colors: rgba(255,255,255,0.1) → rgba(255,255,255,0.2)
Shimmer: Subtle highlight moves across filled area

// Stage Transitions
Duration: 500ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Previous stage: opacity(1 → 0.6), scale(1.0 → 0.95)
Current stage: opacity(0.6 → 1), scale(0.95 → 1.0)
Checkmark: scale(0 → 1.2 → 1.0) with green color
```

### **2. Music Visualization**
```typescript
// Music Playing Pulse
Duration: 2000ms
Easing: ease-in-out
Scale: 1.0 → 1.02 → 1.0
Blur: 24px → 28px → 24px
Repeat: infinite
Trigger: When music starts playing

// Audio Waveform Visualization
Duration: Continuous
Bars: 12-16 frequency bars
Height: 2-16px based on audio amplitude
Animation: Real-time response to music
Color: rgba(255, 255, 255, 0.6)
```

---

## 🎉 **Success Celebrations**

### **1. Reel Completion**
```typescript
// Victory Animation Sequence
Total Duration: 2000ms

// Phase 1: Scale Burst (0-400ms)
Scale: 0.8 → 1.2 → 1.0
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275)
Haptic: Heavy impact

// Phase 2: Particle Burst (200-800ms)
Particles: 8-12 white dots
Spawn: From center
Movement: Radial explosion
Scale: 0 → 1 → 0
Opacity: 0 → 1 → 0

// Phase 3: Content Reveal (600-1200ms)
Video preview: scale(0.9 → 1.0), opacity(0 → 1)
Share buttons: Staggered appearance (100ms between)
```

### **2. Share Success**
```typescript
// Platform Share Confirmation
Duration: 600ms
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275)

// Phase 1: Button Success (0-200ms)
Background: platform color fade in
Checkmark: scale(0 → 1.2 → 1.0)
Original icon: opacity(1 → 0)

// Phase 2: Credit Notification (300-600ms)
Credit badge: translateY(20px → 0), opacity(0 → 1)
Haptic: Success pattern
```

---

## 🔄 **Loading States**

### **1. Liquid Fill Loading**
```typescript
// For buttons and progress indicators
Duration: 2000ms
Easing: ease-in-out
Repeat: infinite
Pattern: Wave motion left to right
Gradient: 3-color gradient moving across element
Colors: [transparent, rgba(255,255,255,0.1), transparent]
```

### **2. Shimmer Loading**
```typescript
// For content placeholders
Duration: 1500ms
Easing: ease-in-out
Repeat: infinite
Transform: translateX(-100% → 200%)
Gradient: 45° angle, [transparent, white 0.1 opacity, transparent]
Width: 200% of container
```

### **3. Spinner (Fallback)**
```typescript
// For system operations
Duration: 1000ms
Easing: linear
Repeat: infinite
Transform: rotate(0deg → 360deg)
Size: 24px (small), 32px (medium), 40px (large)
```

---

## 📱 **Gesture Animations**

### **1. Pull to Refresh**
```typescript
// Pull Distance: 80px trigger threshold
// Elastic resistance beyond threshold

// Pull Phase (0-80px)
Duration: Follows finger
Resistance: Linear
Indicator: Scale grows with pull distance

// Release Animation
Duration: 400ms
Easing: cubic-bezier(0.175, 0.885, 0.32, 1.275)
Indicator: Rotate 360° while loading
Content: Elastic snap back to position
```

### **2. Swipe Gestures**
```typescript
// Photo Gallery Swipe
Threshold: 30% of screen width
Velocity threshold: 1000px/s

// During swipe
Duration: Follows finger
Transform: translateX based on finger position
Opacity: Fade out swiped item
Scale: Slightly shrink (0.95) while swiping

// Commit animation
Duration: 200ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
Transform: Complete the swipe motion
Next item: Slide in from opposite side
```

---

## 🎨 **Figma Prototyping Setup**

### **Component Variants for Animation**
```figma
Create these variants for each interactive component:
- Default
- Hover (if applicable)
- Pressed
- Loading
- Success
- Error

Connection Settings:
- Trigger: On Tap, On Hover, etc.
- Animation: Smart Animate
- Duration: Use exact values from specs above
- Easing: Custom bezier curves
```

### **Shared Animation Styles**
```figma
Create these as reusable animation presets:
- "Touch Feedback" (150ms spring)
- "Page Transition" (300ms ease-out)
- "Success Celebration" (600ms spring)
- "Loading State" (2s infinite)
- "Hover Response" (300ms ease)
```

### **Timeline Animations**
```figma
For complex sequences:
1. Use timeline view for multi-step animations
2. Stagger timing for elements appearing in sequence
3. Add sound effects for haptic feedback simulation
4. Use video export for developer reference
```

---

## 🔧 **React Native Implementation**

### **Animation Libraries**
```typescript
// Required dependencies
import { Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

// Pre-configured easing curves
export const Easing = {
  spring: Easing.bezier(0.175, 0.885, 0.32, 1.275),
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  accelerate: Easing.bezier(0.4, 0, 1, 1),
  glass: Easing.bezier(0.25, 0.46, 0.45, 0.94),
};
```

### **Performance Guidelines**
```typescript
// Use native driver when possible
useNativeDriver: true // For transform and opacity only

// Avoid layout animations on:
- width/height changes
- padding/margin changes
- position changes

// Optimize with:
- Pre-calculate animation values
- Use worklets for complex timing
- Limit simultaneous animations to <5
- Remove listeners on unmount
```

This animation specification gives your UI/UX lead precise timing and easing for creating buttery-smooth prototypes that perfectly match the final React Native implementation! 🎬✨