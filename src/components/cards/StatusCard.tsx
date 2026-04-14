import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { Badge } from '../ui/Badge';
import { getStatusLabel, getJobLabel } from '../../utils/format';
import { ParticipationStatus, JobType } from '../../types/network';

interface StatusCardProps {
  status: ParticipationStatus;
  currentJob: JobType | null;
  globalNodes: number;
  onToggle?: () => void;
  onPress?: () => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  status,
  currentJob,
  globalNodes,
  onToggle,
  onPress,
}) => {
  const isActive = status === 'active';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Globe icon & node count */}
      <View style={styles.header}>
        <View style={styles.globeContainer}>
          <Ionicons name="globe" size={28} color={Colors.cyan} />
          <View style={styles.pulseRing} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.nodeCount}>
            {globalNodes.toLocaleString()} nodes
          </Text>
          <Text style={styles.nodeLabel}>世界中のノード数</Text>
        </View>
        <Badge
          variant={status as any}
          label={getStatusLabel(status)}
          icon={isActive ? 'radio-button-on' : 'pause-circle'}
          size="md"
        />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Current job */}
      <View style={styles.footer}>
        <View style={styles.jobInfo}>
          <Ionicons
            name={isActive ? 'hardware-chip' : 'pause'}
            size={16}
            color={isActive ? Colors.cyan : Colors.textMuted}
          />
          <Text style={[styles.jobText, !isActive && styles.jobTextMuted]}>
            {getJobLabel(currentJob)}
          </Text>
        </View>
        {onToggle && (
          <TouchableOpacity
            style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
            onPress={onToggle}
          >
            <Text style={styles.toggleText}>
              {isActive ? '停止' : '開始'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  globeContainer: {
    position: 'relative',
    marginRight: Spacing[3],
  },
  pulseRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0,210,255,0.3)',
  },
  headerText: {
    flex: 1,
  },
  nodeCount: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  nodeLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing[4],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  jobText: {
    ...Typography.bodySmall,
    color: Colors.cyan,
    marginLeft: Spacing[2],
  },
  jobTextMuted: {
    color: Colors.textMuted,
  },
  toggleBtn: {
    backgroundColor: 'rgba(0,210,255,0.1)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.3)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  toggleText: {
    ...Typography.label,
    color: Colors.cyan,
  },
});
