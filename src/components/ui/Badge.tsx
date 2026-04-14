import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '../../theme';

type BadgeVariant = 'active' | 'standby' | 'power_save' | 'offline' | 'supporter' | 'rank' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  label: string;
  icon?: string;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}

const variantConfig: Record<BadgeVariant, { bg: string; color: string; borderColor: string }> = {
  active: {
    bg: 'rgba(34,197,94,0.15)',
    color: Colors.active,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  standby: {
    bg: 'rgba(245,158,11,0.15)',
    color: Colors.standby,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  power_save: {
    bg: 'rgba(107,114,128,0.15)',
    color: Colors.powerSave,
    borderColor: 'rgba(107,114,128,0.3)',
  },
  offline: {
    bg: 'rgba(239,68,68,0.15)',
    color: Colors.error,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  supporter: {
    bg: 'rgba(255,215,0,0.15)',
    color: Colors.gold,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  rank: {
    bg: 'rgba(124,58,237,0.15)',
    color: Colors.purpleLight,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  info: {
    bg: 'rgba(0,210,255,0.12)',
    color: Colors.cyan,
    borderColor: 'rgba(0,210,255,0.3)',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'info',
  label,
  icon,
  style,
  size = 'md',
}) => {
  const config = variantConfig[variant];

  return (
    <View
      style={[
        styles.base,
        styles[`size_${size}`],
        {
          backgroundColor: config.bg,
          borderColor: config.borderColor,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon as any}
          size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12}
          color={config.color}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          styles[`labelSize_${size}`],
          { color: config.color },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  size_sm: {
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
  },
  size_md: {
    paddingHorizontal: Spacing[3],
    paddingVertical: 5,
  },
  size_lg: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontWeight: '600',
  },
  labelSize_sm: {
    fontSize: 10,
  },
  labelSize_md: {
    fontSize: 12,
  },
  labelSize_lg: {
    fontSize: 14,
  },
});
