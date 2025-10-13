// Aesthetic color palettes for drawing canvas
export const colorPalettes = [
    // Aesthetic pastel backgrounds with contrasting dark strokes
    { bg: '#FFB3BA', stroke: '#2D3748' }, // pastel pink bg, dark slate stroke
    { bg: '#BAFFC9', stroke: '#1A202C' }, // pastel green bg, dark gray stroke
    { bg: '#BAE1FF', stroke: '#2B6CB0' }, // pastel blue bg, dark blue stroke
    { bg: '#FFFFBA', stroke: '#744210' }, // pastel yellow bg, dark brown stroke
    { bg: '#E6BAFF', stroke: '#553C9A' }, // pastel purple bg, dark purple stroke
    { bg: '#BAFFFF', stroke: '#0D4D4D' }, // pastel cyan bg, dark teal stroke
    { bg: '#FFD1BA', stroke: '#9C4221' }, // pastel peach bg, dark orange stroke
    { bg: '#C9BAFF', stroke: '#4C1D95' }, // pastel lavender bg, dark purple stroke
    { bg: '#BAFFDC', stroke: '#065F46' }, // pastel mint bg, dark green stroke
    { bg: '#FFBAE6', stroke: '#831843' }, // pastel rose bg, dark pink stroke
];

// Helper function to get a random color palette
export const getRandomColorPalette = () => {
    return colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
};
