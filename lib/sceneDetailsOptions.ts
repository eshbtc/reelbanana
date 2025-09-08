// Scene details options for enhanced video generation

export interface LocationOption {
  id: string;
  name: string;
  description: string;
  category: 'indoor' | 'outdoor' | 'fantasy' | 'modern' | 'historical' | 'sci-fi';
}

export interface PropOption {
  id: string;
  name: string;
  description: string;
  category: 'weapon' | 'tool' | 'furniture' | 'magical' | 'technology' | 'decorative';
}

export interface CostumeOption {
  id: string;
  name: string;
  description: string;
  category: 'casual' | 'formal' | 'fantasy' | 'historical' | 'sci-fi' | 'professional';
}

// Predefined location options
export const LOCATION_OPTIONS: LocationOption[] = [
  // Indoor
  { id: 'office', name: 'Office', description: 'Modern office environment', category: 'indoor' },
  { id: 'living-room', name: 'Living Room', description: 'Cozy home living space', category: 'indoor' },
  { id: 'kitchen', name: 'Kitchen', description: 'Home kitchen setting', category: 'indoor' },
  { id: 'bedroom', name: 'Bedroom', description: 'Personal bedroom space', category: 'indoor' },
  { id: 'library', name: 'Library', description: 'Quiet library with books', category: 'indoor' },
  { id: 'laboratory', name: 'Laboratory', description: 'Scientific research lab', category: 'indoor' },
  { id: 'classroom', name: 'Classroom', description: 'Educational classroom', category: 'indoor' },
  { id: 'hospital', name: 'Hospital', description: 'Medical facility', category: 'indoor' },
  
  // Outdoor
  { id: 'forest', name: 'Forest', description: 'Dense woodland area', category: 'outdoor' },
  { id: 'beach', name: 'Beach', description: 'Sandy beach with ocean', category: 'outdoor' },
  { id: 'mountain', name: 'Mountain', description: 'Mountainous landscape', category: 'outdoor' },
  { id: 'desert', name: 'Desert', description: 'Arid desert landscape', category: 'outdoor' },
  { id: 'city-street', name: 'City Street', description: 'Urban city street', category: 'outdoor' },
  { id: 'park', name: 'Park', description: 'Public park with greenery', category: 'outdoor' },
  { id: 'garden', name: 'Garden', description: 'Beautiful garden setting', category: 'outdoor' },
  { id: 'bridge', name: 'Bridge', description: 'Bridge over water', category: 'outdoor' },
  
  // Fantasy
  { id: 'castle', name: 'Castle', description: 'Medieval castle', category: 'fantasy' },
  { id: 'cave', name: 'Cave', description: 'Mysterious cave', category: 'fantasy' },
  { id: 'tower', name: 'Tower', description: 'Tall magical tower', category: 'fantasy' },
  { id: 'enchanted-forest', name: 'Enchanted Forest', description: 'Magical forest', category: 'fantasy' },
  { id: 'dragon-lair', name: 'Dragon Lair', description: 'Dragon\'s treasure cave', category: 'fantasy' },
  { id: 'wizard-study', name: 'Wizard Study', description: 'Magical study room', category: 'fantasy' },
  
  // Modern
  { id: 'airport', name: 'Airport', description: 'Modern airport terminal', category: 'modern' },
  { id: 'shopping-mall', name: 'Shopping Mall', description: 'Large shopping center', category: 'modern' },
  { id: 'restaurant', name: 'Restaurant', description: 'Elegant dining establishment', category: 'modern' },
  { id: 'gym', name: 'Gym', description: 'Fitness center', category: 'modern' },
  { id: 'cafe', name: 'Cafe', description: 'Cozy coffee shop', category: 'modern' },
  
  // Historical
  { id: 'medieval-village', name: 'Medieval Village', description: 'Historical village setting', category: 'historical' },
  { id: 'ancient-temple', name: 'Ancient Temple', description: 'Historical temple ruins', category: 'historical' },
  { id: 'pirate-ship', name: 'Pirate Ship', description: 'Historical sailing vessel', category: 'historical' },
  { id: 'wild-west', name: 'Wild West', description: 'Old western town', category: 'historical' },
  
  // Sci-Fi
  { id: 'spaceship', name: 'Spaceship', description: 'Futuristic spacecraft', category: 'sci-fi' },
  { id: 'space-station', name: 'Space Station', description: 'Orbital space station', category: 'sci-fi' },
  { id: 'alien-planet', name: 'Alien Planet', description: 'Extraterrestrial world', category: 'sci-fi' },
  { id: 'future-city', name: 'Future City', description: 'Futuristic urban landscape', category: 'sci-fi' },
];

