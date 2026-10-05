import { createContext, useContext } from 'react';

export const brandFonts = {
  LudiDisplay: require('../../assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf'),
  LudiBody: require('../../assets/fonts/Manrope.ttf'),
};
export const BrandTypographyContext = createContext({ loaded: false, error: null });
export function useBrandTypography() {
  const { loaded, error } = useContext(BrandTypographyContext);
  return {
    body: loaded ? { fontFamily: 'LudiBody' } : {},
    display: loaded ? { fontFamily: 'LudiDisplay' } : { fontWeight: '800', fontStyle: 'italic' },
    error,
  };
}
export function homePalette(dark) {
  return {
    background: dark ? '#071728' : '#edf4fa',
    surface: dark ? '#10243a' : '#ffffff',
    text: dark ? '#f2f7fc' : '#102943',
    muted: dark ? '#acbfd0' : '#526b80',
    border: dark ? '#304b63' : '#cbdcea',
    mint: dark ? '#42e6b5' : '#087c60',
    blue: '#72aaff',
  };
}
