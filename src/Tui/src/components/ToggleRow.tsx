import React from 'react';
import { Box, Text } from 'ink';

type ToggleRowProps = {
  label: string;
  value: boolean;
  focused?: boolean;
};

export function ToggleRow({ label, value, focused }: ToggleRowProps) {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={focused ? 'cyan' : undefined}>{focused ? '>' : ' '} {label}:</Text>
      <Text color={value ? 'green' : 'red'}>{value ? 'Yes' : 'No'}</Text>
    </Box>
  );
}
