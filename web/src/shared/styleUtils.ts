// Aesthetic color palettes for drawing canvas
export const colorPalettes = [
    { bg: '#FDF4E3', stroke: '#8B4513' }, // Warm cream & brown
    { bg: '#E8F4FD', stroke: '#2C5282' }, // Soft blue & navy
    { bg: '#F0FDF4', stroke: '#166534' }, // Mint & forest green
    { bg: '#FEF3F2', stroke: '#B91C1C' }, // Blush & crimson
    { bg: '#F5F3FF', stroke: '#6B46C1' }, // Lavender & purple
    { bg: '#FFFBEB', stroke: '#D97706' }, // Honey & amber
    { bg: '#F0F9FF', stroke: '#0369A1' }, // Sky & ocean blue
    { bg: '#FDF2F8', stroke: '#BE185D' }, // Rose & magenta
    { bg: '#ECFDF5', stroke: '#047857' }, // Sage & emerald
    { bg: '#FEF7ED', stroke: '#EA580C' }, // Peach & orange
];

// Helper function to get a random color palette
export const getRandomColorPalette = () => {
    return colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
};
