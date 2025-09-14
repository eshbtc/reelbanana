# ReelBanana Responsive Design Specifications
*Screen Size Adaptations for React Native Mobile App*

---

## 🎯 **Mobile-First Approach**

ReelBanana is designed mobile-first, optimizing for single-handed use while gracefully scaling to larger devices. The responsive strategy prioritizes content density and touch accessibility across all screen sizes.

---

## 📱 **Device Breakpoints**

### **Primary Target Devices**
```typescript
export const DeviceBreakpoints = {
  // Primary targets (80% of users)
  mobile: {
    small: 375,    // iPhone 13 Mini, iPhone SE 3rd gen
    medium: 393,   // iPhone 15, iPhone 14 Pro  
    large: 430,    // iPhone 15 Pro Max, iPhone 14 Pro Max
  },
  
  // Secondary targets (15% of users)
  tablet: {
    small: 768,    // iPad Mini
    medium: 810,   // iPad 10th gen
    large: 1024,   // iPad Pro 11"
    xlarge: 1366,  // iPad Pro 12.9"
  },
  
  // Edge cases (5% of users)
  compact: {
    tiny: 320,     // Very old devices
    narrow: 360,   // Small Android phones
  },
};
```

### **Screen Density Considerations**
```typescript
export const ScreenDensity = {
  // iOS devices
  '1x': 163,     // Older devices
  '2x': 326,     // Standard Retina
  '3x': 458,     // Super Retina
  
  // Android densities
  mdpi: 160,     // 1x baseline
  hdpi: 240,     // 1.5x
  xhdpi: 320,    // 2x
  xxhdpi: 480,   // 3x
  xxxhdpi: 640,  // 4x
};
```

---

## 📐 **Layout Adaptations**

### **Grid System**
```typescript
// Responsive grid based on screen width
const getGridConfig = (screenWidth: number) => {
  if (screenWidth < 375) {
    // Compact phones
    return {
      photoGrid: { columns: 2, gap: 8 },
      shareGrid: { columns: 3, gap: 12 },
      padding: 12,
    };
  } else if (screenWidth < 430) {
    // Standard phones  
    return {
      photoGrid: { columns: 3, gap: 8 },
      shareGrid: { columns: 4, gap: 12 },
      padding: 16,
    };
  } else if (screenWidth < 768) {
    // Large phones
    return {
      photoGrid: { columns: 3, gap: 12 },
      shareGrid: { columns: 4, gap: 16 },
      padding: 20,
    };
  } else {
    // Tablets
    return {
      photoGrid: { columns: 4, gap: 16 },
      shareGrid: { columns: 6, gap: 20 },
      padding: 24,
    };
  }
};
```

### **Typography Scaling**
```typescript
// Font sizes scale with screen size
const getTypographyScale = (screenWidth: number) => {
  const baseScale = screenWidth / 375; // iPhone 13 Mini baseline
  const scale = Math.max(0.9, Math.min(1.2, baseScale));
  
  return {
    hero: Math.round(40 * scale),
    title1: Math.round(28 * scale),
    title2: Math.round(22 * scale),
    body: Math.round(17 * scale),
    caption: Math.round(12 * scale),
  };
};
```

---

## 📱 **Screen-Specific Layouts**

### **iPhone SE (375x667) - Compact Layout**
```typescript
const CompactLayout = {
  // Maximize vertical space
  spacing: {
    padding: 12,
    gap: 8,
    margin: 12,
  },
  
  // Smaller components
  button: {
    height: 44, // Minimum touch target
    borderRadius: 12,
    fontSize: 16,
  },
  
  // Tighter photo grid
  photoGrid: {
    columns: 2,
    gap: 6,
    aspectRatio: 1,
  },
  
  // Single column for progress
  progressLayout: 'vertical',
  
  // Compact navigation
  tabBar: {
    height: 56,
    iconSize: 24,
    fontSize: 12,
  },
};
```

