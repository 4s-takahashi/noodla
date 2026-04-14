import React, { ReactNode } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ViewStyle,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Layout } from '../../theme';

interface ScreenContainerProps {
  children: ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  noPadding?: boolean;
  noSafeArea?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = true,
  refreshing = false,
  onRefresh,
  style,
  contentStyle,
  noPadding = false,
  noSafeArea = false,
}) => {
  const Wrapper = noSafeArea ? View : SafeAreaView;

  const innerContent = (
    <View
      style={[
        styles.content,
        !noPadding && styles.padding,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <Wrapper style={[styles.container, style]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.cyan}
                colors={[Colors.cyan]}
              />
            ) : undefined
          }
        >
          {innerContent}
        </ScrollView>
      ) : (
        innerContent
      )}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  padding: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: Layout.tabBarHeight + 20,
  },
});