// Predefined prop options
export const PROP_OPTIONS: PropOption[] = [
  // Weapons
  { id: 'sword', name: 'Sword', description: 'Medieval sword', category: 'weapon' },
  { id: 'bow-arrow', name: 'Bow & Arrow', description: 'Traditional archery set', category: 'weapon' },
  { id: 'staff', name: 'Staff', description: 'Magical or walking staff', category: 'weapon' },
  { id: 'gun', name: 'Gun', description: 'Modern firearm', category: 'weapon' },
  { id: 'laser-blaster', name: 'Laser Blaster', description: 'Futuristic energy weapon', category: 'weapon' },
  
  // Tools
  { id: 'hammer', name: 'Hammer', description: 'Construction hammer', category: 'tool' },
  { id: 'wrench', name: 'Wrench', description: 'Mechanical tool', category: 'tool' },
  { id: 'screwdriver', name: 'Screwdriver', description: 'Repair tool', category: 'tool' },
  { id: 'flashlight', name: 'Flashlight', description: 'Portable light source', category: 'tool' },
  { id: 'rope', name: 'Rope', description: 'Climbing or binding rope', category: 'tool' },
  
  // Furniture
  { id: 'chair', name: 'Chair', description: 'Seating furniture', category: 'furniture' },
  { id: 'table', name: 'Table', description: 'Surface furniture', category: 'furniture' },
  { id: 'bookshelf', name: 'Bookshelf', description: 'Book storage furniture', category: 'furniture' },
  { id: 'bed', name: 'Bed', description: 'Sleeping furniture', category: 'furniture' },
  { id: 'desk', name: 'Desk', description: 'Work surface', category: 'furniture' },
  
  // Magical
  { id: 'crystal-ball', name: 'Crystal Ball', description: 'Divination crystal', category: 'magical' },
  { id: 'magic-book', name: 'Magic Book', description: 'Spell book', category: 'magical' },
  { id: 'potion', name: 'Potion', description: 'Magical elixir', category: 'magical' },
  { id: 'wand', name: 'Wand', description: 'Magical wand', category: 'magical' },
  { id: 'crystal', name: 'Crystal', description: 'Power crystal', category: 'magical' },
  
  // Technology
  { id: 'computer', name: 'Computer', description: 'Desktop computer', category: 'technology' },
  { id: 'smartphone', name: 'Smartphone', description: 'Mobile device', category: 'technology' },
  { id: 'robot', name: 'Robot', description: 'Mechanical assistant', category: 'technology' },
  { id: 'hologram', name: 'Hologram', description: '3D projection', category: 'technology' },
  { id: 'drone', name: 'Drone', description: 'Flying device', category: 'technology' },
  
  // Decorative
  { id: 'flowers', name: 'Flowers', description: 'Decorative flowers', category: 'decorative' },
  { id: 'candle', name: 'Candle', description: 'Lighting candle', category: 'decorative' },
  { id: 'painting', name: 'Painting', description: 'Wall artwork', category: 'decorative' },
  { id: 'mirror', name: 'Mirror', description: 'Reflective surface', category: 'decorative' },
  { id: 'vase', name: 'Vase', description: 'Decorative container', category: 'decorative' },
];

