import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { PHONE_AUTH_ENABLED } from '../config';

import HomeScreen from '../screens/HomeScreen';
import CategoryListingScreen from '../screens/CategoryListingScreen';
import SearchScreen from '../screens/SearchScreen';
import TrendingScreen from '../screens/TrendingScreen';
import PostListingScreen from '../screens/PostListingScreen';
import MessagesListScreen from '../screens/MessagesListScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import MyCartScreen from '../screens/MyCartScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MyOrdersScreen from '../screens/MyOrdersScreen';
import PhoneLoginScreen from '../screens/auth/PhoneLoginScreen';
import OtpVerifyScreen from '../screens/auth/OtpVerifyScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const SearchStack = createNativeStackNavigator();
const TrendingStack = createNativeStackNavigator();
const PanierStack = createNativeStackNavigator();
const MoiStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();
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

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.white,
        tabBarStyle: { backgroundColor: colors.purple, borderTopWidth: 0, height: 58, paddingTop: 8 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Accueil" component={HomeStackNavigator} />
      <Tab.Screen name="Boutique" component={SearchStackNavigator} />
      <Tab.Screen name="Tendances" component={TrendingStackNavigator} />
      <Tab.Screen name="Panier" component={PanierStackNavigator} />
      <Tab.Screen name="Moi" component={MoiStackNavigator} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading } = useAuth();

  // Tant que la connexion par téléphone est désactivée (voir src/config.js),
  // on saute directement à l'application principale, sans jamais bloquer
  // sur l'écran de connexion — pratique pour continuer à construire le
  // reste de l'appli sans dépendre de Twilio pour l'instant.
  if (!PHONE_AUTH_ENABLED) {
    return (
      <NavigationContainer>
        <MainTabs />
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
      {session ? <MainTabs /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
}
