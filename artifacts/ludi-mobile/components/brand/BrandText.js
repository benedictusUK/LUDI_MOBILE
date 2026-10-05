import React, { forwardRef } from 'react';
import { Text, TextInput } from 'react-native';
import { useBrandTypography } from '../home/brand';

// Body font by default; any style passed in comes later and wins.
export const BrandText = forwardRef(function BrandText({ style, ...rest }, ref) {
  const { body } = useBrandTypography();
  return <Text ref={ref} style={[body, style]} {...rest} />;
});

export const BrandTextInput = forwardRef(function BrandTextInput({ style, ...rest }, ref) {
  const { body } = useBrandTypography();
  return <TextInput ref={ref} style={[body, style]} {...rest} />;
});

export default BrandText;
