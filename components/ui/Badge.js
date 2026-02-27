import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function Badge({ children, style, textStyle, ...props }) {
  return (
    <View style={[styles.badge, style]} {...props}>
      <Text style={[styles.text, textStyle]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
}); 