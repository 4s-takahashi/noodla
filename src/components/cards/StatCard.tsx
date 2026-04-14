import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface StatCardProps {
  icon: string;
  iconColor?: string;
  value: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  style?: ViewStyle;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconColor = Colors.cyan,
  value,
  label,
  sublabel,
  onPress,
  style,
  accentColor,
}) => {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.iconContainer, accentColor ? { backgroundColor: `${accentColor}18` } : {}]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <Text style={[styles.value, accentColor ? { color: accentColor } : {}]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    minHeight: 110,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(0,210,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  value: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  sublabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
