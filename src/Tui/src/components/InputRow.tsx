import React from 'react';
import { Box, Text } from 'ink';

type InputRowProps = {
  label: string;
  value: string;
  placeholder?: string;
  focused?: boolean;
  masked?: boolean;
};

export function InputRow({ label, value, placeholder, focused, masked }: InputRowProps) {
  const displayValue = masked ? '*'.repeat(value.length) : value;
  const showPlaceholder = !displayValue && placeholder;

  return (
    <Box flexDirection="row" gap={1}>
      <Text color={focused ? 'cyan' : undefined}>{focused ? '>' : ' '} {label}:</Text>
      <Text color={showPlaceholder ? 'gray' : undefined}>
        {displayValue || placeholder || ''}
      </Text>
    </Box>
  );
}
