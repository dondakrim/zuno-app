// Carrousel de publicités (ciblées) — src/components/AdCarousel.js
import React, { useState } from 'react';
import { View, Text, FlatList, ImageBackground, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, radius } from '../theme/colors';

const AD_WIDTH = Dimensions.get('window').width - spacing.lg * 2;

export default function AdCarousel({ ads, onPressAd, sponsoredLabel = true }) {
  const [index, setIndex] = useState(0);
  if (!ads || ads.length === 0) return null;

  const renderInner = (item) => (
    <>
      {sponsoredLabel ? (
        <View style={s.tag}><Text style={s.tagText}>Sponsorisé</Text></View>
      ) : null}
      {(item.title || item.subtitle) && (
        <View style={item.image_url ? s.overlay : null}>
          {item.title ? <Text style={s.title}>{item.title}</Text> : null}
          {item.subtitle ? <Text style={s.subtitle}>{item.subtitle}</Text> : null}
        </View>
      )}
    </>
  );

  return (
    <View>
      <FlatList
        data={ads}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / AD_WIDTH))}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.9} onPress={() => onPressAd && onPressAd(item)}>
            {item.image_url ? (
              <ImageBackground
                source={{ uri: item.image_url }}
                style={[s.slide, { backgroundColor: item.color || colors.purple }]}
                imageStyle={{ borderRadius: radius.md }}
                resizeMode="cover"
              >
                {renderInner(item)}
              </ImageBackground>
            ) : (
              <View style={[s.slide, { backgroundColor: item.color || colors.purple }]}>{renderInner(item)}</View>
            )}
          </TouchableOpacity>
        )}
      />
      {ads.length > 1 && (
        <View style={s.dots}>
          {ads.map((_, i) => (
            <View key={i} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  slide: { width: AD_WIDTH, height: 120, borderRadius: radius.md, padding: spacing.md, justifyContent: 'center', overflow: 'hidden' },
  tag: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  overlay: { backgroundColor: 'rgba(0,0,0,0.35)', padding: spacing.sm, borderRadius: radius.sm, alignSelf: 'flex-start' },
  title: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.orange, width: 16 },
});
