// Petit en-tête commun aux pages d'information — src/components/InfoHeader.js
import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import GradientHeader from './GradientHeader';

export default function InfoHeader({ title, navigation }) {
  return (
    <GradientHeader style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
        <Ionicons name="arrow-back" size={22} color={colors.white} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={{ width: 22 }} />
    </GradientHeader>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.white, flex: 1, textAlign: 'center' },
});
