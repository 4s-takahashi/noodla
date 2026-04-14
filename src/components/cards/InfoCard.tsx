import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface InfoCardProps {
  icon: string;
  iconColor?: string;
  title: string;
  body: string;
  style?: ViewStyle;
  variant?: 'default' | 'highlight' | 'warning' | 'success';
}

const variantStyles = {
  default: {
    bg: Colors.bgCard,
    border: Colors.border,
    iconBg: 'rgba(0,210,255,0.1)',
  },
  highlight: {
    bg: 'rgba(0,210,255,0.07)',
    border: 'rgba(0,210,255,0.2)',
    iconBg: 'rgba(0,210,255,0.15)',
  },
  warning: {
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.2)',
    iconBg: 'rgba(245,158,11,0.15)',
  },
  success: {
    bg: 'rgba(34,197,94,0.07)',
    border: 'rgba(34,197,94,0.2)',
    iconBg: 'rgba(34,197,94,0.15)',
  },
};

export const InfoCard: React.FC<InfoCardProps> = ({
  icon,
  iconColor = Colors.cyan,
  title,
  body,
  style,
  variant = 'default',
}) => {
  const vs = variantStyles[variant];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: vs.bg, borderColor: vs.border },
        style,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: vs.iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  body: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