### **iPhone 15 (393x852) - Standard Layout**
```typescript
const StandardLayout = {
  // Balanced spacing
  spacing: {
    padding: 16,
    gap: 12,
    margin: 16,
  },
  
  // Standard components
  button: {
    height: 48,
    borderRadius: 16,
    fontSize: 17,
  },
  
  // 3-column photo grid
  photoGrid: {
    columns: 3,
    gap: 8,
    aspectRatio: 1,
  },
  
  // Mixed layout for progress
  progressLayout: 'adaptive',
  
  // Standard navigation
  tabBar: {
    height: 64,
    iconSize: 28,
    fontSize: 13,
  },
};
```

### **iPhone 15 Pro Max (430x932) - Comfortable Layout**
```typescript
const ComfortableLayout = {
  // Generous spacing
  spacing: {
    padding: 20,
    gap: 16,
    margin: 20,
  },
  
  // Larger components
  button: {
    height: 52,
    borderRadius: 20,
    fontSize: 18,
  },
  
  // 3-column with larger gaps
  photoGrid: {
    columns: 3,
    gap: 12,
    aspectRatio: 1,
  },
  
  // Side-by-side for progress
  progressLayout: 'horizontal',
  
  // Comfortable navigation
  tabBar: {
    height: 72,
    iconSize: 32,
    fontSize: 14,
  },
};
```

### **iPad (768x1024) - Tablet Layout**
```typescript
const TabletLayout = {
  // Tablet-optimized spacing
  spacing: {
    padding: 24,
    gap: 20,
    margin: 24,
  },
  
  // Desktop-like components
  button: {
    height: 56,
    borderRadius: 24,
    fontSize: 18,
  },
  
  // 4-column photo grid
  photoGrid: {
    columns: 4,
    gap: 16,
    aspectRatio: 1,
  },
  
  // Two-column layout
  progressLayout: 'columns',
  
  // Sidebar navigation option
  navigation: 'sidebar',
  
  // Enhanced interactions
  hover: true,
  cursor: 'pointer',
};
```

---

## 🎨 **Component Adaptations**

### **Liquid Glass Scaling**
```typescript
// Glass effects scale with screen size
const getGlassConfig = (screenWidth: number) => {
  if (screenWidth < 375) {
    return {
      blur: 20,         // Reduced for performance
      borderRadius: 12,
      shadowRadius: 16,
    };
  } else if (screenWidth < 768) {
    return {
      blur: 24,         // Standard
      borderRadius: 16,
      shadowRadius: 24,
    };
  } else {
    return {
      blur: 32,         // Enhanced for tablets
      borderRadius: 24,
      shadowRadius: 32,
    };
  }
};
```

### **Adaptive Button Sizing**
```typescript
const AdaptiveButton = ({ children, size = 'auto', ...props }) => {
  const { width } = useWindowDimensions();
  
  const buttonSize = useMemo(() => {
    if (size !== 'auto') return size;
    
    if (width < 375) return 'small';
    if (width < 430) return 'medium';
    if (width < 768) return 'large';
    return 'xl';
  }, [width, size]);
  
  const buttonStyles = {
    small: { height: 44, paddingHorizontal: 16, fontSize: 15 },
    medium: { height: 48, paddingHorizontal: 20, fontSize: 16 },
    large: { height: 52, paddingHorizontal: 24, fontSize: 17 },
    xl: { height: 56, paddingHorizontal: 28, fontSize: 18 },
  };
  
  return (
    <LiquidGlass
      variant="regular"
      interactive
      style={[styles.button, buttonStyles[buttonSize]]}
      {...props}
    >
      {children}
    </LiquidGlass>
  );
};
```

