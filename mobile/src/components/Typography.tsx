import React from 'react';
import { Text as NativeText, TextInput as NativeTextInput } from 'react-native';

const manrope = { fontFamily: 'Manrope' };

export function Text({ style, ...props }: React.ComponentProps<typeof NativeText>) {
  return <NativeText {...props} style={[manrope, style]} />;
}

export function TextInput({ style, ...props }: React.ComponentProps<typeof NativeTextInput>) {
  return <NativeTextInput {...props} style={[manrope, style]} />;
}
