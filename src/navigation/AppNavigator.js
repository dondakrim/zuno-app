import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import { PHONE_AUTH_ENABLED } from '../config';

import HomeScreen from '../screens/HomeScreen';
import CategoryListingScreen from '../screens/CategoryListingScreen';
import SearchScreen from '../screens/SearchScreen';
import TrendingScreen from '../screens/TrendingScreen';
import PostListingScreen from '../screens/PostListingScreen';
import MessagesListScreen from '../screens/MessagesListScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import MyCartScreen from '../screens/MyCartScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import ModerationScreen from '../screens/ModerationScreen';
import MerchantDashboardScreen from '../screens/merchant/DashboardScreen';
import IdentityVerificationScreen from '../screens/merchant/IdentityVerificationScreen';
import MerchantListingsScreen from '../screens/merchant/MerchantListingsScreen';
import MerchantOrdersScreen from '../screens/merchant/MerchantOrdersScreen';
import PhoneLoginScreen from '../screens/auth/PhoneLoginScreen';
import OtpVerifyScreen from '../screens/auth/OtpVerifyScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const SearchStack = createNativeStackNavigator();
const TrendingStack = createNativeStackNavigator();
const PanierStack = createNativeStackNavigator();
const MoiStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();
const MerchantTab = createBottomTabNavigator();
const MerchantDashboardStack = createNativeStackNavigator();
const MerchantListingsStack = createNativeStackNavigator();
const MerchantOrdersStack = createNativeStackNavigator();
const MerchantMoiStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

// Tant que personne n'est connecté, seul ce parcours est accessible.
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <AuthStack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    </AuthStack.Navigator>
  );
}

// L'accueil a besoin de son propre "stack" pour pouvoir ouvrir
// la fiche produit, puis la conversation, par-dessus le fil d'annonces.
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeFeed" component={HomeScreen} />
      <HomeStack.Screen name="CategoryListing" component={CategoryListingScreen} />
      <HomeStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <HomeStack.Screen name="Cart" component={CartScreen} />
      <HomeStack.Screen name="Checkout" component={CheckoutScreen} />
      <HomeStack.Screen name="Chat" component={ChatScreen} />
      <HomeStack.Screen name="MessagesList" component={MessagesListScreen} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
      <HomeStack.Screen name="Settings" component={SettingsScreen} />
      <HomeStack.Screen name="Moderation" component={ModerationScreen} />
      <HomeStack.Screen name="PostListing" component={PostListingScreen} />
    </HomeStack.Navigator>
  );
}

// Idem pour l'onglet Recherche : les résultats, puis une fiche produit ou
// une conversation ouverte par-dessus.
function SearchStackNavigator() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="SearchHome" component={SearchScreen} />
      <SearchStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <SearchStack.Screen name="Cart" component={CartScreen} />
      <SearchStack.Screen name="Checkout" component={CheckoutScreen} />
      <SearchStack.Screen name="Chat" component={ChatScreen} />
    </SearchStack.Navigator>
  );
}

// Idem pour l'onglet Tendances : la grille d'articles, puis une fiche
// produit ou une conversation ouverte par-dessus.
function TrendingStackNavigator() {
  return (
    <TrendingStack.Navigator screenOptions={{ headerShown: false }}>
      <TrendingStack.Screen name="TrendingHome" component={TrendingScreen} />
      <TrendingStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <TrendingStack.Screen name="Cart" component={CartScreen} />
      <TrendingStack.Screen name="Checkout" component={CheckoutScreen} />
      <TrendingStack.Screen name="Chat" component={ChatScreen} />
    </TrendingStack.Navigator>
  );
}

// Idem pour l'onglet Panier : la liste des articles enregistrés, puis le
// parcours d'achat par-dessus.
function PanierStackNavigator() {
  return (
    <PanierStack.Navigator screenOptions={{ headerShown: false }}>
      <PanierStack.Screen name="MyCart" component={MyCartScreen} />
      <PanierStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <PanierStack.Screen name="Cart" component={CartScreen} />
      <PanierStack.Screen name="Checkout" component={CheckoutScreen} />
      <PanierStack.Screen name="Chat" component={ChatScreen} />
    </PanierStack.Navigator>
  );
}

// Idem pour l'onglet Moi : le profil, puis Mes commandes et la vue d'une
// boutique favorite par-dessus.
function MoiStackNavigator() {
  return (
    <MoiStack.Navigator screenOptions={{ headerShown: false }}>
      <MoiStack.Screen name="ProfileHome" component={ProfileScreen} />
      <MoiStack.Screen name="EditProfile" component={EditProfileScreen} />
      <MoiStack.Screen name="MyOrders" component={MyOrdersScreen} />
      <MoiStack.Screen name="CategoryListing" component={CategoryListingScreen} />
      <MoiStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <MoiStack.Screen name="Cart" component={CartScreen} />
      <MoiStack.Screen name="Checkout" component={CheckoutScreen} />
      <MoiStack.Screen name="Chat" component={ChatScreen} />
    </MoiStack.Navigator>
  );
}

// Idem pour l'onglet Messages : la liste des conversations, puis une
// conversation ouverte par-dessus.
function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="MessagesList" component={MessagesListScreen} />
      <MessagesStack.Screen name="Chat" component={ChatScreen} />
    </MessagesStack.Navigator>
  );
}

const icons = {
  Accueil: 'home',
  Boutique: 'storefront-outline',
  Tendances: 'flame-outline',
  Panier: 'cart-outline',
  Moi: 'person-outline',
};

