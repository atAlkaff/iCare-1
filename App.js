import "react-native-gesture-handler"; // keep this as the FIRST import
import React from "react";
import { View, TouchableOpacity, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// my pages
import Dashboard from "./src/pages/Dashboard";
import AddSchedule from "./src/pages/AddSchedule";
import ChatbotScreen from "./src/pages/chatbot";
import OCRScreen from "./src/pages/OCR";

const Camera = OCRScreen;
const Chat = ChatbotScreen;
const Settings = Dashboard;


const Tab = createBottomTabNavigator();

const COLORS = {
  bar: "#0D315B",
  icon: "#FFFFFF",
  iconInactive: "rgba(255,255,255,0.75)",
  fab: "#0D315B",
  fabBorder: "#143D70",
};

function CenterButton({ children, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        top: -22,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: COLORS.fab,
          borderWidth: 2,
          borderColor: COLORS.fabBorder,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {children}
      </View>
    </TouchableOpacity>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              position: "absolute",
              height: 60,
              borderRadius: 40,
              marginHorizontal: 8,
              marginBottom: 24,
              backgroundColor: COLORS.bar,
              borderTopWidth: 0,
              paddingHorizontal: 14,
              paddingBottom: Platform.OS === "android" ? 10 : 18,
            },
            tabBarItemStyle: { paddingVertical: 6 },
            tabBarIcon: ({ focused }) => {
              const color = focused ? COLORS.icon : COLORS.iconInactive;
              switch (route.name) {
                case "Home":
                  return (
                    <Ionicons name="home-outline" size={26} color={color} />
                  );
                case "Camera":
                  return <Feather name="camera" size={24} color={color} />;
                case "Add":
                  return <Feather name="plus" size={30} color={COLORS.icon} />;
                case "Chat":
                  return (
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={24}
                      color={color}
                    />
                  );
                case "Settings":
                  return (
                    <MaterialIcons name="more-horiz" size={28} color={color} />
                  );
                default:
                  return null;
              }
            },
          })}
        >
          <Tab.Screen name="Home" component={Dashboard} />
          <Tab.Screen name="Camera" component={Camera} />
          <Tab.Screen
            name="Add"
            component={AddSchedule}
            options={{
              tabBarButton: (props) => (
                <CenterButton {...props}>
                  <Feather name="plus" size={30} color={COLORS.icon} />
                </CenterButton>
              ),
            }}
          />
          <Tab.Screen name="Chat" component={Chat} />
          <Tab.Screen name="Settings" component={Settings} />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
