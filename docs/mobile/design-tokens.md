# ReelBanana Design Tokens
*Complete Design System Variables for Figma & React Native*

---

## 🎯 **Design Token Philosophy**

Design tokens are the visual design atoms of the design system — specifically named entities that store visual design attributes. They ensure consistency across platforms and make design updates scalable.

---

## 🎨 **Color Tokens**

### **Liquid Glass System**
```typescript
// Primary glass materials
export const GlassTokens = {
  regular: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.08)',
    shadow: 'rgba(0, 0, 0, 0.06)',
  },
  clear: {
    background: 'rgba(255, 255, 255, 0.01)',
    border: 'rgba(255, 255, 255, 0.04)',
    shadow: 'rgba(0, 0, 0, 0.04)',
  },
  // Dark mode adaptations
  dark: {
    regular: {
      background: 'rgba(255, 255, 255, 0.02)',
      border: 'rgba(255, 255, 255, 0.04)',
      shadow: 'rgba(0, 0, 0, 0.12)',
    },
    clear: {
      background: 'rgba(255, 255, 255, 0.005)',
      border: 'rgba(255, 255, 255, 0.02)',
      shadow: 'rgba(0, 0, 0, 0.08)',
    },
  },
};
```

### **System Colors (iOS/Android Adaptive)**
```typescript
export const SystemColors = {
  // Text colors (auto-adapt to light/dark mode)
  label: {
    primary: 'rgba(0, 0, 0, 1)', // iOS: label, Android: ?android:textColorPrimary
    secondary: 'rgba(60, 60, 67, 0.6)', // iOS: secondaryLabel
    tertiary: 'rgba(60, 60, 67, 0.3)', // iOS: tertiaryLabel
  },
  
  // Background colors
  background: {
    primary: 'rgba(255, 255, 255, 1)', // iOS: systemBackground
    secondary: 'rgba(242, 242, 247, 1)', // iOS: secondarySystemBackground
    elevated: 'rgba(255, 255, 255, 1)', // iOS: tertiarySystemBackground
  },
  
  // Separator colors
  separator: {
    primary: 'rgba(60, 60, 67, 0.29)', // iOS: separator
    opaque: 'rgba(198, 198, 200, 1)', // iOS: opaqueSeparator
  },
};
```

### **Semantic Colors**
```typescript
export const SemanticColors = {
  // Apple system colors
  blue: 'rgba(0, 122, 255, 1)', // iOS: systemBlue
  green: 'rgba(34, 197, 94, 1)', // Success states
  red: 'rgba(255, 59, 48, 1)', // Error states  
  orange: 'rgba(255, 149, 0, 1)', // Warning states
  yellow: 'rgba(255, 204, 0, 1)', // Attention states
  
  // Custom brand colors (use sparingly)
  accent: {
    primary: 'rgba(0, 122, 255, 0.1)', // Tinted glass
    secondary: 'rgba(34, 197, 94, 0.1)', // Success tint
    tertiary: 'rgba(255, 149, 0, 0.1)', // Warning tint
  },
};
```

---

## 📐 **Spacing Tokens**

### **Base Spacing Scale**
```typescript
export const Spacing = {
  // Base 4px scale
  xs: 4,    // 4px  - Tiny gaps, icon padding
  sm: 8,    // 8px  - Small gaps, compact layouts
  md: 16,   // 16px - Standard gaps, component padding
  lg: 24,   // 24px - Large gaps, section spacing
  xl: 32,   // 32px - Extra large gaps, page margins
  xxl: 48,  // 48px - Huge gaps, major sections
  
  // Semantic spacing
  component: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    margin: 16,
  },
  
  layout: {
    screenPadding: 16,
    sectionGap: 32,
    cardGap: 24,
    listItemGap: 8,
  },
  
  // Safe areas
  safeArea: {
    top: 44,    // iOS status bar height
    bottom: 34, // iOS home indicator
    sides: 16,  // Minimum edge padding
  },
};
```

### **Component-Specific Spacing**
```typescript
export const ComponentSpacing = {
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 44, // Apple minimum touch target
    gap: 8, // Between icon and text
  },
  
  card: {
    padding: 16,
    margin: 8,
    gap: 12,
  },
  
  list: {
    itemHeight: 60,
    itemPadding: 16,
    sectionHeader: 32,
    gap: 1, // iOS-style hairline
  },
  
  modal: {
    padding: 24,
    margin: 16,
    borderRadius: 24,
  },
};
```