// --- Navigation du mode Marchand ---

function MerchantDashboardStackNavigator() {
  return (
    <MerchantDashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <MerchantDashboardStack.Screen name="DashboardHome" component={MerchantDashboardScreen} />
      <MerchantDashboardStack.Screen name="IdentityVerification" component={IdentityVerificationScreen} />
      <MerchantDashboardStack.Screen name="MerchantOrders" component={MerchantOrdersScreen} />
      <MerchantDashboardStack.Screen name="PostListing" component={PostListingScreen} />
      <MerchantDashboardStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <MerchantDashboardStack.Screen name="Chat" component={ChatScreen} />
    </MerchantDashboardStack.Navigator>
  );
}

function MerchantListingsStackNavigator() {
  return (
    <MerchantListingsStack.Navigator screenOptions={{ headerShown: false }}>
      <MerchantListingsStack.Screen name="MerchantListingsHome" component={MerchantListingsScreen} />
      <MerchantListingsStack.Screen name="PostListing" component={PostListingScreen} />
      <MerchantListingsStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <MerchantListingsStack.Screen name="Chat" component={ChatScreen} />
    </MerchantListingsStack.Navigator>
  );
}

function MerchantOrdersStackNavigator() {
  return (
    <MerchantOrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <MerchantOrdersStack.Screen name="MerchantOrdersHome" component={MerchantOrdersScreen} />
      <MerchantOrdersStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <MerchantOrdersStack.Screen name="Chat" component={ChatScreen} />
    </MerchantOrdersStack.Navigator>
  );
}

// Le profil est partagé entre les deux modes — seul l'endroit d'où on y
// accède change.
function MerchantMoiStackNavigator() {
  return (
    <MerchantMoiStack.Navigator screenOptions={{ headerShown: false }}>
      <MerchantMoiStack.Screen name="ProfileHome" component={ProfileScreen} />
      <MerchantMoiStack.Screen name="EditProfile" component={EditProfileScreen} />
      <MerchantMoiStack.Screen name="MyOrders" component={MyOrdersScreen} />
      <MerchantMoiStack.Screen name="CategoryListing" component={CategoryListingScreen} />
      <MerchantMoiStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <MerchantMoiStack.Screen name="Cart" component={CartScreen} />
      <MerchantMoiStack.Screen name="Checkout" component={CheckoutScreen} />
      <MerchantMoiStack.Screen name="Chat" component={ChatScreen} />
    </MerchantMoiStack.Navigator>
  );
}

const merchantIcons = {
  Tableau: 'grid-outline',
  Commandes: 'receipt-outline',
  MoiMarchand: 'person-outline',
};

function MerchantTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 58 + insets.bottom;

  return (
    <MerchantTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.white,
        tabBarStyle: {
          backgroundColor: colors.purple,
          borderTopWidth: 0,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={merchantIcons[route.name]} size={size} color={color} />
        ),
      })}
    >
      <MerchantTab.Screen name="Tableau" component={MerchantDashboardStackNavigator} />
      <MerchantTab.Screen name="Commandes" component={MerchantOrdersStackNavigator} />
      <MerchantTab.Screen name="MoiMarchand" component={MerchantMoiStackNavigator} />
    </MerchantTab.Navigator>
  );
}

function MainTabs() {
  // Sur un vrai téléphone (contrairement à Expo Go), la barre de gestes ou
  // les boutons Android occupent un espace variable selon les modèles —
  // sans cet ajustement, les icônes du bas peuvent être coupées ou
  // masquées derrière ces boutons système.
  const insets = useSafeAreaInsets();
  const tabBarHeight = 64 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.white,
        tabBarStyle: {
          backgroundColor: colors.purple,
          borderTopWidth: 0,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name]} size={size} color={color} />
        ),
        tabBarLabel: ({ focused, color, children }) => (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color, fontSize: 10, fontWeight: focused ? '700' : '500' }}>{children}</Text>
            {focused && (
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.orange, marginTop: 2 }} />
            )}
          </View>
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={HomeStackNavigator} options={{ tabBarLabel: 'Accueil' }} />
      <Tab.Screen name="Boutique" component={SearchStackNavigator} options={{ tabBarLabel: 'Boutiques' }} />
      <Tab.Screen name="Tendances" component={TrendingStackNavigator} options={{ tabBarLabel: 'Tendances' }} />
      <Tab.Screen name="Panier" component={PanierStackNavigator} options={{ tabBarLabel: 'Mon panier' }} />
      <Tab.Screen name="Moi" component={MoiStackNavigator} options={{ tabBarLabel: 'Profil' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();
  const { mode, loading: modeLoading } = useMode();

  // Tant que la connexion par téléphone est désactivée (voir src/config.js),
  // on saute directement à l'application principale, sans jamais bloquer
  // sur l'écran de connexion — pratique pour continuer à construire le
  // reste de l'appli sans dépendre de Twilio pour l'instant.
  if (!PHONE_AUTH_ENABLED) {
    if (modeLoading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purple }}>
          <ActivityIndicator color={colors.white} size="large" />
        </View>
      );
    }
    return (
      <NavigationContainer>
        {mode === 'marchand' ? <MerchantTabs /> : <MainTabs />}
      </NavigationContainer>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purple }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? (mode === 'marchand' ? <MerchantTabs /> : <MainTabs />) : <AuthStackNavigator />}
    </NavigationContainer>
  );
}