### **Responsive Photo Grid**
```typescript
const ResponsivePhotoGrid = ({ photos, onSelect }) => {
  const { width } = useWindowDimensions();
  
  const gridConfig = useMemo(() => {
    const columns = width < 375 ? 2 : width < 768 ? 3 : 4;
    const gap = width < 375 ? 6 : width < 768 ? 8 : 12;
    const itemSize = (width - (gap * (columns + 1))) / columns;
    
    return { columns, gap, itemSize };
  }, [width]);
  
  return (
    <FlatList
      data={photos}
      numColumns={gridConfig.columns}
      columnWrapperStyle={gridConfig.columns > 1 ? styles.row : null}
      ItemSeparatorComponent={() => <View style={{ height: gridConfig.gap }} />}
      renderItem={({ item }) => (
        <PhotoBubble
          photo={item}
          size={gridConfig.itemSize}
          onSelect={() => onSelect(item)}
        />
      )}
      contentContainerStyle={{
        padding: gridConfig.gap,
        gap: gridConfig.gap,
      }}
    />
  );
};
```

---

## 📏 **Touch Target Optimization**

### **Minimum Touch Targets**
```typescript
const TouchTargets = {
  // Apple Human Interface Guidelines
  ios: {
    minimum: 44,    // 44x44pt minimum
    recommended: 48, // Comfortable for most users
    large: 52,      // For primary actions
  },
  
  // Material Design Guidelines
  android: {
    minimum: 48,    // 48dp minimum
    recommended: 52, // Comfortable target
    large: 56,      // For FABs and primary actions
  },
};

// Adaptive touch target
const getMinTouchTarget = () => {
  return Platform.select({
    ios: TouchTargets.ios.minimum,
    android: TouchTargets.android.minimum,
  });
};
```

### **Touch-Friendly Spacing**
```typescript
// Ensure adequate spacing between interactive elements
const getTouchSpacing = (screenWidth: number) => {
  const baseSpacing = 8;
  
  if (screenWidth < 375) {
    return baseSpacing; // Tight spacing for small screens
  } else if (screenWidth < 768) {
    return baseSpacing * 1.5; // Standard spacing
  } else {
    return baseSpacing * 2; // Generous spacing for tablets
  }
};
```

---

## 🔄 **Orientation Handling**

### **Portrait Mode (Primary)**
```typescript
const PortraitLayout = {
  // Optimized for single-handed use
  navigation: 'bottom',
  layout: 'vertical',
  photoGrid: { columns: 3, aspectRatio: 1 },
  progressStudio: {
    layout: 'stacked',
    orientation: 'vertical',
  },
};
```

### **Landscape Mode (Secondary)**
```typescript
const LandscapeLayout = {
  // Adapted for two-handed use
  navigation: 'side',
  layout: 'horizontal',
  photoGrid: { columns: 5, aspectRatio: 1 },
  progressStudio: {
    layout: 'side-by-side',
    orientation: 'horizontal',
  },
};

// Orientation-aware component
const OrientationAwareLayout = ({ children }) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  const layoutConfig = isLandscape ? LandscapeLayout : PortraitLayout;
  
  return (
    <View style={[styles.container, layoutConfig.layout]}>
      {children}
    </View>
  );
};
```

---

## 📊 **Performance Considerations**

### **Device Performance Tiers**
```typescript
const PerformanceTiers = {
  high: {
    // Latest devices - full effects
    blur: true,
    animations: 'full',
    particleEffects: true,
    maxSimultaneousAnimations: 8,
  },
  
  medium: {
    // Mid-range devices - reduced effects
    blur: true,
    animations: 'reduced',
    particleEffects: false,
    maxSimultaneousAnimations: 4,
  },
  
  low: {
    // Older devices - minimal effects
    blur: false,
    animations: 'essential',
    particleEffects: false,
    maxSimultaneousAnimations: 2,
  },
};

// Auto-detect performance tier
const getPerformanceTier = (screenWidth: number, pixelRatio: number) => {
  const totalPixels = screenWidth * window.screen.height * pixelRatio;
  
  if (totalPixels > 2000000) return PerformanceTiers.high;
  if (totalPixels > 1000000) return PerformanceTiers.medium;
  return PerformanceTiers.low;
};
```