---

## 🔤 **Typography Tokens**

### **Font Families**
```typescript
export const FontFamilies = {
  // iOS system fonts
  ios: {
    display: 'SF Pro Display',
    text: 'SF Pro Text',
    rounded: 'SF Pro Rounded',
    mono: 'SF Mono',
  },
  
  // Android system fonts  
  android: {
    display: 'Roboto',
    text: 'Roboto',
    condensed: 'Roboto Condensed',
    mono: 'Roboto Mono',
  },
  
  // React Native universal
  system: 'System', // Uses platform default
};
```

### **Font Scales**
```typescript
export const FontSizes = {
  // iOS Human Interface Guidelines scale
  caption2: 11,   // Very small text
  caption1: 12,   // Small text, metadata
  footnote: 13,   // Footnotes, secondary text
  subhead: 15,    // Secondary headings
  callout: 16,    // Emphasized body text
  body: 17,       // Default body text
  headline: 17,   // Bold body text
  title3: 20,     // Section titles
  title2: 22,     // Subsection titles
  title1: 28,     // Page titles
  largeTitle: 34, // Hero titles
  
  // Custom app-specific sizes
  hero: 40,       // App hero text
  display: 48,    // Large display text
};
```

### **Font Weights**
```typescript
export const FontWeights = {
  ultraLight: '100',
  thin: '200',
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
  black: '900',
  
  // Semantic weights
  body: '400',
  emphasis: '500',
  strong: '600',
  display: '700',
};
```

### **Line Heights**
```typescript
export const LineHeights = {
  // Calculated for optimal readability
  tight: 1.2,    // Display text, headings
  normal: 1.4,   // Body text
  relaxed: 1.6,  // Long-form reading
  loose: 1.8,    // Captions, metadata
  
  // Specific to font sizes
  caption: 16,   // 12px font → 16px line height
  body: 24,      // 17px font → 24px line height  
  title: 32,     // 28px font → 32px line height
  hero: 48,      // 40px font → 48px line height
};
```

### **Typography Styles**
```typescript
export const TextStyles = {
  // Primary text styles
  hero: {
    fontSize: FontSizes.hero,
    fontWeight: FontWeights.bold,
    lineHeight: LineHeights.hero,
    letterSpacing: -0.5,
  },
  
  title: {
    fontSize: FontSizes.title1,
    fontWeight: FontWeights.semibold,
    lineHeight: LineHeights.title,
    letterSpacing: -0.3,
  },
  
  body: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.regular,
    lineHeight: LineHeights.body,
    letterSpacing: 0,
  },
  
  caption: {
    fontSize: FontSizes.caption1,
    fontWeight: FontWeights.medium,
    lineHeight: LineHeights.caption,
    letterSpacing: 0.1,
  },
  
  // Interactive text
  button: {
    fontSize: FontSizes.callout,
    fontWeight: FontWeights.semibold,
    lineHeight: FontSizes.callout * 1.2,
    letterSpacing: 0.1,
  },
  
  // App-specific styles
  sceneTitle: {
    fontSize: FontSizes.title3,
    fontWeight: FontWeights.medium,
    lineHeight: LineHeights.normal,
  },
  
  progressLabel: {
    fontSize: FontSizes.subhead,
    fontWeight: FontWeights.medium,
    lineHeight: LineHeights.tight,
  },
};
```

---

## 🔲 **Border Radius Tokens**

### **Radius Scale**
```typescript
export const BorderRadius = {
  // Base scale
  none: 0,
  xs: 4,     // Small elements, tags
  sm: 8,     // Input fields, small buttons
  md: 12,    // Cards, medium elements
  lg: 16,    // Primary buttons, major cards
  xl: 20,    // Hero buttons, special elements
  xxl: 24,   // Modals, large containers
  round: 50, // Circular elements (use with equal width/height)
  
  // Component-specific
  button: {
    small: 8,
    medium: 12,
    large: 16,
    hero: 20,
  },
  
  card: {
    small: 12,
    medium: 16,
    large: 20,
  },
  
  modal: 24,
  sheet: 16, // Bottom sheets
  avatar: 50, // Profile images
};
```

---

## 🌘 **Shadow Tokens**

### **Shadow Scale**
```typescript
export const Shadows = {
  // iOS-style elevation
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  
  // Liquid glass specific shadows
  glass: {
    regular: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      elevation: 8,
    },
    clear: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 16,
      elevation: 4,
    },
  },
};
```

