# Apple's Liquid Glass Guidelines Summary
*Critical Rules for ReelBanana React Native Implementation*

## 🚨 **FORBIDDEN PRACTICES**

### **Glass-on-Glass Stacking**
```typescript
// ❌ NEVER DO THIS:
<LiquidGlass variant="regular">
  <LiquidGlass variant="regular"> {/* FORBIDDEN! */}
    <Text>Content</Text>
  </LiquidGlass>
</LiquidGlass>

// ✅ CORRECT:
<View>
  <LiquidGlass variant="regular">
    <Text>Navigation Element</Text>
  </LiquidGlass>
  <View style={{ backgroundColor: 'transparent' }}>
    <Text>Content (no glass)</Text>
  </View>
</View>
```

## 📋 **Required Patterns**

### **Layer Separation**
- **Navigation Layer**: Use LiquidGlass for controls, buttons, navigation
- **Content Layer**: NEVER use LiquidGlass for content areas

### **Variant Usage**
- **Regular**: Most UI elements (90% of use cases)
- **Clear**: ONLY for media-rich backgrounds with bold overlays

### **Tinting Rules**
- Use tinting ONLY for primary actions
- Keep most elements colorless and pure

## 🎯 **ReelBanana Implementation Rules**

### **Photo Selection Screen**
```typescript
// ✅ CORRECT: Clear variant over photos
<LiquidGlass variant="clear" style={photoOverlay}>
  <Text>Photo Controls</Text>
</LiquidGlass>

// ✅ CORRECT: Regular variant for navigation
<LiquidGlass variant="regular" style={navigationBar}>
  <Text>Back</Text>
</LiquidGlass>
```

### **Progress Studio**
```typescript
// ✅ CORRECT: Regular variant for container
<LiquidGlass variant="regular">
  <Text>Creating Magic...</Text>
  <View style={nonGlassProgress}> {/* No glass for progress bars */}
    <ProgressBar />
  </View>
</LiquidGlass>
```

### **Share Screen**
```typescript
// ✅ CORRECT: Clear variant over video
<LiquidGlass variant="clear" style={videoOverlay}>
  <ShareButtons />
</LiquidGlass>

// ✅ CORRECT: Tinted primary action only
<LiquidGlass variant="regular" style={primaryActionTint}>
  <Text>Share to TikTok</Text>
</LiquidGlass>
```