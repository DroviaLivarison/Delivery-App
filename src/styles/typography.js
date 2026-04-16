import { Platform } from 'react-native';

export const typography = {
  // Font Families
  fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  fontFamilyBold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  
  // Font Sizes
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16,
  body1: 16,
  body2: 14,
  caption: 12,
  overline: 10,
  
  // Line Heights
  lineHeightH1: 40,
  lineHeightH2: 36,
  lineHeightH3: 32,
  lineHeightH4: 28,
  lineHeightH5: 24,
  lineHeightH6: 24,
  lineHeightBody1: 24,
  lineHeightBody2: 20,
  lineHeightCaption: 16,
  
  // Font Weights
  thin: '100',
  light: '300',
  regular: '400',
  medium: '500',
  bold: '700',
  black: '900',
};