---

## ⚡ **Animation Tokens**

### **Duration Tokens**
```typescript
export const Duration = {
  instant: 0,      // No animation
  immediate: 100,  // Micro-feedback
  quick: 150,      // Touch response
  standard: 300,   // Standard transitions
  slow: 500,       // Page transitions
  slower: 800,     // Specular highlights
  slowest: 1200,   // Success celebrations
  
  // Semantic durations
  feedback: 150,   // Touch feedback
  transition: 300, // Screen transitions
  reveal: 400,     // Content reveals
  celebration: 600, // Success states
};
```

### **Easing Tokens**
```typescript
export const Easing = {
  // Standard curves
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  
  // Custom curves (cubic-bezier)
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  glass: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  
  // React Native Reanimated
  springConfig: {
    tension: 300,
    friction: 35,
    mass: 1,
  },
};
```

---

## 📱 **Layout Tokens**

### **Breakpoints**
```typescript
export const Breakpoints = {
  // Device-specific breakpoints
  mobile: {
    small: 320,  // iPhone SE
    medium: 375, // iPhone 12/13/14
    large: 430,  // iPhone 14 Pro Max
  },
  
  tablet: {
    small: 768,  // iPad Mini
    large: 1024, // iPad Pro
  },
  
  // Semantic breakpoints
  compact: 375,   // Single column layout
  regular: 768,   // Multi-column possible
};
```

### **Grid System**
```typescript
export const Grid = {
  columns: 12,
  gutter: 16,
  margin: 16,
  
  // Component grid
  photoGrid: {
    columns: 3,
    gap: 8,
    aspectRatio: 1, // Square photos
  },
  
  shareGrid: {
    columns: 4,
    gap: 12,
    aspectRatio: 1,
  },
};
```

---

## 🎨 **Figma Variable Setup**

### **Color Variables**
```figma
// Create these collections in Figma:

Collection: "Glass Materials"
├── Regular/Background
├── Regular/Border  
├── Clear/Background
├── Clear/Border
└── Shadow/Glass

Collection: "System Colors"
├── Label/Primary
├── Label/Secondary
├── Background/Primary
├── Background/Secondary
└── Separator/Primary

Collection: "Semantic Colors"
├── Blue/Primary
├── Green/Success
├── Red/Error
└── Accent/Tinted
```

### **Number Variables**
```figma
Collection: "Spacing"
├── XS (4)
├── SM (8)  
├── MD (16)
├── LG (24)
├── XL (32)
└── XXL (48)

Collection: "Typography"
├── Font/Caption (12)
├── Font/Body (17)
├── Font/Title (28)
└── Font/Hero (40)

Collection: "Border Radius"
├── SM (8)
├── MD (12)
├── LG (16)
└── XL (20)
```

### **Mode Setup**
```figma
// Create modes for each collection:
- Light Mode / Dark Mode (for colors)
- iOS / Android (for platform-specific values)
- Compact / Regular (for size classes)
```

---

## 🔧 **React Native Implementation**

### **Token Usage Examples**
```typescript
import { StyleSheet } from 'react-native';
import { 
  GlassTokens, 
  Spacing, 
  FontSizes, 
  BorderRadius,
  Shadows 
} from './design-tokens';

const styles = StyleSheet.create({
  button: {
    backgroundColor: GlassTokens.regular.background,
    borderColor: GlassTokens.regular.border,
    borderWidth: 1,
    borderRadius: BorderRadius.button.medium,
    paddingHorizontal: Spacing.component.paddingHorizontal,
    paddingVertical: Spacing.component.paddingVertical,
    ...Shadows.glass.regular,
  },
  
  title: {
    fontSize: FontSizes.title1,
    fontWeight: FontWeights.semibold,
    lineHeight: LineHeights.title,
    marginBottom: Spacing.md,
  },
});
```

### **Token Validation**
```typescript
// TypeScript interface for type safety
interface DesignTokens {
  spacing: typeof Spacing;
  colors: typeof GlassTokens;
  typography: typeof FontSizes;
  borderRadius: typeof BorderRadius;
  shadows: typeof Shadows;
}

// Runtime validation
const validateTokens = (tokens: DesignTokens) => {
  // Ensure all required tokens are present
  // Validate value ranges and types
  // Check for accessibility compliance
};
```

This complete design token system ensures perfect consistency between Figma designs and React Native implementation! 🎯✨