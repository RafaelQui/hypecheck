import React from "react";
import { Slot } from "expo-router";

// HypeCheck renders its own in-screen bottom navigation from index.tsx. This
// route group only needs to render that screen; a hidden native Tabs host
// created the raw-text crash on Expo Go.
export default function TabLayout() {
  return <Slot />;
}