// Predefined costume options
export const COSTUME_OPTIONS: CostumeOption[] = [
  // Casual
  { id: 't-shirt-jeans', name: 'T-shirt & Jeans', description: 'Casual everyday wear', category: 'casual' },
  { id: 'hoodie', name: 'Hoodie', description: 'Comfortable hooded sweatshirt', category: 'casual' },
  { id: 'sweater', name: 'Sweater', description: 'Warm knitted sweater', category: 'casual' },
  { id: 'shorts', name: 'Shorts', description: 'Casual shorts', category: 'casual' },
  { id: 'sneakers', name: 'Sneakers', description: 'Comfortable athletic shoes', category: 'casual' },
  
  // Formal
  { id: 'suit', name: 'Business Suit', description: 'Professional business attire', category: 'formal' },
  { id: 'dress', name: 'Elegant Dress', description: 'Formal evening dress', category: 'formal' },
  { id: 'tuxedo', name: 'Tuxedo', description: 'Formal black-tie attire', category: 'formal' },
  { id: 'blouse-skirt', name: 'Blouse & Skirt', description: 'Professional women\'s attire', category: 'formal' },
  { id: 'dress-shoes', name: 'Dress Shoes', description: 'Formal leather shoes', category: 'formal' },
  
  // Fantasy
  { id: 'wizard-robe', name: 'Wizard Robe', description: 'Long magical robe', category: 'fantasy' },
  { id: 'knight-armor', name: 'Knight Armor', description: 'Medieval protective armor', category: 'fantasy' },
  { id: 'elf-cloak', name: 'Elf Cloak', description: 'Elegant elven garment', category: 'fantasy' },
  { id: 'dragon-scale', name: 'Dragon Scale Armor', description: 'Scaly protective gear', category: 'fantasy' },
  { id: 'fairy-wings', name: 'Fairy Wings', description: 'Delicate magical wings', category: 'fantasy' },
  
  // Historical
  { id: 'medieval-gown', name: 'Medieval Gown', description: 'Historical period dress', category: 'historical' },
  { id: 'pirate-coat', name: 'Pirate Coat', description: 'Seafaring captain\'s coat', category: 'historical' },
  { id: 'victorian-dress', name: 'Victorian Dress', description: '19th century fashion', category: 'historical' },
  { id: 'samurai-armor', name: 'Samurai Armor', description: 'Traditional Japanese armor', category: 'historical' },
  { id: 'roman-toga', name: 'Roman Toga', description: 'Ancient Roman garment', category: 'historical' },
  
  // Sci-Fi
  { id: 'space-suit', name: 'Space Suit', description: 'Futuristic space gear', category: 'sci-fi' },
  { id: 'cyberpunk-jacket', name: 'Cyberpunk Jacket', description: 'High-tech street wear', category: 'sci-fi' },
  { id: 'android-uniform', name: 'Android Uniform', description: 'Synthetic being attire', category: 'sci-fi' },
  { id: 'holographic-cloak', name: 'Holographic Cloak', description: 'Energy-based garment', category: 'sci-fi' },
  { id: 'power-armor', name: 'Power Armor', description: 'Mechanized exoskeleton', category: 'sci-fi' },
  
  // Professional
  { id: 'lab-coat', name: 'Lab Coat', description: 'Scientific laboratory attire', category: 'professional' },
  { id: 'chef-uniform', name: 'Chef Uniform', description: 'Culinary professional wear', category: 'professional' },
  { id: 'doctor-coat', name: 'Doctor Coat', description: 'Medical professional attire', category: 'professional' },
  { id: 'pilot-uniform', name: 'Pilot Uniform', description: 'Aviation professional wear', category: 'professional' },
  { id: 'police-uniform', name: 'Police Uniform', description: 'Law enforcement attire', category: 'professional' },
];

// Helper functions
export const getLocationById = (id: string): LocationOption | undefined => {
  return LOCATION_OPTIONS.find(location => location.id === id);
};

export const getPropById = (id: string): PropOption | undefined => {
  return PROP_OPTIONS.find(prop => prop.id === id);
};

export const getCostumeById = (id: string): CostumeOption | undefined => {
  return COSTUME_OPTIONS.find(costume => costume.id === id);
};

export const getLocationsByCategory = (category: string): LocationOption[] => {
  return LOCATION_OPTIONS.filter(location => location.category === category);
};

export const getPropsByCategory = (category: string): PropOption[] => {
  return PROP_OPTIONS.filter(prop => prop.category === category);
};

export const getCostumesByCategory = (category: string): CostumeOption[] => {
  return COSTUME_OPTIONS.filter(costume => costume.category === category);
};

// Get all categories
export const getLocationCategories = (): string[] => {
  return [...new Set(LOCATION_OPTIONS.map(loc => loc.category))];
};

export const getPropCategories = (): string[] => {
  return [...new Set(PROP_OPTIONS.map(prop => prop.category))];
};

export const getCostumeCategories = (): string[] => {
  return [...new Set(COSTUME_OPTIONS.map(costume => costume.category))];
};