### **Adaptive Quality Settings**
```typescript
const AdaptiveQualityComponent = ({ children }) => {
  const { width, height } = useWindowDimensions();
  const pixelRatio = PixelRatio.get();
  
  const performanceTier = useMemo(() => 
    getPerformanceTier(width, pixelRatio), [width, pixelRatio]
  );
  
  return (
    <PerformanceProvider value={performanceTier}>
      {children}
    </PerformanceProvider>
  );
};
```

---

## 🎨 **Figma Responsive Setup**

### **Artboard Sizes**
```figma
// Create these artboards for design:

Primary Designs:
├── iPhone 15 (393x852) - Main design reference
├── iPhone SE (375x667) - Compact validation  
├── iPhone 15 Pro Max (430x932) - Large phone validation
└── iPad (768x1024) - Tablet adaptation

Secondary Validation:
├── iPhone 13 Mini (375x812) - Compact modern
├── Pixel 7 (412x915) - Android reference
└── iPad Pro (1024x1366) - Large tablet
```

### **Auto Layout Configuration**
```figma
// Set up components with these auto layout rules:

Container Components:
- Direction: Vertical
- Spacing: 16px (varies by breakpoint)
- Padding: 16px (varies by breakpoint)  
- Resizing: Fill container width
- Alignment: Center

Grid Components:
- Direction: Horizontal
- Spacing: 8px (varies by breakpoint)
- Items per row: 3 (varies by breakpoint)
- Item sizing: Fill proportionally

Button Components:
- Direction: Horizontal
- Padding: 16px horizontal, 12px vertical
- Spacing: 8px (icon to text)
- Min height: 44px
- Resizing: Hug contents
```

### **Responsive Design Tokens**
```figma
// Create these variable collections:

Breakpoint Variables:
├── Compact (320-374px)
├── Standard (375-429px)  
├── Large (430-767px)
└── Tablet (768px+)

Grid Variables:
├── Columns (2, 3, 4, 6)
├── Gap (6px, 8px, 12px, 16px)
└── Padding (12px, 16px, 20px, 24px)

Typography Variables:
├── Scale Factor (0.9, 1.0, 1.1, 1.2)
├── Base Sizes (12, 16, 17, 18)
└── Line Heights (1.2, 1.4, 1.6)
```

---

## ✅ **Testing Strategy**

### **Device Testing Matrix**
```typescript
const TestingMatrix = {
  priority1: [
    'iPhone 15 (393x852)',     // Most common modern iPhone
    'iPhone SE 3rd (375x667)', // Smallest modern iPhone
    'iPhone 15 Pro Max (430x932)', // Largest iPhone
  ],
  
  priority2: [
    'Pixel 7 (412x915)',      // Common Android
    'Galaxy S23 (360x780)',    // Popular Samsung
    'iPad 10th gen (810x1080)', // Common tablet
  ],
  
  edgeCases: [
    'iPhone 12 Mini (360x780)', // Very compact
    'iPad Pro 12.9" (1024x1366)', // Very large
    'Older devices (320x568)',  // Legacy support
  ],
};
```

### **Responsive Testing Checklist**
```checklist
Component Testing:
[ ] All components render correctly on target sizes
[ ] Touch targets meet minimum size requirements
[ ] Text remains readable at all scales
[ ] Images scale appropriately
[ ] Animations perform smoothly

Layout Testing:
[ ] No horizontal scrolling on any screen size
[ ] Content hierarchy maintained across sizes
[ ] Navigation remains accessible
[ ] Grid layouts adapt correctly
[ ] Safe areas respected on all devices

Performance Testing:
[ ] 60fps animations on target devices
[ ] Memory usage stays under limits
[ ] App startup time acceptable
[ ] Battery usage reasonable
[ ] Heat generation minimal

Usability Testing:
[ ] Single-handed use possible on phones
[ ] Two-handed use comfortable on tablets
[ ] Gestures work consistently
[ ] Text selection precise
[ ] Form inputs accessible
```

This responsive specification ensures ReelBanana provides an optimal experience across all mobile device sizes while maintaining the premium Liquid Glass aesthetic! 📱✨